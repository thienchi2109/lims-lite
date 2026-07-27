import { getEventListeners } from 'node:events'
import { describe, expect, test, vi } from 'vitest'
import {
  ApprovalBatchWorker,
  waitForCancellableDelay,
} from './worker'
import { ApprovalBatchWorkerMetrics } from './metrics'
import type {
  ApprovalBatchWorkerDatabase,
  ClaimedApprovalBatchItem,
  ExecutionOutcome,
  PrivacySafeLogger,
} from './contracts'

const firstItem: ClaimedApprovalBatchItem = {
  attemptNumber: 1,
  batchItemId: '11111111-1111-4111-8111-111111111111',
  claimExpiresAt: new Date('2026-07-27T01:01:00.000Z'),
  claimToken: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
}

const secondItem: ClaimedApprovalBatchItem = {
  attemptNumber: 2,
  batchItemId: '22222222-2222-4222-8222-222222222222',
  claimExpiresAt: new Date('2026-07-27T01:01:00.000Z'),
  claimToken: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
}

function success(
  item: ClaimedApprovalBatchItem,
  overrides: Partial<ExecutionOutcome> = {}
): ExecutionOutcome {
  return {
    batchItemId: item.batchItemId,
    outcomeCode: 'APPROVED',
    replayed: false,
    success: true,
    terminal: false,
    ...overrides,
  }
}

function createLogger(): PrivacySafeLogger & {
  entries: Array<Record<string, unknown>>
} {
  const entries: Array<Record<string, unknown>> = []
  return {
    entries,
    log(entry) {
      entries.push(entry)
    },
  }
}

function createDatabase(
  overrides: Partial<ApprovalBatchWorkerDatabase> = {}
): ApprovalBatchWorkerDatabase {
  return {
    checkReadiness: vi.fn().mockResolvedValue(undefined),
    claimItems: vi.fn().mockResolvedValue([]),
    close: vi.fn().mockResolvedValue(undefined),
    executeItem: vi.fn().mockImplementation(async (itemId: string) => ({
      batchItemId: itemId,
      outcomeCode: 'APPROVED',
      replayed: false,
      success: true,
      terminal: false,
    })),
    observeQueue: vi.fn().mockResolvedValue({
      observedAt: new Date('2026-07-27T01:00:00.000Z'),
      oldestEligibleQueueAgeSeconds: 0,
    }),
    ...overrides,
  }
}

function createWorker(
  database: ApprovalBatchWorkerDatabase,
  options: {
    concurrency?: number
    logger?: PrivacySafeLogger
    metrics?: ApprovalBatchWorkerMetrics
    wait?: (delayMs: number, signal: AbortSignal) => Promise<void>
  } = {}
) {
  return new ApprovalBatchWorker({
    config: {
      claimLeaseSeconds: 60,
      concurrency: options.concurrency ?? 2,
      databaseFailureBackoffMaxMs: 100,
      databaseFailureBackoffMinMs: 10,
      drainTimeoutMs: 100,
      idlePollIntervalMs: 5,
    },
    database,
    logger: options.logger ?? createLogger(),
    metrics: options.metrics ?? new ApprovalBatchWorkerMetrics(),
    wait: options.wait,
  })
}

describe('ApprovalBatchWorker claim cycle', () => {
  test('polls idly without inventing successful work', async () => {
    const database = createDatabase()
    const metrics = new ApprovalBatchWorkerMetrics()
    const worker = createWorker(database, { metrics })

    const result = await worker.runCycle()

    expect(database.claimItems).toHaveBeenCalledWith(2, 60)
    expect(database.observeQueue).toHaveBeenCalledTimes(1)
    expect(database.executeItem).not.toHaveBeenCalled()
    expect(result).toEqual({ claimed: 0, databaseReady: true })
    expect(metrics.snapshot()).toMatchObject({
      claimedTotal: 0,
      databaseReady: true,
      inFlight: 0,
      oldestEligibleQueueAgeSeconds: 0,
      succeededTotal: 0,
    })
  })

  test('observes authoritative queue age after claiming', async () => {
    const database = createDatabase({
      claimItems: vi.fn().mockResolvedValue([firstItem]),
      observeQueue: vi.fn().mockResolvedValue({
        observedAt: new Date('2026-07-27T01:00:01.000Z'),
        oldestEligibleQueueAgeSeconds: 37.25,
      }),
    })
    const metrics = new ApprovalBatchWorkerMetrics()
    const worker = createWorker(database, { metrics })

    await worker.runCycle()
    await worker.drain()

    expect(database.claimItems).toHaveBeenCalledTimes(1)
    expect(database.observeQueue).toHaveBeenCalledTimes(1)
    expect(
      vi.mocked(database.claimItems).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(database.observeQueue).mock.invocationCallOrder[0])
    expect(
      vi.mocked(database.observeQueue).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(database.executeItem).mock.invocationCallOrder[0])
    expect(metrics.snapshot().oldestEligibleQueueAgeSeconds).toBe(37.25)
  })

  test('keeps claimed work when queue observability fails', async () => {
    const database = createDatabase({
      claimItems: vi.fn().mockResolvedValue([firstItem]),
      observeQueue: vi
        .fn()
        .mockRejectedValue(new Error('confidential queue query failure')),
    })
    const logger = createLogger()
    const metrics = new ApprovalBatchWorkerMetrics()
    const worker = createWorker(database, { logger, metrics })

    await expect(worker.runCycle()).resolves.toEqual({
      claimed: 1,
      databaseReady: false,
    })
    await worker.drain()

    expect(database.executeItem).toHaveBeenCalledWith(
      firstItem.batchItemId,
      firstItem.claimToken
    )
    expect(
      vi.mocked(database.observeQueue).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(database.executeItem).mock.invocationCallOrder[0])
    expect(metrics.snapshot()).toMatchObject({
      databaseOperationErrorsTotal: 1,
      databaseReady: false,
      oldestEligibleQueueAgeSeconds: null,
      succeededTotal: 1,
    })
    expect(JSON.stringify(logger.entries)).not.toContain('confidential')
  })

  test('bounds claims to available capacity and records mixed outcomes', async () => {
    const database = createDatabase({
      claimItems: vi.fn().mockResolvedValue([firstItem, secondItem]),
      executeItem: vi
        .fn()
        .mockResolvedValueOnce(success(firstItem))
        .mockResolvedValueOnce(
          success(secondItem, {
            outcomeCode: 'QC_BLOCKED',
            success: false,
            terminal: true,
          })
        ),
    })
    const metrics = new ApprovalBatchWorkerMetrics()
    const worker = createWorker(database, { metrics })

    await worker.runCycle()
    await worker.drain()

    expect(database.claimItems).toHaveBeenCalledWith(2, 60)
    expect(database.executeItem).toHaveBeenNthCalledWith(
      1,
      firstItem.batchItemId,
      firstItem.claimToken
    )
    expect(database.executeItem).toHaveBeenNthCalledWith(
      2,
      secondItem.batchItemId,
      secondItem.claimToken
    )
    expect(metrics.snapshot()).toMatchObject({
      claimedTotal: 2,
      failedTotal: 1,
      inFlight: 0,
      retryClaimsTotal: 1,
      succeededTotal: 1,
    })
  })

  test('records retry exhaustion as a terminal outcome', async () => {
    const database = createDatabase({
      claimItems: vi.fn().mockResolvedValue([secondItem]),
      executeItem: vi.fn().mockResolvedValue(
        success(secondItem, {
          outcomeCode: 'AUTOMATIC_RETRIES_EXHAUSTED',
          success: false,
          terminal: true,
        })
      ),
    })
    const metrics = new ApprovalBatchWorkerMetrics()
    const worker = createWorker(database, { metrics })

    await worker.runCycle()
    await worker.drain()

    expect(metrics.snapshot().outcomes).toEqual({
      AUTOMATIC_RETRIES_EXHAUSTED: 1,
    })
  })

  test('resets claim saturation during an outage and recovers', async () => {
    let nowMs = Date.parse('2026-07-27T01:00:00.000Z')
    const database = createDatabase({
      checkReadiness: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('confidential raw database error'))
        .mockResolvedValueOnce(undefined),
      claimItems: vi.fn().mockResolvedValueOnce([firstItem]).mockResolvedValue([]),
    })
    const logger = createLogger()
    const metrics = new ApprovalBatchWorkerMetrics(() => nowMs)
    const worker = createWorker(database, {
      concurrency: 1,
      logger,
      metrics,
    })
    await expect(worker.runCycle()).resolves.toEqual({
      claimed: 1,
      databaseReady: true,
    })
    await worker.drain()
    nowMs += 5_000
    expect(metrics.snapshot().continuousFullClaimSaturationSeconds).toBe(5)
    await expect(worker.runCycle()).resolves.toEqual({
      claimed: 0,
      databaseReady: false,
    })
    expect(metrics.snapshot().databaseReady).toBe(false)
    expect(metrics.snapshot().continuousFullClaimSaturationSeconds).toBe(0)
    expect(JSON.stringify(logger.entries)).not.toContain('confidential')
    expect(database.claimItems).toHaveBeenCalledTimes(1)
    await expect(worker.runCycle()).resolves.toEqual({
      claimed: 0,
      databaseReady: true,
    })
    expect(metrics.snapshot().databaseReady).toBe(true)
    expect(database.claimItems).toHaveBeenCalledTimes(2)
  })

  test('does not let an execution success overwrite a later readiness failure', async () => {
    let completeExecution: ((outcome: ExecutionOutcome) => void) | undefined
    const execution = new Promise<ExecutionOutcome>((resolve) => {
      completeExecution = resolve
    })
    const database = createDatabase({
      checkReadiness: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('database unavailable')),
      claimItems: vi.fn().mockResolvedValueOnce([firstItem]),
      executeItem: vi.fn().mockReturnValue(execution),
    })
    const metrics = new ApprovalBatchWorkerMetrics()
    const worker = createWorker(database, { metrics })

    await worker.runCycle()
    await worker.runCycle()
    expect(metrics.snapshot().databaseReady).toBe(false)

    completeExecution?.(success(firstItem))
    await worker.drain()
    expect(metrics.snapshot().databaseReady).toBe(false)
  })

  test('supports two bounded worker loops without duplicate execution', async () => {
    const queue = [firstItem, secondItem]
    const executed = new Set<string>()
    const database = createDatabase({
      claimItems: vi.fn().mockImplementation(async (limit: number) => {
        return queue.splice(0, limit)
      }),
      executeItem: vi.fn().mockImplementation(async (itemId: string) => {
        expect(executed.has(itemId)).toBe(false)
        executed.add(itemId)
        return success(
          itemId === firstItem.batchItemId ? firstItem : secondItem
        )
      }),
    })
    const firstWorker = createWorker(database, { concurrency: 1 })
    const secondWorker = createWorker(database, { concurrency: 1 })

    await Promise.all([firstWorker.runCycle(), secondWorker.runCycle()])
    await Promise.all([firstWorker.drain(), secondWorker.drain()])

    expect(executed).toEqual(
      new Set([firstItem.batchItemId, secondItem.batchItemId])
    )
    expect(database.claimItems).toHaveBeenCalledTimes(2)
    expect(database.claimItems).toHaveBeenCalledWith(1, 60)
  })
})

describe('ApprovalBatchWorker restart and shutdown', () => {
  test('records replay after a post-commit crash as stale-lease recovery', async () => {
    const metrics = new ApprovalBatchWorkerMetrics()
    const database = createDatabase({
      claimItems: vi.fn().mockResolvedValue([secondItem]),
      executeItem: vi.fn().mockResolvedValue(
        success(secondItem, {
          outcomeCode: 'ITEM_ALREADY_SUCCEEDED',
          replayed: true,
        })
      ),
    })
    const restartedWorker = createWorker(database, { metrics })

    await restartedWorker.runCycle()
    await restartedWorker.drain()

    expect(metrics.snapshot()).toMatchObject({
      postCommitLeaseReplayRecoveriesTotal: 1,
      succeededTotal: 1,
    })
  })

  test('stops new claims and drains in-flight work during shutdown', async () => {
    let completeExecution: ((outcome: ExecutionOutcome) => void) | undefined
    const execution = new Promise<ExecutionOutcome>((resolve) => {
      completeExecution = resolve
    })
    const database = createDatabase({
      claimItems: vi.fn().mockResolvedValueOnce([firstItem]).mockResolvedValue([]),
      executeItem: vi.fn().mockReturnValue(execution),
    })
    const metrics = new ApprovalBatchWorkerMetrics()
    const worker = createWorker(database, { metrics })

    await worker.runCycle()
    const shutdown = worker.shutdown()
    await Promise.resolve()

    expect(worker.isAcceptingClaims()).toBe(false)
    expect(database.claimItems).toHaveBeenCalledTimes(1)

    completeExecution?.(success(firstItem))
    await expect(shutdown).resolves.toEqual({ drained: true })
    expect(metrics.snapshot().databaseReady).toBe(false)
  })

  test('cancels idle polling when a termination signal requests shutdown', async () => {
    let observedSignal: AbortSignal | undefined
    const wait = vi.fn(
      async (_delayMs: number, signal: AbortSignal) =>
        new Promise<void>((resolve) => {
          observedSignal = signal
          signal.addEventListener('abort', () => resolve(), { once: true })
        })
    )
    const database = createDatabase()
    const worker = createWorker(database, { wait })

    const running = worker.run()
    await vi.waitFor(() => expect(wait).toHaveBeenCalledTimes(1))
    const shutdown = worker.shutdown()

    expect(observedSignal?.aborted).toBe(true)
    await expect(shutdown).resolves.toEqual({ drained: true })
    await expect(running).resolves.toBeUndefined()
  })

  test('removes abort listeners after normal polling delays', async () => {
    const controller = new AbortController()

    for (let index = 0; index < 12; index += 1) {
      await waitForCancellableDelay(1, controller.signal)
    }

    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0)
  })
})

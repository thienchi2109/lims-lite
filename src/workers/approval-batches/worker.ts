/**
 * Bounded claim/execute loop with cancellable polling and graceful draining.
 */
import type {
  ApprovalBatchWorkerDatabase,
  ClaimedApprovalBatchItem,
  PrivacySafeLogger,
} from './contracts'
import { classifyDatabaseError } from './logger'
import { ApprovalBatchWorkerMetrics } from './metrics'

interface WorkerLoopConfig {
  claimLeaseSeconds: number
  concurrency: number
  databaseFailureBackoffMaxMs: number
  databaseFailureBackoffMinMs: number
  drainTimeoutMs: number
  idlePollIntervalMs: number
}

interface WorkerOptions {
  config: WorkerLoopConfig
  database: ApprovalBatchWorkerDatabase
  logger: PrivacySafeLogger
  metrics: ApprovalBatchWorkerMetrics
  now?: () => number
  wait?: (delayMs: number, signal: AbortSignal) => Promise<void>
}

interface WorkerCycleResult {
  claimed: number
  databaseReady: boolean
}

export class ApprovalBatchWorker {
  private acceptingClaims = true
  private activeCycle: Promise<WorkerCycleResult> | null = null
  private databaseFailureCount = 0
  private readonly inFlight = new Set<Promise<void>>()
  private shutdownPromise: Promise<{ drained: boolean }> | null = null
  private readonly stopController = new AbortController()

  constructor(private readonly options: WorkerOptions) {}

  isAcceptingClaims() {
    return this.acceptingClaims
  }

  async run() {
    while (this.acceptingClaims) {
      if (this.inFlight.size >= this.options.config.concurrency) {
        await Promise.race(this.inFlight)
        continue
      }

      const cycle = await this.runCycle()
      if (!this.acceptingClaims) {
        break
      }

      const delayMs = this.delayAfterCycle(cycle)

      if (delayMs > 0) {
        await (this.options.wait ?? waitForCancellableDelay)(
          delayMs,
          this.stopController.signal
        )
      }
    }
  }

  runCycle(): Promise<WorkerCycleResult> {
    if (!this.acceptingClaims || this.activeCycle) {
      return Promise.resolve({
        claimed: 0,
        databaseReady: this.options.metrics.isDatabaseReady(),
      })
    }

    const availableCapacity =
      this.options.config.concurrency - this.inFlight.size
    if (availableCapacity <= 0) {
      return Promise.resolve({
        claimed: 0,
        databaseReady: this.options.metrics.isDatabaseReady(),
      })
    }

    const cycle = this.performCycle(availableCapacity)
    this.activeCycle = cycle
    return cycle.finally(() => {
      if (this.activeCycle === cycle) {
        this.activeCycle = null
      }
    })
  }

  async drain(timeoutMs = this.options.config.drainTimeoutMs) {
    if (this.inFlight.size === 0) {
      return { drained: true }
    }

    const drained = await settleWithin(
      Promise.allSettled([...this.inFlight]).then(() => true),
      timeoutMs
    )
    return { drained }
  }

  shutdown() {
    if (!this.shutdownPromise) {
      this.acceptingClaims = false
      this.options.metrics.setDatabaseReady(false)
      this.stopController.abort()
      this.shutdownPromise = this.finishShutdown()
    }
    return this.shutdownPromise
  }

  private async performCycle(
    availableCapacity: number
  ): Promise<WorkerCycleResult> {
    try {
      await this.options.database.checkReadiness()
      if (!this.acceptingClaims) {
        return { claimed: 0, databaseReady: false }
      }
      this.options.metrics.setDatabaseReady(true)
    } catch (error) {
      return this.databaseFailure('readiness_check_failed', error)
    }

    try {
      const claimedItems = await this.options.database.claimItems(
        availableCapacity,
        this.options.config.claimLeaseSeconds
      )
      this.databaseFailureCount = 0
      this.options.metrics.recordClaimBatch({
        claimedItems,
        requestedCount: availableCapacity,
      })
      if (claimedItems.length > 0) {
        this.options.logger.log({
          claimCount: claimedItems.length,
          event: 'claim_cycle_finished',
          inFlight: this.inFlight.size,
          level: 'info',
        })
      }

      for (const item of claimedItems) {
        this.startItem(item)
      }
      return { claimed: claimedItems.length, databaseReady: true }
    } catch (error) {
      return this.databaseFailure('claim_cycle_failed', error)
    }
  }

  private async finishShutdown() {
    const startedAt = this.now()
    const activeCycleDrained = this.activeCycle
      ? await settleWithin(
          this.activeCycle.then(
            () => true,
            () => true
          ),
          this.options.config.drainTimeoutMs
        )
      : true
    const remainingMs = Math.max(
      0,
      this.options.config.drainTimeoutMs - (this.now() - startedAt)
    )
    const result = activeCycleDrained
      ? await this.drain(remainingMs)
      : { drained: false }

    this.options.logger.log({
      event: 'worker_shutdown',
      inFlight: this.inFlight.size,
      level: result.drained ? 'info' : 'warn',
      outcomeCode: result.drained ? 'DRAINED' : 'DRAIN_TIMEOUT',
    })
    return result
  }

  private databaseFailure(event: string, error: unknown): WorkerCycleResult {
    this.databaseFailureCount += 1
    this.options.metrics.recordClaimCycleInterrupted()
    this.options.metrics.setDatabaseReady(false)
    this.options.metrics.recordDatabaseOperationError()
    this.options.logger.log({
      event,
      inFlight: this.inFlight.size,
      level: 'warn',
      outcomeCode: classifyDatabaseError(error),
    })
    return { claimed: 0, databaseReady: false }
  }

  private databaseBackoffMs() {
    const exponent = Math.max(0, this.databaseFailureCount - 1)
    return Math.min(
      this.options.config.databaseFailureBackoffMaxMs,
      this.options.config.databaseFailureBackoffMinMs * 2 ** exponent
    )
  }

  private now() {
    return (this.options.now ?? Date.now)()
  }

  private delayAfterCycle(cycle: WorkerCycleResult) {
    if (!cycle.databaseReady) {
      return this.databaseBackoffMs()
    }
    if (cycle.claimed === 0) {
      return this.options.config.idlePollIntervalMs
    }
    return 0
  }

  private startItem(item: ClaimedApprovalBatchItem) {
    const startedAt = this.now()
    const task = this.options.database
      .executeItem(item.batchItemId, item.claimToken)
      .then((outcome) => {
        this.options.metrics.recordOutcome(outcome)
        this.options.logger.log({
          attemptNumber: item.attemptNumber,
          batchItemId: item.batchItemId,
          durationMs: this.now() - startedAt,
          event: 'item_finished',
          level: outcome.success ? 'info' : 'warn',
          outcomeCode: outcome.outcomeCode,
        })
      })
      .catch((error: unknown) => {
        this.options.metrics.setDatabaseReady(false)
        this.options.metrics.recordDatabaseOperationError()
        this.options.logger.log({
          attemptNumber: item.attemptNumber,
          batchItemId: item.batchItemId,
          durationMs: this.now() - startedAt,
          event: 'item_execution_interrupted',
          level: 'warn',
          outcomeCode: classifyDatabaseError(error),
        })
      })
      .finally(() => {
        this.inFlight.delete(task)
        this.options.metrics.recordItemFinished(item.batchItemId)
        this.options.metrics.setInFlight(this.inFlight.size)
      })

    this.inFlight.add(task)
    this.options.metrics.setInFlight(this.inFlight.size)
  }
}

export async function waitForCancellableDelay(
  delayMs: number,
  signal: AbortSignal
) {
  if (signal.aborted) {
    return
  }
  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timeout = setTimeout(finish, delayMs)
    signal.addEventListener('abort', finish, { once: true })
    if (signal.aborted) {
      finish()
    }
  })
}

async function settleWithin(
  settlement: Promise<boolean>,
  timeoutMs: number
) {
  if (timeoutMs <= 0) {
    return false
  }
  let timeout: NodeJS.Timeout | undefined
  const timedOut = new Promise<boolean>((resolve) => {
    timeout = setTimeout(() => resolve(false), timeoutMs)
  })
  const result = await Promise.race([settlement, timedOut])
  if (timeout) {
    clearTimeout(timeout)
  }
  return result
}

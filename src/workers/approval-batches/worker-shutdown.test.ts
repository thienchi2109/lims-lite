import { describe, expect, test, vi } from 'vitest'
import type { ApprovalBatchWorkerDatabase } from './contracts'
import { ApprovalBatchWorkerMetrics } from './metrics'
import { ApprovalBatchWorker } from './worker'

describe('ApprovalBatchWorker shutdown during database operations', () => {
  test('waits for an active readiness check and skips a new claim', async () => {
    let finishReadiness: (() => void) | undefined
    const readiness = new Promise<void>((resolve) => {
      finishReadiness = resolve
    })
    const database: ApprovalBatchWorkerDatabase = {
      checkReadiness: vi.fn().mockReturnValue(readiness),
      claimItems: vi.fn().mockResolvedValue([]),
      close: vi.fn().mockResolvedValue(undefined),
      executeItem: vi.fn(),
    }
    const metrics = new ApprovalBatchWorkerMetrics()
    const worker = new ApprovalBatchWorker({
      config: {
        claimLeaseSeconds: 60,
        concurrency: 1,
        databaseFailureBackoffMaxMs: 100,
        databaseFailureBackoffMinMs: 10,
        drainTimeoutMs: 100,
        idlePollIntervalMs: 5,
      },
      database,
      logger: { log: vi.fn() },
      metrics,
    })

    const cycle = worker.runCycle()
    await vi.waitFor(() => {
      expect(database.checkReadiness).toHaveBeenCalledTimes(1)
    })
    const shutdown = worker.shutdown()
    finishReadiness?.()

    await expect(cycle).resolves.toEqual({
      claimed: 0,
      databaseReady: false,
    })
    await expect(shutdown).resolves.toEqual({ drained: true })
    expect(database.claimItems).not.toHaveBeenCalled()
    expect(metrics.snapshot().databaseReady).toBe(false)
  })
})

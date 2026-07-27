import { once } from 'node:events'
import { describe, expect, test } from 'vitest'
import { startApprovalBatchWorkerHealthServer } from './health-server'
import { createPrivacySafeLogger } from './logger'
import { ApprovalBatchWorkerMetrics } from './metrics'

describe('approval batch worker observability', () => {
  test('emits only allow-listed structured log fields', () => {
    const lines: string[] = []
    const logger = createPrivacySafeLogger({
      workerInstanceId: 'worker-opaque-1',
      write: (line) => lines.push(line),
    })

    logger.log({
      attemptNumber: 2,
      batchItemId: '11111111-1111-4111-8111-111111111111',
      durationMs: 25,
      event: 'item_finished',
      level: 'info',
      outcomeCode: 'QC_BLOCKED',
    })

    expect(lines).toHaveLength(1)
    const entry = JSON.parse(lines[0]) as Record<string, unknown>
    expect(Object.keys(entry).sort()).toEqual([
      'attemptNumber',
      'batchItemId',
      'durationMs',
      'event',
      'level',
      'outcomeCode',
      'timestamp',
      'workerInstanceId',
    ])
    expect(JSON.stringify(entry)).not.toMatch(
      /patient|client|sample.?code|result.?value|note|otp|signature|token|password/i
    )
  })

  test('tracks full-claim saturation, retries, expired leases, and outcomes', () => {
    let nowMs = Date.parse('2026-07-27T01:00:00.000Z')
    const metrics = new ApprovalBatchWorkerMetrics(() => nowMs)

    metrics.recordClaimBatch({
      claimedItems: [
        {
          attemptNumber: 1,
          batchItemId: '11111111-1111-4111-8111-111111111111',
          claimExpiresAt: new Date(nowMs + 4_000),
        },
        {
          attemptNumber: 2,
          batchItemId: '22222222-2222-4222-8222-222222222222',
          claimExpiresAt: new Date(nowMs + 4_000),
        },
      ],
      requestedCount: 2,
    })
    nowMs += 5_000
    metrics.recordOutcome({
      outcomeCode: 'ITEM_ALREADY_SUCCEEDED',
      replayed: true,
      success: true,
    })

    expect(metrics.snapshot()).toMatchObject({
      claimedTotal: 2,
      continuousFullClaimSaturationSeconds: 5,
      postCommitLeaseReplayRecoveriesTotal: 1,
      retryClaimsTotal: 1,
      staleInFlightLeases: 2,
      succeededTotal: 1,
    })
    expect(metrics.toPrometheus()).toContain(
      'approval_batch_worker_continuous_full_claim_saturation_seconds 5'
    )
    metrics.recordItemFinished(
      '11111111-1111-4111-8111-111111111111'
    )
    expect(metrics.snapshot().staleInFlightLeases).toBe(1)
  })

  test('keeps liveness healthy while database readiness is unhealthy', async () => {
    const metrics = new ApprovalBatchWorkerMetrics()
    metrics.setDatabaseReady(false)
    const server = startApprovalBatchWorkerHealthServer({
      host: '127.0.0.1',
      metrics,
      port: 0,
    })
    await once(server, 'listening')

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Expected an ephemeral TCP address')
    }
    const baseUrl = `http://127.0.0.1:${address.port}`

    const liveResponse = await fetch(`${baseUrl}/live`)
    const readyResponse = await fetch(`${baseUrl}/ready`)
    const metricsResponse = await fetch(`${baseUrl}/metrics`)

    expect(liveResponse.status).toBe(200)
    expect(await liveResponse.json()).toEqual({ status: 'live' })
    expect(readyResponse.status).toBe(503)
    expect(await readyResponse.json()).toEqual({
      databaseReady: false,
      status: 'not_ready',
    })
    expect(metricsResponse.status).toBe(200)
    expect(await metricsResponse.text()).toContain(
      'approval_batch_worker_database_ready 0'
    )

    metrics.setDatabaseReady(true)
    expect((await fetch(`${baseUrl}/ready`)).status).toBe(200)
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  })
})

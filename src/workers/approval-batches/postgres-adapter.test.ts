import { beforeEach, describe, expect, test, vi } from 'vitest'

const poolQuery = vi.hoisted(() => vi.fn())
const poolEnd = vi.hoisted(() => vi.fn())
const poolOn = vi.hoisted(() => vi.fn())
const Pool = vi.hoisted(() =>
  vi.fn(function MockPool() {
    return {
      end: poolEnd,
      on: poolOn,
      query: poolQuery,
    }
  })
)

vi.mock('pg', () => ({ Pool }))

import { createPostgresApprovalBatchWorkerDatabase } from './postgres-adapter'

describe('direct PostgreSQL approval batch worker adapter', () => {
  beforeEach(() => {
    Pool.mockClear()
    poolEnd.mockReset().mockResolvedValue(undefined)
    poolOn.mockReset()
    poolQuery.mockReset()
  })

  test('creates a bounded pool with acquire and query deadlines', () => {
    createPostgresApprovalBatchWorkerDatabase({
      applicationName: 'approval-worker-opaque-1',
      database: 'postgres',
      host: 'postgres',
      operationTimeoutMs: 10_000,
      password: 'protected-secret',
      poolMax: 8,
      port: 5432,
      user: 'approval_batch_worker',
    })

    expect(Pool).toHaveBeenCalledWith({
      application_name: 'approval-worker-opaque-1',
      connectionTimeoutMillis: 10_000,
      database: 'postgres',
      host: 'postgres',
      idleTimeoutMillis: 30_000,
      max: 8,
      maxLifetimeSeconds: 300,
      password: 'protected-secret',
      port: 5432,
      query_timeout: 10_000,
      statement_timeout: 10_000,
      user: 'approval_batch_worker',
    })
    expect(poolOn).toHaveBeenCalledWith('error', expect.any(Function))
  })

  test('calls only the narrow claim RPC with bounded parameters', async () => {
    poolQuery.mockResolvedValueOnce({
      rows: [
        {
          attempt_number: 1,
          batch_item_id: '11111111-1111-4111-8111-111111111111',
          claim_expires_at: '2026-07-27T01:01:00.000Z',
          claim_token: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
      ],
    })
    const database = createPostgresApprovalBatchWorkerDatabase({
      applicationName: 'approval-worker-opaque-1',
      database: 'postgres',
      host: 'postgres',
      operationTimeoutMs: 10_000,
      password: 'protected-secret',
      poolMax: 8,
      port: 5432,
      user: 'approval_batch_worker',
    })

    await expect(database.claimItems(3, 60)).resolves.toEqual([
      {
        attemptNumber: 1,
        batchItemId: '11111111-1111-4111-8111-111111111111',
        claimExpiresAt: new Date('2026-07-27T01:01:00.000Z'),
        claimToken: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
    ])
    expect(poolQuery).toHaveBeenCalledWith({
      name: 'approval-batch-worker-claim',
      text: expect.stringMatching(
        /claim_approval_batch_items_worker\(\$1, \$2\)/
      ),
      values: [3, 60],
    })
  })

  test('reads only privacy-safe worker queue observability', async () => {
    poolQuery.mockResolvedValueOnce({
      rows: [
        {
          observed_at: '2026-07-27T07:00:00.000Z',
          oldest_eligible_queue_age_seconds: '42.5',
        },
      ],
    })
    const database = createPostgresApprovalBatchWorkerDatabase({
      applicationName: 'approval-worker-opaque-1',
      database: 'postgres',
      host: 'postgres',
      operationTimeoutMs: 10_000,
      password: 'protected-secret',
      poolMax: 8,
      port: 5432,
      user: 'approval_batch_worker',
    })

    await expect(database.observeQueue()).resolves.toEqual({
      observedAt: new Date('2026-07-27T07:00:00.000Z'),
      oldestEligibleQueueAgeSeconds: 42.5,
    })
    expect(poolQuery).toHaveBeenCalledWith({
      name: 'approval-batch-worker-observability',
      text: expect.stringMatching(
        /get_approval_batch_worker_observability\(\)/
      ),
    })
  })

  test('executes only by item identity and claim token', async () => {
    poolQuery.mockResolvedValueOnce({
      rows: [
        {
          outcome: {
            batch_item_id: '11111111-1111-4111-8111-111111111111',
            outcome_code: 'APPROVED',
            replayed: false,
            success: true,
          },
        },
      ],
    })
    const database = createPostgresApprovalBatchWorkerDatabase({
      applicationName: 'approval-worker-opaque-1',
      database: 'postgres',
      host: 'postgres',
      operationTimeoutMs: 10_000,
      password: 'protected-secret',
      poolMax: 8,
      port: 5432,
      user: 'approval_batch_worker',
    })

    await expect(
      database.executeItem(
        '11111111-1111-4111-8111-111111111111',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      )
    ).resolves.toMatchObject({
      batchItemId: '11111111-1111-4111-8111-111111111111',
      outcomeCode: 'APPROVED',
      success: true,
    })
    expect(poolQuery).toHaveBeenCalledWith({
      name: 'approval-batch-worker-execute',
      text: expect.stringMatching(
        /execute_approval_batch_item_worker\(\$1, \$2\)/
      ),
      values: [
        '11111111-1111-4111-8111-111111111111',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ],
    })
  })

  test('uses a non-mutating readiness probe and closes the pool', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [{ ready: 1 }] })
    const database = createPostgresApprovalBatchWorkerDatabase({
      applicationName: 'approval-worker-opaque-1',
      database: 'postgres',
      host: 'postgres',
      operationTimeoutMs: 10_000,
      password: 'protected-secret',
      poolMax: 8,
      port: 5432,
      user: 'approval_batch_worker',
    })

    await expect(database.checkReadiness()).resolves.toBeUndefined()
    expect(poolQuery).toHaveBeenCalledWith({
      name: 'approval-batch-worker-readiness',
      text: 'SELECT 1 AS ready',
    })
    await database.close()
    expect(poolEnd).toHaveBeenCalledTimes(1)
  })
})

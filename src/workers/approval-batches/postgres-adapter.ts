/**
 * Direct node-postgres adapter restricted to the P5 worker RPC boundary.
 */
import { Pool } from 'pg'
import { z } from 'zod'
import type {
  ApprovalBatchWorkerDatabase,
  ClaimedApprovalBatchItem,
  ExecutionOutcome,
} from './contracts'

const ClaimRowSchema = z.object({
  attempt_number: z.coerce.number().int().min(1).max(3),
  batch_item_id: z.string().uuid(),
  claim_expires_at: z.coerce.date(),
  claim_token: z.string().uuid(),
})

const ExecutionOutcomeSchema = z
  .object({
    batch_item_id: z.string().uuid().optional(),
    outcome_code: z.string().trim().min(1).max(128),
    replayed: z.boolean().optional().default(false),
    success: z.boolean(),
    terminal: z.boolean().optional().default(false),
  })
  .passthrough()

interface PostgresAdapterConfig {
  applicationName: string
  database: string
  host: string
  onPoolError?: (outcomeCode: string) => void
  operationTimeoutMs: number
  password: string
  poolMax: number
  port: number
  user: 'approval_batch_worker'
}

export function createPostgresApprovalBatchWorkerDatabase(
  config: PostgresAdapterConfig
): ApprovalBatchWorkerDatabase {
  const pool = new Pool({
    application_name: config.applicationName,
    connectionTimeoutMillis: config.operationTimeoutMs,
    database: config.database,
    host: config.host,
    idleTimeoutMillis: 30_000,
    max: config.poolMax,
    maxLifetimeSeconds: 300,
    password: config.password,
    port: config.port,
    query_timeout: config.operationTimeoutMs,
    statement_timeout: config.operationTimeoutMs,
    user: config.user,
  })

  pool.on('error', () => {
    config.onPoolError?.('DATABASE_UNAVAILABLE')
  })

  return {
    async checkReadiness() {
      await pool.query({
        name: 'approval-batch-worker-readiness',
        text: 'SELECT 1 AS ready',
      })
    },

    async claimItems(claimLimit, leaseSeconds) {
      const result = await pool.query({
        name: 'approval-batch-worker-claim',
        text: `
          SELECT *
          FROM public.claim_approval_batch_items_worker($1, $2)
        `,
        values: [claimLimit, leaseSeconds],
      })

      return result.rows.map(parseClaimedItem)
    },

    async close() {
      await pool.end()
    },

    async executeItem(batchItemId, claimToken) {
      const result = await pool.query({
        name: 'approval-batch-worker-execute',
        text: `
          SELECT public.execute_approval_batch_item_worker($1, $2) AS outcome
        `,
        values: [batchItemId, claimToken],
      })
      const row = z.object({ outcome: z.unknown() }).parse(result.rows[0])
      return parseExecutionOutcome(row.outcome)
    },
  }
}

function parseClaimedItem(row: unknown): ClaimedApprovalBatchItem {
  const parsed = ClaimRowSchema.parse(row)
  return {
    attemptNumber: parsed.attempt_number,
    batchItemId: parsed.batch_item_id,
    claimExpiresAt: parsed.claim_expires_at,
    claimToken: parsed.claim_token,
  }
}

function parseExecutionOutcome(value: unknown): ExecutionOutcome {
  const parsed = ExecutionOutcomeSchema.parse(value)
  return {
    batchItemId: parsed.batch_item_id,
    outcomeCode: parsed.outcome_code,
    replayed: parsed.replayed,
    success: parsed.success,
    terminal: parsed.terminal,
  }
}

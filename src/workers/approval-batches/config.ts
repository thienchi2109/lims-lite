/**
 * Strict environment parsing for the standalone worker process.
 * The database password is accepted only through a protected file.
 */
import { readFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { z } from 'zod'

const DEDICATED_DATABASE_USER = 'approval_batch_worker'

const EnvironmentSchema = z
  .object({
    claimLeaseSeconds: z.coerce.number().int().min(5).max(900).default(60),
    concurrency: z.coerce.number().int().min(1).max(16).default(8),
    database: z.object({
      database: z.string().trim().min(1).default('postgres'),
      host: z.string().trim().min(1).default('postgres'),
      passwordFile: z.string().trim().min(1),
      port: z.coerce.number().int().min(1).max(65_535).default(5432),
      user: z.literal(DEDICATED_DATABASE_USER).default(DEDICATED_DATABASE_USER),
    }),
    databaseFailureBackoffMaxMs: z.coerce
      .number()
      .int()
      .min(100)
      .max(60_000)
      .default(5_000),
    databaseFailureBackoffMinMs: z.coerce
      .number()
      .int()
      .min(50)
      .max(10_000)
      .default(250),
    databaseOperationTimeoutMs: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(24_000)
      .default(10_000),
    drainTimeoutMs: z.coerce
      .number()
      .int()
      .min(2_000)
      .max(25_000)
      .default(25_000),
    healthHost: z.string().trim().min(1).default('0.0.0.0'),
    healthPort: z.coerce.number().int().min(1).max(65_535).default(8081),
    idlePollIntervalMs: z.coerce
      .number()
      .int()
      .min(50)
      .max(60_000)
      .default(1_000),
    workerInstanceId: z.string().trim().min(1).max(128),
  })
  .superRefine((config, context) => {
    if (config.databaseOperationTimeoutMs >= config.drainTimeoutMs) {
      context.addIssue({
        code: 'custom',
        message: 'Drain timeout must exceed the database operation timeout',
        path: ['drainTimeoutMs'],
      })
    }
  })

type WorkerEnvironment = Record<string, string | undefined>

export interface ApprovalBatchWorkerConfig {
  claimLeaseSeconds: number
  concurrency: number
  database: {
    database: string
    host: string
    password: string
    port: number
    user: typeof DEDICATED_DATABASE_USER
  }
  databaseFailureBackoffMaxMs: number
  databaseFailureBackoffMinMs: number
  databaseOperationTimeoutMs: number
  drainTimeoutMs: number
  healthHost: string
  healthPort: number
  idlePollIntervalMs: number
  poolMax: number
  workerInstanceId: string
}

export function parseApprovalBatchWorkerConfig(
  environment: WorkerEnvironment = process.env
): ApprovalBatchWorkerConfig {
  if (environment.APPROVAL_BATCH_WORKER_DATABASE_PASSWORD !== undefined) {
    throw new Error(
      'Database credentials must use the protected password file configuration'
    )
  }

  const parsed = EnvironmentSchema.parse({
    claimLeaseSeconds:
      environment.APPROVAL_BATCH_WORKER_CLAIM_LEASE_SECONDS,
    concurrency: environment.APPROVAL_BATCH_WORKER_CONCURRENCY,
    database: {
      database: environment.APPROVAL_BATCH_WORKER_DATABASE_NAME,
      host: environment.APPROVAL_BATCH_WORKER_DATABASE_HOST,
      passwordFile:
        environment.APPROVAL_BATCH_WORKER_DATABASE_PASSWORD_FILE,
      port: environment.APPROVAL_BATCH_WORKER_DATABASE_PORT,
      user: environment.APPROVAL_BATCH_WORKER_DATABASE_USER,
    },
    databaseFailureBackoffMaxMs:
      environment.APPROVAL_BATCH_WORKER_DATABASE_BACKOFF_MAX_MS,
    databaseFailureBackoffMinMs:
      environment.APPROVAL_BATCH_WORKER_DATABASE_BACKOFF_MIN_MS,
    databaseOperationTimeoutMs:
      environment.APPROVAL_BATCH_WORKER_DATABASE_OPERATION_TIMEOUT_MS,
    drainTimeoutMs: environment.APPROVAL_BATCH_WORKER_DRAIN_TIMEOUT_MS,
    healthHost: environment.APPROVAL_BATCH_WORKER_HEALTH_HOST,
    healthPort: environment.APPROVAL_BATCH_WORKER_HEALTH_PORT,
    idlePollIntervalMs:
      environment.APPROVAL_BATCH_WORKER_IDLE_POLL_INTERVAL_MS,
    workerInstanceId:
      environment.APPROVAL_BATCH_WORKER_INSTANCE_ID ?? hostname(),
  })
  const password = readFileSync(parsed.database.passwordFile, 'utf8').trim()

  if (!password) {
    throw new Error('Database password file must contain a non-empty credential')
  }

  return {
    claimLeaseSeconds: parsed.claimLeaseSeconds,
    concurrency: parsed.concurrency,
    database: {
      database: parsed.database.database,
      host: parsed.database.host,
      password,
      port: parsed.database.port,
      user: parsed.database.user,
    },
    databaseFailureBackoffMaxMs: parsed.databaseFailureBackoffMaxMs,
    databaseFailureBackoffMinMs: parsed.databaseFailureBackoffMinMs,
    databaseOperationTimeoutMs: parsed.databaseOperationTimeoutMs,
    drainTimeoutMs: parsed.drainTimeoutMs,
    healthHost: parsed.healthHost,
    healthPort: parsed.healthPort,
    idlePollIntervalMs: parsed.idlePollIntervalMs,
    poolMax: parsed.concurrency,
    workerInstanceId: parsed.workerInstanceId,
  }
}

/**
 * Standalone process wiring for the dark approval-batch worker.
 */
import { once } from 'node:events'
import type { Server } from 'node:http'
import { parseApprovalBatchWorkerConfig } from './config'
import { startApprovalBatchWorkerHealthServer } from './health-server'
import {
  classifyDatabaseError,
  createPrivacySafeLogger,
} from './logger'
import { ApprovalBatchWorkerMetrics } from './metrics'
import { createPostgresApprovalBatchWorkerDatabase } from './postgres-adapter'
import { ApprovalBatchWorker } from './worker'

export async function runApprovalBatchWorkerRuntime() {
  const config = parseApprovalBatchWorkerConfig()
  const logger = createPrivacySafeLogger({
    workerInstanceId: config.workerInstanceId,
  })
  const metrics = new ApprovalBatchWorkerMetrics()
  const database = createPostgresApprovalBatchWorkerDatabase({
    applicationName: config.workerInstanceId,
    ...config.database,
    onPoolError(outcomeCode) {
      metrics.setDatabaseReady(false)
      metrics.recordDatabaseOperationError()
      logger.log({
        event: 'database_pool_error',
        level: 'error',
        outcomeCode,
      })
    },
    operationTimeoutMs: config.databaseOperationTimeoutMs,
    poolMax: config.poolMax,
  })
  const worker = new ApprovalBatchWorker({
    config,
    database,
    logger,
    metrics,
  })
  const healthServer = startApprovalBatchWorkerHealthServer({
    host: config.healthHost,
    metrics,
    port: config.healthPort,
  })
  await once(healthServer, 'listening')

  const signalRegistration = registerShutdownSignals({
    forceExitAfterMs: config.drainTimeoutMs + 1_000,
    logger,
    shutdown: worker.shutdown.bind(worker),
  })
  logger.log({ event: 'worker_started', level: 'info' })

  try {
    await worker.run()
  } catch (error) {
    logger.log({
      event: 'worker_runtime_failed',
      level: 'error',
      outcomeCode: classifyDatabaseError(error),
    })
    process.exitCode = 1
  } finally {
    signalRegistration.remove()
    const shutdown = await worker.shutdown()
    await closeServer(healthServer)
    await database.close()
    signalRegistration.clearForceExit()
    if (!shutdown.drained) {
      process.exitCode = 1
    }
  }
}

function registerShutdownSignals(input: {
  forceExitAfterMs: number
  logger: ReturnType<typeof createPrivacySafeLogger>
  shutdown: () => Promise<{ drained: boolean }>
}) {
  const handlers = new Map<NodeJS.Signals, () => void>()
  let forceExitTimer: NodeJS.Timeout | undefined
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    const handler = () => {
      forceExitTimer ??= setTimeout(() => {
        input.logger.log({
          event: 'worker_forced_exit',
          level: 'error',
          outcomeCode: 'DRAIN_TIMEOUT',
        })
        process.exit(1)
      }, input.forceExitAfterMs)
      void input.shutdown().then((result) => {
        if (!result.drained) {
          process.exitCode = 1
        }
      })
    }
    handlers.set(signal, handler)
    process.once(signal, handler)
  }

  return {
    clearForceExit() {
      if (forceExitTimer) {
        clearTimeout(forceExitTimer)
      }
    },
    remove() {
      for (const [signal, handler] of handlers) {
        process.removeListener(signal, handler)
      }
    },
  }
}

async function closeServer(server: Server) {
  if (!server.listening) {
    return
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

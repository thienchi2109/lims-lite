import { runApprovalBatchWorkerRuntime } from './runtime'

void runApprovalBatchWorkerRuntime().catch(() => {
  console.error(
    JSON.stringify({
      event: 'worker_startup_failed',
      level: 'error',
      outcomeCode: 'WORKER_STARTUP_FAILED',
      timestamp: new Date().toISOString(),
    })
  )
  process.exitCode = 1
})

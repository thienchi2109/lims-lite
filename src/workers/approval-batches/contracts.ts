/**
 * Runtime-only contracts for the dark approval-batch worker.
 * These types intentionally contain no web, session, or manager credential data.
 */
export interface ClaimedApprovalBatchItem {
  attemptNumber: number
  batchItemId: string
  claimExpiresAt: Date
  claimToken: string
}

export interface ExecutionOutcome {
  batchItemId?: string
  outcomeCode: string
  replayed: boolean
  success: boolean
  terminal: boolean
}

export interface ApprovalBatchWorkerDatabase {
  checkReadiness(): Promise<void>
  claimItems(
    claimLimit: number,
    leaseSeconds: number
  ): Promise<ClaimedApprovalBatchItem[]>
  close(): Promise<void>
  executeItem(batchItemId: string, claimToken: string): Promise<ExecutionOutcome>
}

export type WorkerLogLevel = 'error' | 'info' | 'warn'

export interface PrivacySafeLogEntry {
  attemptNumber?: number
  batchItemId?: string
  claimCount?: number
  durationMs?: number
  event: string
  inFlight?: number
  level: WorkerLogLevel
  outcomeCode?: string
}

export interface PrivacySafeLogger {
  log(entry: PrivacySafeLogEntry): void
}

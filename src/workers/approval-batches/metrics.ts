/**
 * In-process operational metrics. Database audit tables remain authoritative.
 */
import type { ExecutionOutcome } from './contracts'

export interface WorkerMetricsSnapshot {
  claimedTotal: number
  continuousFullClaimSaturationSeconds: number
  databaseOperationErrorsTotal: number
  databaseReady: boolean
  failedTotal: number
  inFlight: number
  outcomes: Record<string, number>
  postCommitLeaseReplayRecoveriesTotal: number
  retryClaimsTotal: number
  staleInFlightLeases: number
  succeededTotal: number
}

export class ApprovalBatchWorkerMetrics {
  private claimedTotal = 0
  private fullClaimSaturationStartedAtMs: number | null = null
  private databaseOperationErrorsTotal = 0
  private databaseReady = false
  private failedTotal = 0
  private inFlight = 0
  private readonly inFlightLeaseExpirations = new Map<string, number>()
  private readonly outcomes = new Map<string, number>()
  private postCommitLeaseReplayRecoveriesTotal = 0
  private retryClaimsTotal = 0
  private succeededTotal = 0

  constructor(private readonly now: () => number = Date.now) {}

  isDatabaseReady() {
    return this.databaseReady
  }

  recordClaimBatch(input: {
    claimedItems: Array<{
      attemptNumber: number
      batchItemId: string
      claimExpiresAt: Date
    }>
    requestedCount: number
  }) {
    this.claimedTotal += input.claimedItems.length
    this.retryClaimsTotal += input.claimedItems.filter(
      (item) => item.attemptNumber > 1
    ).length
    for (const item of input.claimedItems) {
      this.inFlightLeaseExpirations.set(
        item.batchItemId,
        item.claimExpiresAt.getTime()
      )
    }

    if (
      input.requestedCount > 0 &&
      input.claimedItems.length === input.requestedCount
    ) {
      this.fullClaimSaturationStartedAtMs ??= this.now()
    } else {
      this.fullClaimSaturationStartedAtMs = null
    }
  }

  recordDatabaseOperationError() {
    this.databaseOperationErrorsTotal += 1
  }

  recordClaimCycleInterrupted() {
    this.fullClaimSaturationStartedAtMs = null
  }

  recordItemFinished(batchItemId: string) {
    this.inFlightLeaseExpirations.delete(batchItemId)
  }

  recordOutcome(outcome: Pick<
    ExecutionOutcome,
    'outcomeCode' | 'replayed' | 'success'
  >) {
    this.outcomes.set(
      outcome.outcomeCode,
      (this.outcomes.get(outcome.outcomeCode) ?? 0) + 1
    )
    if (outcome.success) {
      this.succeededTotal += 1
    } else {
      this.failedTotal += 1
    }
    if (
      outcome.replayed &&
      outcome.outcomeCode === 'ITEM_ALREADY_SUCCEEDED'
    ) {
      this.postCommitLeaseReplayRecoveriesTotal += 1
    }
  }

  setDatabaseReady(ready: boolean) {
    this.databaseReady = ready
  }

  setInFlight(count: number) {
    this.inFlight = count
  }

  snapshot(): WorkerMetricsSnapshot {
    return {
      claimedTotal: this.claimedTotal,
      continuousFullClaimSaturationSeconds:
        this.continuousFullClaimSaturationSeconds(),
      databaseOperationErrorsTotal: this.databaseOperationErrorsTotal,
      databaseReady: this.databaseReady,
      failedTotal: this.failedTotal,
      inFlight: this.inFlight,
      outcomes: Object.fromEntries(this.outcomes),
      postCommitLeaseReplayRecoveriesTotal:
        this.postCommitLeaseReplayRecoveriesTotal,
      retryClaimsTotal: this.retryClaimsTotal,
      staleInFlightLeases: this.staleInFlightLeases(),
      succeededTotal: this.succeededTotal,
    }
  }

  toPrometheus() {
    const snapshot = this.snapshot()
    const lines = [
      metric('approval_batch_worker_database_ready', snapshot.databaseReady ? 1 : 0),
      metric('approval_batch_worker_in_flight', snapshot.inFlight),
      metric('approval_batch_worker_claimed_total', snapshot.claimedTotal),
      metric('approval_batch_worker_retry_claims_total', snapshot.retryClaimsTotal),
      metric(
        'approval_batch_worker_stale_in_flight_leases',
        snapshot.staleInFlightLeases
      ),
      metric(
        'approval_batch_worker_post_commit_lease_replay_recoveries_total',
        snapshot.postCommitLeaseReplayRecoveriesTotal
      ),
      metric('approval_batch_worker_succeeded_total', snapshot.succeededTotal),
      metric('approval_batch_worker_failed_total', snapshot.failedTotal),
      metric(
        'approval_batch_worker_database_operation_errors_total',
        snapshot.databaseOperationErrorsTotal
      ),
      metric(
        'approval_batch_worker_continuous_full_claim_saturation_seconds',
        snapshot.continuousFullClaimSaturationSeconds
      ),
    ]

    for (const [outcomeCode, count] of Object.entries(snapshot.outcomes).sort()) {
      lines.push(
        `approval_batch_worker_outcomes_total{outcome_code="${escapeLabel(
          outcomeCode
        )}"} ${count}`
      )
    }
    return `${lines.join('\n')}\n`
  }

  private continuousFullClaimSaturationSeconds() {
    if (this.fullClaimSaturationStartedAtMs === null) {
      return 0
    }
    return Math.max(
      0,
      (this.now() - this.fullClaimSaturationStartedAtMs) / 1_000
    )
  }

  private staleInFlightLeases() {
    const now = this.now()
    return [...this.inFlightLeaseExpirations.values()].filter(
      (expiresAt) => expiresAt <= now
    ).length
  }
}

function metric(name: string, value: number) {
  return `${name} ${value}`
}

function escapeLabel(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

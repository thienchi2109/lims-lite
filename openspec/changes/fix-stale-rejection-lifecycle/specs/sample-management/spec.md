## ADDED Requirements

### Requirement: Rejection data lifecycle management

The system SHALL clear sample rejection metadata (`rejection_reason`, `rejected_at`, `rejected_by`) when a sample re-enters the approval workflow, ensuring stale rejection data is never displayed on samples that have progressed past the rejection event.

Audit trail integrity is preserved because the original rejection event is recorded in `audit_logs` via `trigger_audit_log()` and in the `sample_submissions.superseded_by` chain.

#### Scenario: Analyst re-submits a previously rejected sample

- **GIVEN** a sample that was rejected by a manager (status = `in_progress`, `rejection_reason` is set)
- **WHEN** the analyst calls `submitSampleForReview()` RPC
- **THEN** the system SHALL set `rejection_reason = NULL`, `rejected_at = NULL`, `rejected_by = NULL`
- **AND** set `status = 'review'`, `updated_at = NOW()`
- **AND** the original rejection data SHALL remain in `audit_logs`

#### Scenario: Manager approves all results and sample completes

- **GIVEN** a sample in `review` status with stale `rejection_reason` from a prior rejection cycle
- **WHEN** all results are approved and `approveResults()` sets status to `completed`
- **THEN** the system SHALL clear `rejection_reason`, `rejected_at`, `rejected_by` on the sample
- **AND** the completed sample detail panel SHALL NOT display a rejection banner

#### Scenario: Completed sample displays no rejection banner

- **GIVEN** a sample with status = `completed`
- **WHEN** the sample detail panel renders
- **THEN** the rejection banner SHALL NOT be displayed, regardless of any residual rejection field values

### Requirement: Approval status guard

The system SHALL only allow `approveResults()` to proceed when the sample is in `review` status, enforcing that the analyst's e-signature submission flow (`submitSampleForReview`) cannot be bypassed.

#### Scenario: Manager attempts to approve results on a non-review sample

- **GIVEN** a sample with status = `in_progress` (not yet submitted for review)
- **WHEN** a manager calls `approveResults()` for results in that sample
- **THEN** the system SHALL return an error: "Can only approve results for samples under review"
- **AND** no result status changes SHALL occur

#### Scenario: Manager approves results on a review sample

- **GIVEN** a sample with status = `review`
- **WHEN** a manager calls `approveResults()` for entered results in that sample
- **THEN** the approval SHALL proceed normally

### Requirement: Discardable statuses include in_progress

The system SHALL allow managers to discard samples in `in_progress` status, enabling the discard action after a rejection without requiring the analyst to re-submit for review first.

#### Scenario: Manager discards a rejected sample

- **GIVEN** a sample that was rejected (status = `in_progress` after `rejectSample()`)
- **WHEN** the manager calls `discardSample()` with a reason
- **THEN** the system SHALL set status to `discarded`
- **AND** record the discard reason, timestamp, and actor

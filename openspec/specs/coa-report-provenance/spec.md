# coa-report-provenance Specification

## Purpose
TBD - created by archiving change add-result-review-coa-draft. Update Purpose after archive.
## Requirements
### Requirement: Phase 4 final CoA uses an immutable approved submission source

For reports created after this phase, the system SHALL persist the approved
submission as `coa_reports.source_submission_id` before generating the final
CoA. Final rendering, retry, and regeneration SHALL resolve assessment snapshots
and reference ranges through that immutable source.

Reports created before this phase MAY use the existing assay-range fallback only
when `source_submission_id` is absent.

#### Scenario: Reference range changes after submission

- **WHEN** an assay reference range changes after a reviewed submission and a
  later final CoA is generated from that approved submission
- **THEN** the CoA shows the range stored in that submission's snapshot
- **THEN** the report records that submission as its immutable source

#### Scenario: Rejected submission is replaced before approval

- **WHEN** a manager rejects one reviewed submission and the analyst later
  submits a revised result set that is approved
- **THEN** the final CoA source references the approved revised submission
- **THEN** the rejected submission and its snapshots remain unchanged

#### Scenario: Failed CoA generation is retried

- **WHEN** CoA generation fails after a report source has been persisted and a
  later retry is requested
- **THEN** the retry uses the report's existing source submission
- **THEN** it does not substitute a later submission for the same sample

#### Scenario: CoA report source cannot be rebound

- **WHEN** an application path attempts to update a populated
  `source_submission_id`
- **THEN** the database rejects the change
- **THEN** the report remains bound to its original approved submission


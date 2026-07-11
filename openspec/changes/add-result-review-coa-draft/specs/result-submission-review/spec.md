## ADDED Requirements

### Requirement: Phase 1 submission atomically records assessment snapshots

The system SHALL require a complete assessment payload when the
assessment-aware submission contract is used. The server SHALL independently
load and lock the sample's results and assay data, validate the current role,
ownership, signature, sample status, result completeness, payload result set,
assessment values, and reviewed revision tokens before creating records.

On success, the system SHALL create one signed `sample_submissions` record and
one immutable assessment snapshot per submitted result in the same transaction,
then transition the sample to `review`. Each snapshot SHALL link to its
submission and result and preserve the analyst identity, assessment time, assay
name, entered result value, unit, method, and displayed reference range.

The server SHALL construct snapshot display data from server-loaded rows, not
browser-supplied display values.

#### Scenario: Complete reviewed submission succeeds

- **WHEN** an authorized analyst submits every current result exactly once with
  an allowed assessment and matching revision data
- **THEN** the system atomically creates one signed submission and one snapshot
  per result
- **THEN** the sample transitions to `review`
- **THEN** every stored snapshot reflects the locked database result and assay
  data shown for that submission

#### Scenario: Missing, duplicate, foreign, invalid, or stale assessment fails closed

- **WHEN** an assessment payload is incomplete, duplicated, references a result
  outside the sample, contains an invalid assessment, or has stale revision data
- **THEN** the system rejects the request without creating a submission or
  snapshot
- **THEN** the sample status remains unchanged

### Requirement: Phase 1 assessment history is immutable and authorization-scoped

The system SHALL store assessment snapshots in an append-only audited relation.
Only the secure submission workflow SHALL create snapshot rows. Analysts MAY
read snapshots from their own submissions, and managers MAY read snapshots only
within their existing approval scope.

#### Scenario: Analyst cannot directly alter an assessment record

- **WHEN** an analyst attempts a direct insert, update, or delete against an
  assessment snapshot
- **THEN** database authorization denies the write
- **THEN** the original snapshot remains unchanged

#### Scenario: Rework and resubmission preserve prior assessment history

- **WHEN** a manager rejects a submission, the analyst revises results, and the
  analyst submits the sample again with a complete reviewed assessment payload
- **THEN** the system creates a new signed submission and a new complete
  snapshot set
- **THEN** prior submissions and their snapshots remain immutable and linked to
  their original submission history

### Requirement: Phase 2 draft uses the canonical CoA template without duplication

The system SHALL render the pre-submission draft through the canonical CoA
template and shared presentation helpers. Draft-specific behavior SHALL be
limited to the watermark, suppressed final certification content, an optional
assessment result cell, and review-footer controls.

The system SHALL NOT create a copied or parallel renderer that independently
implements CoA markup, section layout, result grouping, styles, escaping, or
data mapping.

#### Scenario: Draft CoA is rendered for analyst review

- **WHEN** an authorized analyst opens draft review for a sample with complete
  result values
- **THEN** the system renders the canonical CoA document structure in draft mode
- **THEN** the draft shows `BẢN NHÁP - CHƯA GỬI DUYỆT`
- **THEN** the draft omits signatures, manager approval information, and an
  approval date

### Requirement: Phase 2 analyst reviews a draft CoA before submitting a sample

The system SHALL show the sample details and each submitted result's value,
unit, method, and configured reference range before an analyst submits the
sample for review.

#### Scenario: Analyst opens the pre-submission draft

- **WHEN** an authorized analyst selects `Gửi phê duyệt` for a sample whose
  required results have values
- **THEN** the system displays the draft CoA review dialog with the complete
  result context and configured reference ranges

#### Scenario: Analyst returns to editing from the draft

- **WHEN** an analyst closes the draft dialog or returns to editing before
  confirming submission
- **THEN** the system leaves sample and result states unchanged
- **THEN** the system creates no submission, assessment, CoA report, stored
  document, document hash, or audit event

### Requirement: Phase 2 analyst records a manual assessment for every result

The draft SHALL require the analyst to choose exactly one visible manual
assessment, `within_reference` or `outside_reference`, for every displayed
result. The system SHALL NOT preselect, derive, color-classify, or otherwise
determine the conclusion.

#### Scenario: Unassessed result blocks submission

- **WHEN** the draft has one or more results without a manual assessment
- **THEN** `Gửi phê duyệt` remains disabled
- **THEN** no submission mutation is attempted

#### Scenario: Analyst completes all assessments

- **WHEN** the analyst selects one allowed manual assessment for every result
- **THEN** `Gửi phê duyệt` becomes available
- **THEN** the client sends the reviewed identifiers, assessments, and revision
  tokens through the assessment-aware submission contract

### Requirement: Phase 2 draft review remains an ephemeral document

Opening or leaving a draft SHALL not persist a draft CoA lifecycle state,
`coa_reports` row, document hash, stored document, or audit event.

#### Scenario: Analyst reviews without confirming

- **WHEN** an analyst opens a draft, reads results and ranges, and leaves the
  dialog without confirming
- **THEN** no persistent document or workflow artifact is created
- **THEN** the sample remains in its prior status

### Requirement: Phase 3 managers review submitted assessments

The manager approval detail SHALL show each immutable snapshot's assessment,
value, unit, method, and reference range for the submission being reviewed. The
system SHALL display the recorded conclusion and SHALL NOT recalculate it.

#### Scenario: Manager sees the analyst's submitted conclusions

- **WHEN** a manager opens approval detail for a reviewed sample submitted
  through the assessment-aware workflow
- **THEN** the manager sees every recorded assessment and its snapshot context
- **THEN** the manager does not see a newly derived conclusion

## ADDED Requirements

### Requirement: Draft uses the canonical CoA template without duplication

The system SHALL render the pre-submission draft as a mode of the existing
canonical CoA template. It SHALL reuse the existing CoA document structure,
sample and result presentation, styles, escaping, grouping, and data mapping.
Draft-specific additions SHALL be limited to the draft watermark, omission of
final-document certification sections, the `Đánh giá` result-cell slot, and
review-footer controls.

The system SHALL NOT create a parallel `DraftCoA` document renderer, copy CoA
template markup or styles, or duplicate CoA data mapping. When interactive
draft controls require a different rendering boundary, the system SHALL
refactor the existing CoA template into shared canonical presentation
primitives instead of duplicating the document implementation.

#### Scenario: Draft CoA is rendered for analyst review

- **WHEN** an analyst opens the pre-submission draft
- **THEN** the system renders the draft from the canonical CoA template
- **THEN** the draft adds only its watermark, omitted certification sections,
  assessment cells, and review-footer controls to the shared CoA presentation
- **THEN** the system does not invoke a parallel or copied CoA document
  renderer

### Requirement: Analyst reviews a draft CoA before submitting a sample

The system SHALL open a Vietnamese draft CoA review dialog when an authorized
analyst selects `Gửi phê duyệt` for an `in_progress` sample with complete
results. The dialog SHALL display sample details and every submitted result's
assay name, value, unit, method, and configured reference range. It SHALL
visibly identify the document as `BẢN NHÁP - CHƯA GỬI DUYỆT`.

The draft SHALL omit signature blocks, manager approval information, approval
date, and all other final-document certification content.

#### Scenario: Analyst opens the pre-submission draft

- **WHEN** an authorized analyst selects `Gửi phê duyệt` for a sample whose
  required results have values
- **THEN** the system displays a draft CoA review dialog containing the sample
  details and each result's value, unit, method, and configured reference range
- **THEN** the draft visibly states `BẢN NHÁP - CHƯA GỬI DUYỆT`
- **THEN** the draft does not display signatures, manager approval information,
  or an approval date

#### Scenario: Analyst returns to editing from the draft

- **WHEN** an analyst closes the draft dialog or selects the action to return
  to editing before confirming submission
- **THEN** the system leaves the sample and result states unchanged
- **THEN** the system creates no submission, assessment, CoA report, stored
  document, document hash, or audit event for the abandoned draft

### Requirement: Analyst records a manual assessment for every result

The draft result table SHALL expose a required `Đánh giá` field for each
result. The field SHALL permit exactly one manual conclusion per result:
`Trong khoảng tham chiếu` or `Ngoài khoảng tham chiếu`. The system SHALL NOT
automatically classify, preselect, derive, or change an assessment from the
entered result value or configured reference range.

The draft footer SHALL display the confirmation message `Bạn có chắc chắn muốn
gửi các kết quả này để cấp quản lý phê duyệt không?`. The `Gửi phê duyệt` action
SHALL remain unavailable until every displayed result has one assessment.

#### Scenario: Unassessed result blocks submission

- **WHEN** an analyst has not selected `Đánh giá` for one or more results in
  the draft
- **THEN** the system keeps `Gửi phê duyệt` unavailable
- **THEN** the system does not invoke the submission workflow

#### Scenario: Analyst completes all assessments

- **WHEN** an analyst selects one of the two manual assessments for every
  displayed result
- **THEN** the system makes `Gửi phê duyệt` available
- **THEN** the selected assessments remain visible with their corresponding
  results and reference ranges until the dialog is closed or submission
  completes

### Requirement: Draft review remains an ephemeral document

The system SHALL reuse the CoA presentation structure for the draft without
creating a persistent CoA artifact. Opening, rendering, changing an
assessment, closing, or abandoning the dialog SHALL NOT write to
`coa_reports`, document storage, document hashes, audit history, sample state,
result state, or submission history.

#### Scenario: Analyst reviews without confirming

- **WHEN** an analyst opens a draft, reads results and ranges, and leaves the
  dialog without confirming
- **THEN** no persistent document or workflow artifact is created
- **THEN** the sample remains in its prior status

### Requirement: Submission atomically records assessment snapshots

The system SHALL require a complete assessment payload when submitting a
sample for review. The server SHALL independently load and lock the
sample's results and assay data, validate the current role, ownership,
signature, sample status, result completeness, payload result set, assessment
values, and reviewed revision tokens before creating records.

On success, the system SHALL create one signed `sample_submissions` record and
one immutable assessment snapshot per submitted result in the same transaction,
then transition the sample to `review`. Each snapshot SHALL be linked to the
submission and result and preserve the analyst's identity, assessment time,
assay name, entered result value, unit, method, and displayed reference range.

The server SHALL construct snapshot display data from server-loaded rows, not
browser-supplied display values.

#### Scenario: Complete reviewed submission succeeds

- **WHEN** an authorized analyst confirms `Gửi phê duyệt` with a current,
  complete, one-to-one assessment payload for all submitted results
- **THEN** the system creates a signed submission and one immutable assessment
  snapshot for every result in one transaction
- **THEN** the sample transitions from `in_progress` to `review`
- **THEN** every saved snapshot contains the server-loaded value, unit, method,
  and configured reference range reviewed for that submission

#### Scenario: Missing, duplicate, foreign, or invalid assessment fails closed

- **WHEN** a submission payload omits a result, repeats a result, names a
  result outside the sample, or contains an assessment other than the two
  supported manual conclusions
- **THEN** the system rejects the request
- **THEN** the system creates no submission or assessment snapshot
- **THEN** the sample status remains unchanged

#### Scenario: Reviewed data becomes stale before confirmation

- **WHEN** a submitted result or its configured reference range changes after
  the analyst opened the draft and before confirmation
- **THEN** the system rejects the stale submission without changing sample
  status or persisting snapshots
- **THEN** the analyst is required to refresh and review the current draft
  before submitting

### Requirement: Assessment history is immutable and authorization-scoped

The system SHALL store assessments in an append-only record linked to each
sample submission. Direct client inserts, updates, and deletes of assessment
records SHALL be denied. The controlled submission RPC SHALL be the only write
path.

An analyst SHALL be able to read only assessments associated with the
analyst's own submissions. An authorized manager SHALL be able to read
assessments for samples within the manager's approval scope. Each resubmission
SHALL create a new submission and a new set of snapshots; previous assessments
SHALL remain unchanged.

#### Scenario: Analyst cannot directly alter an assessment record

- **WHEN** an analyst attempts to insert, update, or delete an assessment
  record outside the controlled submission workflow
- **THEN** database authorization denies the operation
- **THEN** existing assessment history remains unchanged

#### Scenario: Rework and resubmission preserve prior assessment history

- **WHEN** a manager rejects a submission, the analyst revises results, and
  the analyst submits the sample again after completing the new draft review
- **THEN** the system creates a new signed submission and a new full set of
  assessment snapshots
- **THEN** the prior submission and its assessment snapshots remain immutable
  and linked to their original submission history

### Requirement: Managers review submitted assessments and final CoA range snapshots

The manager approval context SHALL display each submitted result's `Đánh giá`
with its snapshot value, unit, method, and reference range. It SHALL display
the analyst's stored conclusion and SHALL NOT recalculate that conclusion.

When a manager approves a submission and the system creates or queues a CoA
report, the system SHALL persist that exact approved submission ID in
`coa_reports.source_submission_id`. The system SHALL resolve this source from
the active signed submission chain during approval/completion, not from a
timestamp-based "newest assessment" lookup during document rendering.

The final CoA SHALL load its assessment snapshots and reference ranges only
through its persisted `source_submission_id`. That source ID SHALL remain
immutable after report creation. A failed CoA generation retry SHALL preserve
the same source ID. Historical reports with no source ID SHALL retain the
existing assay-definition range fallback; every report created after this
feature SHALL have a source ID.

The database SHALL reject an update that changes a non-null
`coa_reports.source_submission_id`.

#### Scenario: Manager sees the analyst's submitted conclusions

- **WHEN** an authorized manager opens a sample awaiting approval
- **THEN** the approval context displays the submitted `Đánh giá` for every
  result with its snapshot result details and reference range
- **THEN** the displayed assessment is the analyst's persisted conclusion,
  not an automatic classification by the application

#### Scenario: Reference range changes after submission

- **WHEN** an assay's configured reference range changes after an analyst
  submits a sample and the manager later approves it
- **THEN** the final CoA uses the reference range snapshot linked to that
  report's persisted source submission
- **THEN** the submission's historical assessment remains unchanged

#### Scenario: Rejected submission is replaced before approval

- **WHEN** submission `#1` is rejected, an analyst resubmits as submission
  `#2`, and a manager approves submission `#2`
- **THEN** the new CoA report persists submission `#2` as
  `source_submission_id`
- **THEN** the final CoA reads only submission `#2` assessment snapshots
- **THEN** submission `#1` assessments remain immutable historical records and
  are not used for the new CoA

#### Scenario: Failed CoA generation is retried

- **WHEN** a CoA report created for an approved submission fails generation and
  is retried
- **THEN** the retry uses the report's existing `source_submission_id`
- **THEN** the retry does not select a submission based on its timestamp,
  submission number, or current active state

#### Scenario: CoA report source cannot be rebound

- **WHEN** any application or database path attempts to change a CoA report's
  non-null `source_submission_id`
- **THEN** the database rejects the update
- **THEN** the report remains linked to its original approved submission

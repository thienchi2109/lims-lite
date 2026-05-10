## ADDED Requirements

### Requirement: Analysis lifecycle is explicit and separate from sample lifecycle
The system SHALL model each active result row as an analysis workflow item with a lifecycle that is independent from, but mapped to, the parent sample lifecycle.

#### Scenario: Entered analysis does not complete sample
- **WHEN** an analyst saves a valid result value for one analysis row
- **THEN** the analysis lifecycle SHALL move from `pending` to `entered`
- **AND** the parent sample SHALL remain `in_progress` until all active reportable analyses satisfy the submission requirements.

#### Scenario: Submitted analyses move sample to review
- **WHEN** all active reportable analyses for a sample are submitted through the controlled submission workflow
- **THEN** the parent sample SHALL move to `review`
- **AND** each submitted analysis SHALL preserve who submitted it and when it was submitted.

#### Scenario: Approved analyses complete sample eligibility
- **WHEN** all active reportable analyses for a reviewed sample are approved by an authorized manager
- **THEN** the sample SHALL become eligible for completion and CoA generation checks
- **AND** the system SHALL NOT mark the sample completed while any active reportable analysis remains `pending`, `entered`, `submitted`, or `rejected`.

### Requirement: Transition guards are evaluated server-side
The system SHALL evaluate analysis and sample transition eligibility through server-side guards before mutating result, sample, submission, approval, rejection, or CoA state.

#### Scenario: Guard denies incomplete submission
- **WHEN** an analyst attempts to submit a sample for review while an active reportable analysis has no valid result value
- **THEN** the guard SHALL deny the transition with a machine-readable reason code
- **AND** the system SHALL NOT create a submission record or change the sample status.

#### Scenario: Guard denies unauthorized approval
- **WHEN** a non-manager attempts to approve an analysis or sample review
- **THEN** the guard SHALL deny the transition
- **AND** RLS and backend authorization SHALL prevent the approval mutation from changing persisted state.

#### Scenario: Guard facts are exposed to UI safely
- **WHEN** analyst or manager workbench data is loaded
- **THEN** each analysis row SHALL include allowed action facts derived from server-side guards
- **AND** the UI SHALL use those facts to render Vietnamese action labels without treating them as the final security boundary.

### Requirement: Assigned analyses preserve template snapshots
The system SHALL persist interpretation-critical assay and method context on each assigned analysis so historical results remain meaningful after assay configuration changes.

#### Scenario: Assigned analysis stores method context
- **WHEN** a test is assigned to a sample with an assay and method
- **THEN** the analysis SHALL store source assay and method IDs
- **AND** the analysis SHALL store display context needed for historical interpretation, including assay name, method name, unit, and applicable result range.

#### Scenario: Later assay changes do not rewrite historical interpretation
- **WHEN** a manager updates an assay name, method relationship, unit, or result range after a result has been approved
- **THEN** previously approved analysis rows and CoA interpretation SHALL continue using the stored snapshot context
- **AND** the source assay/method IDs SHALL remain available for traceability.

### Requirement: Analysis workbench payload is shared across result entry and approval
The system SHALL provide a shared workbench payload for analysis rows that includes display context, lifecycle, guard facts, and audit summary for analyst result entry, manager approval, sample detail, and CoA readiness.

#### Scenario: Analyst result entry uses shared row contract
- **WHEN** an analyst opens the result entry page for a sample
- **THEN** each row SHALL be rendered from the shared workbench payload
- **AND** the row SHALL include lifecycle, result display value, method context, guard facts, and localized action availability.

#### Scenario: Manager approval uses same row interpretation
- **WHEN** a manager opens the approval queue or sample detail for a reviewed sample
- **THEN** each result row SHALL use the same analysis interpretation and guard facts as the analyst result entry surface
- **AND** the approval UI SHALL NOT recompute lifecycle or permission rules independently on the client.

#### Scenario: CoA generation consumes approved analysis interpretation
- **WHEN** CoA generation fetches test results for an approved sample
- **THEN** the generated report SHALL use approved analysis rows and their stored template snapshots
- **AND** CoA generation SHALL fail safely or enter a retryable failure state if required approved analysis context is missing.

### Requirement: Analysis mutations remain auditable and soft-delete safe
The system SHALL record auditable events for lifecycle-changing analysis mutations and SHALL NOT hard-delete analysis, result, submission, approval, rejection, or snapshot records.

#### Scenario: Lifecycle transition is audited
- **WHEN** an analysis moves between lifecycle states
- **THEN** the transition SHALL record actor, timestamp, previous state, next state, and reason where applicable through the existing audit mechanism or a dedicated immutable event table.

#### Scenario: Voiding preserves history
- **WHEN** an analysis is voided, rejected, or superseded by rework
- **THEN** the previous record SHALL remain queryable for audit review
- **AND** active workbench reads SHALL exclude voided rows unless the user is viewing audit or history context.

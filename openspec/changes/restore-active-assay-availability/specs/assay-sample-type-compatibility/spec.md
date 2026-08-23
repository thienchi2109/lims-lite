## ADDED Requirements

### Requirement: Evidence-only initial adjudication can be recovered

The system SHALL support a forward-only audited catalog correction when active
assays were classified as `not_assignable` solely because they lacked approved
historical results. The correction SHALL publish a new immutable revision,
SHALL preserve the prior revision, and SHALL NOT require mutation of assay
lifecycle state.

#### Scenario: Restore active assays for the current active sample type

- **WHEN** the reviewed production baseline contains 59 active assays hidden by
  evidence-only `not_assignable` reviews and `LM-000001` is the only active
  sample type
- **THEN** the correction SHALL publish a new revision in which all 84 active
  assays are `configured` for `LM-000001`

#### Scenario: Soft-deleted assays remain unavailable

- **WHEN** the correction revision is created and published
- **THEN** assays with non-null `deleted_at` SHALL remain unchanged and SHALL
  have no active compatibility pair in the new revision

#### Scenario: Production baseline has drifted

- **WHEN** the published revision, open-draft state, active sample type, assay
  counts, review dispositions, actor state, or generation snapshots differ from
  the reviewed baseline
- **THEN** the correction SHALL abort atomically before publishing a new
  revision

#### Scenario: Recovery remains auditable

- **WHEN** the correction updates reviews, accepts candidates, and publishes the
  new revision
- **THEN** it SHALL use the existing catalog RPC workflow with explicit system
  actor and reasons so existing audit triggers record the changes

## ADDED Requirements

### Requirement: Samples workspace defaults to active samples

The system SHALL default the unified `/samples` workspace to an active-samples scope that excludes rows with `status = 'completed'` unless the user explicitly requests all samples or applies a concrete status filter.

#### Scenario: Default workspace load excludes completed samples

- **GIVEN** an authenticated analyst or manager opens `/samples` with no explicit `status` filter
- **WHEN** the samples list query is executed
- **THEN** the system SHALL exclude samples whose status is `completed`
- **AND** the visible workspace SHALL remain focused on active operational samples
- **AND** the workspace SHALL indicate that completed samples are hidden by default

#### Scenario: User explicitly fetches all samples

- **GIVEN** the samples workspace is in its default active scope
- **WHEN** the user enables the `Hiển thị tất cả` control
- **THEN** the system SHALL fetch samples across all statuses, including `completed`
- **AND** the selection SHALL survive refresh and shared URLs

#### Scenario: Explicit status filter overrides active default

- **GIVEN** the unified samples workspace supports both scope and status filters
- **WHEN** the user explicitly filters by a concrete status such as `completed` or `review`
- **THEN** the system SHALL honor the explicit status filter
- **AND** the default active-scope exclusion SHALL NOT block the requested status results
- **AND** the user's remembered scope selection SHALL remain URL-backed so clearing the explicit status filter returns the workspace to that scope

#### Scenario: Reset returns to active default

- **GIVEN** the user has applied search terms or secondary filters in the samples workspace
- **WHEN** the user resets filters back to the workspace default
- **THEN** the system SHALL clear explicit filters and pagination state
- **AND** the workspace SHALL return to the default active-samples scope rather than fetching all statuses

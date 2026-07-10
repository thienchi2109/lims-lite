## ADDED Requirements

### Requirement: Authorized users can filter Samples to confidential-associated samples

The Samples workspace SHALL provide an explicit confidential-only list filter for users whose authenticated dashboard session has `canAccessConfidential = true`.

#### Scenario: Authorized user sees confidential filter control

- **GIVEN** an authenticated analyst or manager has `canAccessConfidential = true`
- **WHEN** the user opens the Samples workspace
- **THEN** the filter toolbar SHALL render a control labeled "Mẫu nhạy cảm"
- **AND** the control SHALL be available alongside existing scope, sort, page-size, and advanced filter controls.

#### Scenario: Authorized user enables confidential-only filtering

- **GIVEN** an authenticated analyst or manager has `canAccessConfidential = true`
- **WHEN** the user enables the "Mẫu nhạy cảm" filter
- **THEN** the URL SHALL represent the confidential-only state
- **AND** the Samples query SHALL request only samples that contain at least one result linked to a confidential assay
- **AND** pagination totals SHALL be calculated from that confidential-only row set.

#### Scenario: Confidential-only filter preserves active sample default

- **GIVEN** an authenticated user has `canAccessConfidential = true`
- **AND** no explicit `scope=all` or `status` filter is selected
- **WHEN** the user enables the "Mẫu nhạy cảm" filter
- **THEN** completed samples SHALL remain hidden by the existing active-scope default
- **AND** only active confidential-associated samples SHALL be returned.

#### Scenario: Authorized user combines confidential-only with all-scope filtering

- **GIVEN** an authenticated user has `canAccessConfidential = true`
- **WHEN** the user enables both "Mẫu nhạy cảm" and "Hiển thị tất cả"
- **THEN** the Samples list SHALL include confidential-associated samples across all statuses allowed by the remaining filters
- **AND** non-confidential samples SHALL be excluded.

### Requirement: Unauthorized users cannot discover confidential-associated samples through the confidential-only filter

The Samples workspace and Samples list query SHALL keep confidential-associated samples non-discoverable for users whose authenticated session does not have confidential access.

#### Scenario: Unauthorized user does not see confidential filter control

- **GIVEN** an authenticated user has `canAccessConfidential = false`
- **WHEN** the user opens the Samples workspace
- **THEN** the filter toolbar SHALL NOT render the "Mẫu nhạy cảm" control.

#### Scenario: Unauthorized URL tampering returns no confidential rows or counts

- **GIVEN** an authenticated user has `canAccessConfidential = false`
- **WHEN** the user manually opens a Samples URL with the confidential-only query state
- **THEN** the Samples list query SHALL return no confidential-associated rows
- **AND** the returned total count SHALL NOT reveal the number of confidential-associated samples.

#### Scenario: Unauthorized default list remains non-discoverable

- **GIVEN** an authenticated user has `canAccessConfidential = false`
- **WHEN** the user opens the Samples workspace without the confidential-only query state
- **THEN** confidential-associated samples SHALL remain absent from rows and totals
- **AND** all existing non-confidential Samples filters SHALL continue to work.

### Requirement: Confidential-only Samples filtering is enforced server-side

The system SHALL enforce confidential-only Samples filtering inside the database-backed list path before counting, sorting, and pagination.

#### Scenario: Confidential-only query uses database predicate

- **WHEN** the Samples list is requested with confidential-only filtering enabled
- **THEN** `get_samples_page` SHALL apply the confidential-associated-sample predicate before computing `total_count`
- **AND** the application SHALL NOT rely on client-side filtering or post-pagination filtering to remove non-confidential rows.

#### Scenario: Normal and confidential-only list states use separate cache identities

- **WHEN** a user toggles the "Mẫu nhạy cảm" filter
- **THEN** the Samples query key SHALL distinguish confidential-only results from normal Samples results
- **AND** previously cached normal-list rows SHALL NOT be reused as the confidential-only list payload.

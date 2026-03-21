## ADDED Requirements

### Requirement: Manager approval queue SHALL paginate data server-side

The system SHALL retrieve manager approval queue data using server-side pagination for both `review` and `completed` tabs, instead of loading the full tab dataset before rendering pagination controls.

#### Scenario: Manager opens completed tab with large dataset

- **WHEN** an authenticated manager opens `/manager/approvals?tab=completed`
- **THEN** the system SHALL request only the configured page size for the current page
- **AND** the response SHALL include total row count metadata required for pagination UI
- **AND** the UI SHALL render pagination controls from server-provided totals

#### Scenario: Manager changes page in approval queue

- **WHEN** an authenticated manager moves from page N to page N+1 in the approval queue
- **THEN** the system SHALL request only data for page N+1
- **AND** the system SHALL NOT re-fetch prior pages in the same action unless cache is invalidated

### Requirement: Approval detail selection SHALL NOT trigger full queue reload

The system SHALL treat queue-list retrieval and sample-detail retrieval as separate data paths so that selecting a sample for detail view does not trigger a full queue-list reload for the active tab.

#### Scenario: Manager switches between samples in the same queue page

- **WHEN** an authenticated manager selects a different sample in the currently displayed queue page
- **THEN** the system SHALL fetch only the selected sample detail payload needed for the detail panel
- **AND** the system SHALL NOT re-fetch the entire queue dataset for the active tab

#### Scenario: Manager opens queue with sample deep-link

- **WHEN** an authenticated manager opens `/manager/approvals` with a `sampleId` query parameter
- **THEN** the system SHALL render the queue list for the active tab
- **AND** the system SHALL fetch the targeted sample detail for the detail panel without forcing a full queue reload per sample switch

### Requirement: Queue pagination backend SHALL preserve authorization and audit constraints

Any backend endpoint used for approval queue pagination SHALL preserve existing manager authorization rules and SHALL keep RLS as the final authorization gate.

#### Scenario: Unauthorized role attempts to read manager approval queue pagination endpoint

- **WHEN** a non-manager user calls the approval queue pagination backend path
- **THEN** the system SHALL deny the request
- **AND** no privileged approval queue data SHALL be returned

#### Scenario: Authorized manager reads paginated approval queue

- **WHEN** a manager calls the approval queue pagination backend path
- **THEN** the system SHALL return only rows visible under existing RLS policies
- **AND** the change SHALL NOT introduce any mutation path that bypasses audit logging requirements

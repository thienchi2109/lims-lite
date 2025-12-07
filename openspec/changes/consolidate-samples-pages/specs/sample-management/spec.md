## ADDED Requirements

### Requirement: Unified samples workspace
The system SHALL provide a single samples workspace that adapts to analyst and manager roles while sharing one data-fetching pipeline.

#### Scenario: Analyst uses the workspace
- **WHEN** an analyst opens `/samples`
- **THEN** the list and detail panels load via the TanStack Query client pipeline with filters (search, status, date, receiver, sort, pagination)
- **AND** analyst actions remain limited to their allowed operations (no manager-only reject/ignore)
- **AND** navigation/back links point to the analyst dashboard.

#### Scenario: Manager uses the workspace
- **WHEN** a manager opens `/samples`
- **THEN** the same list/detail UI loads with identical filters
- **AND** manager-only reject/ignore controls are available only when status is `Đã nhận` or `Đã chỉ định`
- **AND** approval actions remain on the dedicated approvals page (not shown here)
- **AND** navigation/back links point to the manager dashboard.

#### Scenario: Legacy routes redirect
- **WHEN** a user visits `/analyst/samples` or `/manager/samples` with query parameters
- **THEN** the user is redirected to `/samples` with query parameters preserved.

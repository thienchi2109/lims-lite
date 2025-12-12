## ADDED Requirements

### Requirement: Auto-refresh assays list after mutation

The system SHALL refresh the manager assays list after a successful create, update, or delete of an assay definition so that the UI reflects the latest server state without manual browser reload.

#### Scenario: Manager updates an assay definition

**GIVEN** an authenticated user with manager role on `/manager/assays`  
**WHEN** the user saves changes in the assay edit dialog  
**THEN** the system SHALL:
- Revalidate server data for `/manager/assays`
- Refresh the route client-side so the table shows updated assay fields (name, specialty, units, rules)
- Preserve current filters and pagination

#### Scenario: Manager creates a new assay definition

**GIVEN** an authenticated user with manager role on `/manager/assays`  
**WHEN** the user submits the create assay dialog successfully  
**THEN** the system SHALL:
- Refresh the assays list to include the new assay
- Respect current specialty filter/search/pagination
- Require no manual browser refresh

#### Scenario: Manager deletes an assay definition

**GIVEN** an authenticated user with manager role on `/manager/assays`  
**WHEN** the user confirms deletion of an assay definition  
**THEN** the system SHALL refresh the assays list so the deleted assay no longer appears.

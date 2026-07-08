# assay-management Specification

## Purpose
TBD - created by archiving change fix-assays-auto-refresh. Update Purpose after archive.
## Requirements
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

### Requirement: Manager can save free-form assay method text

The system SHALL allow a manager to create and update an assay definition with a `Phương pháp` value entered as free-form text, without requiring the value to exist in the `methods` catalog or an `assay_methods` relationship.

#### Scenario: Manager creates assay with custom method

- **GIVEN** an authenticated manager is creating a new assay definition
- **WHEN** the manager enters a method name in the create dialog that does not exist in the method catalog and saves the assay
- **THEN** the system SHALL store the typed method text on the assay definition
- **AND** the system SHALL refresh the manager assay list without requiring a catalog method record

#### Scenario: Manager creates assay without required method select

- **GIVEN** an authenticated manager opens the create dialog for a new assay
- **WHEN** the dialog renders assay fields
- **THEN** the system SHALL show a free-form `Phương pháp` text field instead of a required catalog method select
- **AND** the system SHALL save the typed text as the assay's initial method value

#### Scenario: Manager updates method text

- **GIVEN** an authenticated manager is editing an existing assay definition
- **WHEN** the manager changes the `Phương pháp` text and saves
- **THEN** the system SHALL persist the new method text for that assay definition
- **AND** the system SHALL show the updated method text in the assay list and detail view

#### Scenario: Manager edits assay without catalog method controls

- **GIVEN** an authenticated manager opens the edit dialog for an assay
- **WHEN** the dialog renders editable assay fields
- **THEN** the system SHALL show a free-form `Phương pháp` text field
- **AND** the system SHALL NOT show catalog-bound method add, remove, set-default, or required select controls for the new assay management workflow

#### Scenario: Non-manager cannot change method text

- **GIVEN** an authenticated user without manager role attempts to create or update assay method text
- **WHEN** the request reaches the server action or database policy boundary
- **THEN** the system SHALL reject the mutation using the existing manager-only authorization model

### Requirement: Method suggestions do not constrain assay method entry

The system SHALL provide method name suggestions as an input convenience only, and saving SHALL depend on the text value rather than a selected method identifier.

#### Scenario: Manager chooses a suggested method

- **GIVEN** method name suggestions are available from existing assay method text or legacy method catalog names
- **WHEN** the manager selects a suggestion
- **THEN** the system SHALL populate the `Phương pháp` text input with that suggestion
- **AND** the saved assay definition SHALL store the method name text without requiring a `method_id`

#### Scenario: Manager ignores suggestions

- **GIVEN** the manager is entering `Phương pháp`
- **WHEN** the manager types a new method name and saves without selecting a suggestion
- **THEN** the system SHALL accept and persist the typed method text

### Requirement: Manager can view assay details from the assay table

The system SHALL provide an action on each manager assay table row to open a read-only detail dialog for that assay.

#### Scenario: Manager opens assay detail

- **GIVEN** an authenticated manager is viewing `/manager/assays`
- **WHEN** the manager activates the `Xem chi tiết` action for an assay row
- **THEN** the system SHALL open a modal showing the assay name, specialty, method text, units, confidentiality flag, validation rules, timestamps when available, and method-related display data supported by the current schema
- **AND** the modal SHALL not submit mutations while in detail mode

#### Scenario: Assay dialogs share field structure

- **GIVEN** the assay create, edit, and detail dialogs are rendered
- **WHEN** they show assay fields such as name, specialty, method text, units, confidentiality, and validation rules
- **THEN** the system SHALL render those fields through a shared form/detail component
- **AND** the system SHALL switch behavior by mode rather than duplicating create, edit, or detail field markup

### Requirement: Assay method text remains visible in downstream assay usage

The system SHALL surface the assay method text in assignment/result display paths that previously depended on catalog method names for newly created assay data.

#### Scenario: New assay is used in test assignment

- **GIVEN** an assay definition has method text and no required catalog method identifier
- **WHEN** the assay is assigned to a sample or displayed in result-oriented UI
- **THEN** the system SHALL display the assay method text without failing on a missing `method_id`


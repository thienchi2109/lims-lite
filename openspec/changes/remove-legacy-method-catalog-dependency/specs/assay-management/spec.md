## ADDED Requirements

### Requirement: Assay downstream flows use assay-owned method text
The system SHALL use `assay_definitions.method_name` as the assay method source for sample assignment, result entry, result display, and result-oriented exports instead of requiring a legacy catalog `method_id`.

#### Scenario: Assign assay without catalog method
- **GIVEN** an assay definition has `method_name` populated and has no related `assay_methods` row
- **WHEN** an analyst or manager assigns that assay to a sample
- **THEN** the assignment SHALL succeed without requiring a `method_id`
- **AND** the assigned test display SHALL show the assay method text

#### Scenario: Enter result without catalog method
- **GIVEN** a sample test is linked to an assay definition with `method_name` and no catalog method relationship
- **WHEN** an analyst enters or saves a result for that sample test
- **THEN** the result write SHALL succeed without requiring a `method_id`
- **AND** the result-oriented UI SHALL show the assay method text

#### Scenario: Display result and report method text
- **GIVEN** result data is rendered in manager review, analyst result views, or CoA/report helpers
- **WHEN** the linked assay definition has `method_name`
- **THEN** the rendered method label SHALL use that method text
- **AND** the renderer SHALL NOT fail because `methods` or `assay_methods` is empty

### Requirement: Legacy method catalog surfaces are retired from assay workflows
The system SHALL remove manager and downstream assay workflow surfaces that create, select, manage, or require legacy catalog methods.

#### Scenario: Manager cannot manage method catalog from assay workflow
- **WHEN** a manager creates, edits, or views an assay definition
- **THEN** the UI SHALL NOT expose legacy method catalog management actions such as adding methods to an assay, setting a default catalog method, or removing catalog method relationships
- **AND** the UI SHALL expose only the Vietnamese `Phương pháp` method text workflow

#### Scenario: Client actions do not require method identifier
- **WHEN** assay create/update, sample assignment, or result save requests are sent through the client-action bridge
- **THEN** the payload SHALL NOT require a `methodId` or `method_id`
- **AND** method display data SHALL be carried as method text where needed

### Requirement: Legacy method catalog database dependency is removed safely
The system SHALL migrate test/demo data to assay-owned method text and remove or explicitly deprecate legacy method catalog database dependencies only after application callers no longer require them.

#### Scenario: Backfill assay method text before retiring catalog relationships
- **GIVEN** existing test/demo assay definitions have legacy catalog method relationships and missing `method_name`
- **WHEN** the cleanup migration runs
- **THEN** the migration SHALL populate `assay_definitions.method_name` from the default or first legacy method name
- **AND** the migration SHALL document that exact catalog preservation is not required for test/demo data

#### Scenario: Security checks pass after database cleanup
- **WHEN** database migrations for legacy method cleanup are applied
- **THEN** `run_security_tests()` SHALL pass
- **AND** PostgREST schema cache SHALL be reloaded
- **AND** affected RPC return shapes SHALL no longer require legacy catalog method identifiers

## REMOVED Requirements

### Requirement: Catalog method is required for assay assignment
**Reason**: Assay method text is now owned by `assay_definitions.method_name`; requiring a catalog `method_id` preserves the old model and blocks free-form assay methods.
**Migration**: Move assignment/result contracts to use assay-owned method text. Backfill missing `method_name` values from legacy catalog relationships before retiring catalog dependencies.

#### Scenario: Legacy method identifier required during assignment
- **WHEN** a sample test assignment is created
- **THEN** the system SHALL NOT require a legacy catalog `method_id`

## ADDED Requirements

### Requirement: Assay supports multiple methods via junction table
The system SHALL model assay-to-method relationships with a dedicated `assay_methods` junction table that stores assay_id, method_id, is_default, and notes, enforcing unique assay-method pairs and exactly one default per assay, while preventing removal of the last method for any assay; `assay_definitions` SHALL no longer store a direct method_id.

#### Scenario: Persist and constrain assay-method links
- **WHEN** a manager links a method to an assay
- **THEN** the link is stored in `assay_methods` with unique (assay_id, method_id), a single default per assay is enforced, and attempts to remove the final remaining method for an assay are rejected.

#### Scenario: Enforce access controls on assay-method data
- **WHEN** an authenticated user reads assay-method relationships
- **THEN** the data is returned
- **AND WHEN** any user attempts to write assay-method relationships without manager role
- **THEN** the operation is blocked by RLS.

### Requirement: Managers manage methods per assay in UI
The system SHALL let managers view, add, remove, and set the default method for each assay via the assay management UI, ensuring only unlinked methods are offered and a confirmation is shown when removing a method already in use.

#### Scenario: Add or update methods for an assay
- **WHEN** a manager expands an assay in the manager view
- **THEN** the UI shows its methods with a default badge and controls to add a new method or set a different default
- **AND WHEN** the manager adds a method (optionally as default)
- **THEN** only methods not already linked are selectable, the default is applied (clearing prior defaults), and the list refreshes with the new entry.

#### Scenario: Remove a method with safeguards
- **WHEN** a manager attempts to remove a method from an assay
- **THEN** the UI warns if the method is referenced by existing results and blocks removal if it is the last remaining method for that assay.

### Requirement: Test assignment captures assay and method together
The system SHALL require selecting a method alongside each assay during test assignment, defaulting to the assay’s default method and persisting both IDs so downstream grids and approval views can display method names.

#### Scenario: Assign tests with method selection
- **WHEN** a manager assigns tests to a sample
- **THEN** each selected assay pre-populates its default method, allows choosing another linked method, and submission is rejected if any assay lacks a chosen method.

#### Scenario: Surface method context in downstream views
- **WHEN** analysts or managers view result entry grids or approval queues
- **THEN** each test row displays both assay and method names (resolved from the stored result.method_id, not just the assay default) so duplicate assays with different methods are distinguishable.

## ADDED Requirements

### Requirement: Assays are categorized by managed lab specialties
The system SHALL maintain a `lab_specialties` lookup (UUID PK, unique code, name, display_order, description, audit timestamps, soft delete) on pg_default and link each assay definition to at most one specialty via nullable `specialty_id` with a RESTRICT foreign key and btree index.

#### Scenario: Manage specialty catalog with uniqueness and soft delete
- **WHEN** a manager creates or updates a specialty
- **THEN** the code must be unique, defaults apply (`display_order` = 0, timestamps set), updates refresh `updated_at`, and soft delete via `deleted_at` keeps existing assay links intact.

#### Scenario: Prevent orphaned assay links on specialty removal
- **WHEN** a specialty is referenced by one or more assays
- **THEN** attempts to delete the specialty via FK are rejected (RESTRICT), guiding operators to soft delete instead.

#### Scenario: Assign specialties to assays for routing
- **WHEN** a manager sets `specialty_id` on an assay definition
- **THEN** the value must reference an existing specialty (or be NULL), is indexed for query performance, and downstream workflows can group/filter assays by specialty.

### Requirement: Access control for lab specialties
The system SHALL enforce RLS on `lab_specialties` so authenticated users can read specialties while only managers can insert, update, or soft delete them.

#### Scenario: Read access for authenticated users
- **WHEN** an authenticated user queries specialties
- **THEN** rows with `deleted_at IS NULL` are returned.

#### Scenario: Manager-only writes
- **WHEN** a user without manager role attempts to insert, update, or delete a specialty
- **THEN** RLS blocks the operation; managers can perform these actions, with updates preserving audit triggers.

# user-management-permissions Specification

## Purpose
TBD - created by archiving change harden-manager-user-permissions. Update Purpose after archive.
## Requirements
### Requirement: Manager-created users default to non-confidential access

The system SHALL allow an authenticated manager to create users, including users with role `manager`, but app-created users MUST be persisted with `can_access_confidential = false`.

#### Scenario: Manager creates a new manager
- **GIVEN** an authenticated manager is creating a new user with role `manager`
- **WHEN** the create request is submitted through the application
- **THEN** the system SHALL create the Auth user and `public.users` profile
- **AND** the profile SHALL have `role = 'manager'`
- **AND** the profile SHALL have `can_access_confidential = false`.

#### Scenario: Create payload attempts confidential access
- **GIVEN** an authenticated manager is creating any user through the application
- **AND** the request payload includes `can_access_confidential = true`
- **WHEN** the create request is processed
- **THEN** the system SHALL NOT persist `can_access_confidential = true`
- **AND** the created profile SHALL have `can_access_confidential = false`.

#### Scenario: Database rejects manager insert with confidential access
- **GIVEN** an authenticated database session for a manager
- **WHEN** the session attempts to insert a `public.users` row with `can_access_confidential = true`
- **THEN** the database SHALL reject the write.

### Requirement: Managers cannot manage other existing managers

The system SHALL prevent an authenticated manager from editing, soft-deleting, or banning any other existing manager account through the application or authenticated database writes.

#### Scenario: Manager attempts to update another manager
- **GIVEN** an authenticated manager
- **AND** another existing active user has role `manager`
- **WHEN** the authenticated manager attempts to update that other manager through the application
- **THEN** the system SHALL reject the update before changing `public.users`
- **AND** the system SHALL NOT perform any Supabase Auth admin update for the target user.

#### Scenario: Manager attempts to delete another manager
- **GIVEN** an authenticated manager
- **AND** another existing active user has role `manager`
- **WHEN** the authenticated manager attempts to delete that other manager through the application
- **THEN** the system SHALL reject the delete before setting `deleted_at`
- **AND** the system SHALL NOT ban the target Auth user.

#### Scenario: Database rejects manager update of another manager
- **GIVEN** an authenticated database session for a manager
- **AND** another existing row in `public.users` has role `manager`
- **WHEN** the session attempts to update the other manager row
- **THEN** the database SHALL reject the write.

#### Scenario: Database rejects manager delete of another manager
- **GIVEN** an authenticated database session for a manager
- **AND** another existing row in `public.users` has role `manager`
- **WHEN** the session attempts to delete or soft-delete the other manager row
- **THEN** the database SHALL reject the write.

### Requirement: Manager self-edit excludes confidential access

The system SHALL allow an authenticated manager to edit permitted fields on their own account, but MUST reject any application or authenticated database write that changes their own `can_access_confidential` value.

#### Scenario: Manager updates own permitted profile fields
- **GIVEN** an authenticated manager is editing their own account
- **WHEN** the request updates permitted fields such as email, password, lab, or full name
- **THEN** the system SHALL allow the update if all existing validation rules pass.

#### Scenario: Manager attempts to change own confidential access
- **GIVEN** an authenticated manager is editing their own account
- **AND** the request attempts to change `can_access_confidential`
- **WHEN** the request is processed
- **THEN** the system SHALL reject the request
- **AND** the manager's existing `can_access_confidential` value SHALL remain unchanged.

#### Scenario: Database rejects manager confidential toggle
- **GIVEN** an authenticated database session for a manager
- **WHEN** the session attempts to change `can_access_confidential` on any `public.users` row
- **THEN** the database SHALL reject the write.

### Requirement: Trusted DB administration remains available

The system SHALL preserve trusted database administration paths for superadmin operators to manage `can_access_confidential` directly outside the application workflow.

#### Scenario: Trusted admin updates confidential access
- **GIVEN** a trusted database administration role such as `postgres` or `service_role`
- **WHEN** the admin updates `can_access_confidential` on a `public.users` row
- **THEN** the database guard SHALL NOT block the update solely because the confidential flag changed.

### Requirement: User-management UI reflects manager account boundaries

The system SHALL render Vietnamese user-management controls that reflect the server-enforced manager boundaries without relying on the UI as the security boundary.

#### Scenario: Manager views another manager row
- **GIVEN** an authenticated manager is viewing the user-management table
- **AND** a row represents another existing manager account
- **WHEN** row actions are rendered
- **THEN** edit and delete actions for that row SHALL be hidden or disabled with Vietnamese copy explaining the restriction.

#### Scenario: Manager edits own account
- **GIVEN** an authenticated manager is editing their own account
- **WHEN** the edit form is rendered
- **THEN** the confidential-access control SHALL be disabled or omitted
- **AND** any explanatory text SHALL be in Vietnamese.

#### Scenario: Manager creates a user
- **GIVEN** an authenticated manager is creating a user
- **WHEN** the create form is rendered
- **THEN** the confidential-access control SHALL be disabled, omitted, or fixed to false
- **AND** any explanatory text SHALL be in Vietnamese.


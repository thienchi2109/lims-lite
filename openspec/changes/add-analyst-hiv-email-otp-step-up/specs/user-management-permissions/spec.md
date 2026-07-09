## ADDED Requirements

### Requirement: Analyst HIV OTP destination email is admin-managed
The system SHALL let authorized administrators configure OTP destination emails for analyst HIV users while preventing self-service users from changing their own OTP destination.

#### Scenario: Manager configures analyst HIV OTP email
- **GIVEN** an authorized manager is creating or editing a user with `role = analyst`
- **WHEN** the administrator configures a valid OTP destination email
- **THEN** the system SHALL save the OTP destination for that user through an auditable workflow

#### Scenario: Manager configures analyst OTP email during create
- **GIVEN** an authorized manager is creating a new analyst user
- **WHEN** the manager provides a valid OTP destination email with the create request
- **THEN** the system SHALL save the OTP destination for that analyst through the same auditable user-management workflow

#### Scenario: Analyst cannot self-change OTP email
- **GIVEN** an analyst HIV user is editing their own profile
- **WHEN** the user attempts to change the OTP destination email
- **THEN** the system SHALL deny the change and show Vietnamese guidance to contact an administrator

#### Scenario: Analyst sees only masked OTP destination
- **GIVEN** an analyst HIV user is viewing OTP verification or profile guidance
- **WHEN** the system displays the OTP destination
- **THEN** the system SHALL show only a masked email address and SHALL NOT reveal the full destination unless the viewer is using an authorized admin workflow

### Requirement: User-management UI supports analyst HIV OTP rollout
The system SHALL provide Vietnamese user-management controls or operational guidance for configuring analyst HIV OTP destinations before `ANALYST_HIV_EMAIL_OTP_ENABLED` is enabled.

#### Scenario: Admin identifies analyst HIV users missing OTP configuration
- **GIVEN** analyst HIV OTP rollout is being prepared
- **WHEN** an administrator reviews users with `role = analyst` and `can_access_confidential = true`
- **THEN** the system SHALL support identifying which users are missing OTP destination configuration before the flag is enabled

### Requirement: Managers can manage confidential-access entitlement for analyst users
The system SHALL let managers turn `can_access_confidential` on or off for analyst users while preserving the existing boundary that managers cannot modify other manager accounts.

#### Scenario: Manager enables confidential access for an analyst
- **GIVEN** an authorized manager is editing an analyst user
- **WHEN** the manager sets `can_access_confidential = true`
- **THEN** the system SHALL persist the entitlement change through an audited server-side workflow

#### Scenario: Manager disables confidential access for an analyst
- **GIVEN** an authorized manager is editing an analyst user with `can_access_confidential = true`
- **WHEN** the manager sets `can_access_confidential = false`
- **THEN** the system SHALL persist the entitlement change through an audited server-side workflow and future sessions SHALL no longer classify the user as analyst HIV

#### Scenario: Manager cannot change OTP env flags
- **GIVEN** an authenticated manager is using user-management screens
- **WHEN** the manager creates or edits analyst users and OTP destinations
- **THEN** the system SHALL NOT provide any UI or server action that changes `ANALYST_HIV_EMAIL_OTP_ENABLED`, `MANAGER_EMAIL_OTP_ENABLED`, or `MANAGER_HIV_EMAIL_OTP_ENABLED`

#### Scenario: Superadmin changes OTP flag outside app UI
- **GIVEN** a superadmin/operator needs to enable or disable analyst HIV OTP enforcement
- **WHEN** they change `ANALYST_HIV_EMAIL_OTP_ENABLED`
- **THEN** the change SHALL be performed through deployment/runtime environment configuration, not through the manager user-management UI

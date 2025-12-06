## ADDED Requirements
### Requirement: User Management
The system SHALL provide an interface for Managers to administer application users.

#### Scenario: Manager views user list
- **WHEN** a Manager navigates to the User Management page
- **THEN** a list of active users is displayed
- **AND** the list shows Username, Fullname, Email, Lab, and Role
- **AND** soft-deleted users are excluded by default

#### Scenario: Manager creates a new user
- **WHEN** a Manager submits the "Add User" form with valid details (Username, Fullname, Email, Lab, Role, Password)
- **THEN** a new account is created in the authentication system
- **AND** a corresponding user profile is created in the database
- **AND** the new user appears in the user list

#### Scenario: Manager edits an existing user
- **WHEN** a Manager saves changes to an existing user's details (e.g., changing Lab or Role)
- **THEN** the user profile is updated in the database
- **AND** the user list reflects the changes immediately

#### Scenario: Manager deletes a user
- **WHEN** a Manager selects "Delete" for a user
- **THEN** the user is soft-deleted (marked as deleted but not removed)
- **AND** the user is removed from the active user list
- **AND** the user can no longer log in (if implemented via status check)

### Requirement: User Data Model Extension
The system SHALL store extended information for each user.

#### Scenario: User Schema Fields
- **WHEN** a user profile is retrieved
- **THEN** it MUST contain `lab` (Laboratory Name) and `email` fields in addition to existing profile data.

### Requirement: Role-Based Access for User Management
Only users with the 'Manager' role SHALL be able to access User Management features.

#### Scenario: Analyst denied access
- **WHEN** a user with 'Analyst' role attempts to access the User Management route or API
- **THEN** access is denied (403 or Redirect)

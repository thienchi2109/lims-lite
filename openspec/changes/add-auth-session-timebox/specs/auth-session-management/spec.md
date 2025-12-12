## ADDED Requirements

### Requirement: Hard session timebox for authenticated users
The system SHALL enforce an absolute maximum lifetime for an authenticated user session of **4 hours** (configurable), regardless of user activity or token refresh behavior.

#### Scenario: Expired session is rejected on protected routes
- **GIVEN** an authenticated user is accessing a protected route (e.g., `/analyst/*`, `/manager/*`)
- **AND** the user’s session was created more than 4 hours ago
- **WHEN** the user makes a request to the application
- **THEN** the system SHALL:
  - Terminate the session (clear Supabase auth cookies)
  - Redirect the user to `/login`

#### Scenario: Active usage does not extend the timebox
- **GIVEN** an authenticated user is actively navigating and performing actions
- **WHEN** the session age crosses the 4-hour limit
- **THEN** the next request after the limit SHALL require re-authentication (no “keep-alive forever” behavior).

#### Scenario: Already-open dashboard tab is forced to sign out
- **GIVEN** an authenticated user has a dashboard page open
- **AND** the page continues to fetch data directly from Supabase (client-side)
- **WHEN** the session age reaches the 4-hour limit
- **THEN** the application SHALL force sign-out and redirect the user to `/login`.

### Requirement: Session timebox is configurable
The system SHALL allow operators to configure the maximum session lifetime via environment configuration, with a secure default of 4 hours in this project.

#### Scenario: Operator changes timebox duration
- **WHEN** the operator changes the configured session timebox duration
- **THEN** new sessions SHALL follow the new limit and existing sessions SHALL be enforced on the next refresh/check boundary.

### Requirement: Session timeout UX on login
The system SHALL inform users (in Vietnamese) when they were redirected to login due to session expiration.

#### Scenario: Login page shows session expired message
- **GIVEN** a user is redirected to `/login` due to session timebox expiration
- **WHEN** the login page renders
- **THEN** the system SHALL display a Vietnamese message indicating the session has expired and the user must log in again.

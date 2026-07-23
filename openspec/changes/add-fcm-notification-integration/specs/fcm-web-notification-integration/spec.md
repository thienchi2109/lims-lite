## ADDED Requirements

### Requirement: Analysts explicitly opt in to browser notifications
The system SHALL request browser notification permission only after an authenticated analyst performs an explicit Vietnamese-language action.

#### Scenario: Notification rollout is off
- **WHEN** the rollout mode is `off`
- **THEN** the system does not register messaging, obtain or send a FID, show the opt-in banner, or open the browser permission prompt

#### Scenario: Controlled registration is enabled
- **WHEN** the rollout mode is `registration_only`
- **THEN** an authenticated analyst whose user ID is in the server-side rollout allowlist can enable the current browser from profile controls
- **AND** the system does not show the one-time opt-in banner

#### Scenario: Analyst bypasses the controlled-rollout UI
- **WHEN** the rollout mode is `registration_only` and an authenticated analyst outside the server-side allowlist calls the registration boundary directly
- **THEN** LIMS rejects the request before calling the Notification Service
- **AND** creates or changes no installation

#### Scenario: Undecided permission shows one-time banner
- **WHEN** the rollout mode is `banner_enabled` and an analyst signs in on a supported browser whose notification permission is undecided
- **THEN** the system shows a one-time banner with the action `Bật thông báo`
- **AND** does not open the browser permission prompt automatically

#### Scenario: Analyst grants permission
- **WHEN** the analyst presses `Bật thông báo` and grants browser permission
- **THEN** the system registers or refreshes the browser FID through the authenticated LIMS backend
- **AND** reflects the enabled state in the analyst profile

#### Scenario: Analyst denies or dismisses permission
- **WHEN** the analyst denies or dismisses the browser permission prompt
- **THEN** the system does not repeatedly prompt
- **AND** keeps current-browser guidance available in the profile

#### Scenario: Browser does not support FCM Web
- **WHEN** the browser cannot support the required messaging or service-worker APIs
- **THEN** the system hides or disables notification controls without disrupting other LIMS workflows

### Requirement: LIMS authenticates all installation lifecycle operations
The system SHALL proxy FID lifecycle operations through a same-origin authenticated backend boundary and SHALL NOT expose the Notification Service directly to browsers.

#### Scenario: Current browser registration is attributed to the signed-in user
- **WHEN** an authenticated analyst registers or refreshes a FID
- **THEN** LIMS sends the validated FID with server-derived `app_id` and current user ID to the private Notification Service
- **AND** returns an opaque installation handle and ownership generation to the current browser
- **AND** the browser cannot choose another recipient user ID or application namespace

#### Scenario: Same browser signs in as another analyst
- **WHEN** a previously registered browser authenticates as a different analyst
- **THEN** LIMS requests that the Notification Service rebind the FID to the current analyst
- **AND** stores the new ownership generation returned for that browser

#### Scenario: Analyst logs out
- **WHEN** an analyst logs out from a registered browser
- **THEN** LIMS attempts to disable that browser installation using its opaque handle plus the expected user and ownership generation before destroying the session
- **AND** a stale disable after rebind is treated as an idempotent no-op
- **AND** logout still completes if the Notification Service is temporarily unavailable

#### Scenario: Service rejects installation request
- **WHEN** the Notification Service rejects or cannot process an installation operation
- **THEN** LIMS reports a non-business-critical notification error
- **AND** does not change sample, result, approval, or authentication business state

### Requirement: Browser notification content is sample-code-only
The system SHALL display the fixed completion message from a data-only FCM message and SHALL not send navigation or clinical context through FCM.

#### Scenario: Background completion notification is displayed
- **WHEN** FCM delivers a data-only completion message without a controlled LIMS page handling it
- **THEN** only the service worker presents one notification for that received message
- **AND** the notification title is `Mẫu đã hoàn thành`
- **AND** the body is `Mẫu {sample_code} đã được phê duyệt`

#### Scenario: Foreground completion notification is displayed
- **WHEN** FCM delivers a data-only completion message to a controlled active LIMS page
- **THEN** only the foreground page handler presents one notification for that received message
- **AND** the service worker does not present the same received message

#### Scenario: Notification contains no sensitive context
- **WHEN** LIMS or its service worker constructs or handles the notification
- **THEN** it includes no customer name, patient identifier, result value, assay name, confidential flag, sample UUID, sample-detail URL, or deep link

#### Scenario: Analyst clicks the notification
- **WHEN** the analyst clicks the notification
- **THEN** the service worker focuses an existing LIMS window or opens the application root
- **AND** does not navigate to a sample detail

### Requirement: Each browser installation is managed independently
The system SHALL allow an analyst to enable notifications on multiple browsers and SHALL manage the current browser separately.

#### Scenario: Analyst enables a second browser
- **WHEN** the same analyst grants permission and registers from another browser
- **THEN** LIMS registers another installation without disabling the first

#### Scenario: Analyst disables the current browser
- **WHEN** the analyst disables notifications from the profile on one browser
- **THEN** LIMS disables that installation using its opaque handle and expected ownership generation
- **AND** leaves the analyst's other enabled installations unchanged

### Requirement: Push availability never controls approval success
The system SHALL treat browser push as advisory and SHALL keep Firebase and Notification Service availability outside the manager approval result.

#### Scenario: Notification Service is unavailable during approval
- **WHEN** a manager completes an otherwise valid sample while the Notification Service is unavailable
- **THEN** approval succeeds after the local outbox event commits
- **AND** the event remains available for later service ingestion

#### Scenario: FCM rejects a later delivery attempt
- **WHEN** FCM rejects or delays a delivery after sample completion
- **THEN** LIMS leaves the approved results and completed sample unchanged

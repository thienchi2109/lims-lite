## ADDED Requirements

### Requirement: Analyst rejection notification on dashboard

The system SHALL display a prominent rejection notification on the analyst dashboard when the analyst has samples that were rejected by a manager. The notification SHALL:
- Only appear for the analyst who accessioned the rejected sample (`received_by = current user`)
- Exclude soft-deleted samples (`deleted_at IS NULL`)
- Show a red/rose alert banner with the count of rejected samples and a link to the samples list
- Show a red badge count on the "Danh sách mẫu" dashboard card
- Automatically disappear when the rejection count reaches zero (analyst re-submits or samples are otherwise resolved)
- Not include a dismiss button — the banner persists until the underlying issue is resolved
- Use a query-based approach counting from the `samples` table (`status = 'in_progress' AND rejected_at IS NOT NULL AND received_by = auth.uid() AND deleted_at IS NULL`)
- Refresh via TanStack Query with 30-second stale time and refetch on window focus
- Invalidate the rejection count cache key (`rejectionKeys.count`) after mutations that affect the count: reject, re-submit for review, and discard

#### Scenario: Analyst sees rejection notification after manager rejects a sample

- **GIVEN** a manager has rejected a sample that was submitted for review by the current analyst
- **WHEN** the analyst navigates to the analyst dashboard
- **THEN** the system SHALL display a red alert banner stating the number of rejected samples with a link to the samples list
- **AND** the "Danh sách mẫu" card SHALL display a red badge with the rejection count

#### Scenario: Rejection notification clears after re-submission

- **GIVEN** the analyst dashboard is showing a rejection notification for 1 rejected sample
- **WHEN** the analyst re-submits that sample for review
- **THEN** the rejection count cache SHALL be invalidated immediately (not wait for stale time)
- **AND** the rejection count SHALL decrease to zero
- **AND** the alert banner and badge SHALL no longer be visible

#### Scenario: Rejection notification is scoped to the current analyst

- **GIVEN** analyst A accessioned sample S1 and analyst B accessioned sample S2
- **WHEN** a manager rejects both S1 and S2
- **THEN** analyst A SHALL only see a rejection count of 1 (for S1)
- **AND** analyst B SHALL only see a rejection count of 1 (for S2)

#### Scenario: Soft-deleted samples are excluded from rejection count

- **GIVEN** a rejected sample that has been soft-deleted (`deleted_at IS NOT NULL`)
- **WHEN** the analyst views the dashboard
- **THEN** the rejection count SHALL NOT include the soft-deleted sample

#### Scenario: Rejection count invalidated on reject action

- **GIVEN** a manager is on the approval queue
- **WHEN** the manager rejects a sample via the reject dialog
- **THEN** the system SHALL invalidate both `approvalKeys.count` and `rejectionKeys.count` cache keys

#### Scenario: Rejection count invalidated on discard action

- **GIVEN** a manager is discarding a sample
- **WHEN** the discard action completes
- **THEN** the system SHALL invalidate `rejectionKeys.count` in addition to `approvalKeys.count`

### Requirement: Enhanced manager approval notification banner

The system SHALL replace the plain-text pending approval message on the manager dashboard with a prominent alert banner. The banner SHALL:
- Use an amber/warning color scheme with an alert icon
- Display the count of samples pending approval
- Include a clickable link to the approvals page (`/manager/approvals`)
- Only appear when the pending approval count is greater than zero

#### Scenario: Manager sees prominent alert banner for pending approvals

- **GIVEN** there are 3 samples with status `review` awaiting manager approval
- **WHEN** the manager navigates to the manager dashboard
- **THEN** the system SHALL display an amber alert banner stating "Bạn có 3 mẫu đang chờ phê duyệt" with a link to the approvals page
- **AND** the banner SHALL be visually prominent (not plain text)

#### Scenario: Alert banner hidden when no pending approvals

- **GIVEN** there are no samples awaiting approval
- **WHEN** the manager navigates to the manager dashboard
- **THEN** the alert banner SHALL NOT be displayed

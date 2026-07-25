## ADDED Requirements

### Requirement: Manager approval queue SHALL support batch selection without changing single approval

The manager approval queue SHALL provide row checkboxes for selecting multiple
approval-eligible samples and submission to background processing. It SHALL
also provide `Chọn tất cả` to select every currently pending sample in the
manager's authorization scope across the full queue, not only the loaded page.
The existing one-sample `Duyệt` interaction SHALL remain available and SHALL
continue to return its approval outcome synchronously.

#### Scenario: Manager approves one sample from detail

- **WHEN** a manager selects one sample and activates `Duyệt`
- **THEN** the UI SHALL use the synchronous single-sample approval path
- **AND** it SHALL NOT create or display a batch progress job for that action.

#### Scenario: Manager selects multiple individual samples

- **WHEN** a manager selects eligible row checkboxes on one or more loaded pages
- **THEN** the UI SHALL preserve the explicit selection while the manager
  navigates the queue
- **AND** it SHALL display the current selected count
- **AND** the manager SHALL be able to deselect any selected sample.

#### Scenario: Manager selects the full pending queue

- **WHEN** a manager activates `Chọn tất cả`
- **THEN** the UI SHALL request every currently pending approval-visible sample
  ID from the backend across all queue pages
- **AND** it SHALL select the returned exact snapshot
- **AND** samples entering the queue after that snapshot SHALL NOT be silently
  added.

#### Scenario: Manager opens batch confirmation

- **GIVEN** a manager has selected two or more eligible samples
- **WHEN** the manager activates `Duyệt hàng loạt`
- **THEN** the UI SHALL open a confirmation dialog
- **AND** it SHALL show the exact selected count and that processing continues
  in the background
- **AND** no batch SHALL be created before final confirmation.

#### Scenario: Manager cancels batch confirmation

- **WHEN** the manager closes the confirmation dialog or activates `Hủy`
- **THEN** the system SHALL create no approval batch
- **AND** the UI SHALL preserve the current selection.

#### Scenario: Manager confirms multiple selected samples

- **WHEN** a manager activates `Xác nhận duyệt` in the confirmation dialog
- **THEN** the UI SHALL require the existing manager OTP step-up before
  submission
- **AND** it SHALL submit one background approval batch
- **AND** it SHALL show Vietnamese progress after the batch is accepted.

#### Scenario: Loaded-page selection is partial

- **WHEN** some but not all rows on the loaded page are selected
- **THEN** the page-level selection checkbox SHALL display an indeterminate
  state
- **AND** it SHALL NOT imply that the full pending queue is selected.

#### Scenario: Selection contains an item no longer eligible

- **WHEN** batch submission reports that the selected set is no longer valid
- **THEN** the UI SHALL keep the samples unapproved
- **AND** it SHALL show a sanitized Vietnamese error
- **AND** it SHALL refresh approval-queue eligibility.

### Requirement: Manager approval queue SHALL display durable batch progress and outcomes

The approval queue SHALL provide aggregate progress, terminal status, and
per-sample success or sanitized failure outcomes for the requesting manager.
The progress view SHALL survive navigation and reload.

#### Scenario: Batch is processing

- **WHEN** a manager views a nonterminal batch
- **THEN** the UI SHALL display total, waiting, processing, succeeded, and
  failed counts
- **AND** it SHALL refresh the status every one second without blanking the
  approval queue.

#### Scenario: Batch completes with failures

- **WHEN** all items are terminal and at least one item failed
- **THEN** the UI SHALL display `Hoàn tất có lỗi`
- **AND** it SHALL list sanitized per-sample outcomes visible to that manager
- **AND** it SHALL offer `Thử lại mẫu lỗi`.

#### Scenario: Batch completes successfully

- **WHEN** all items succeed
- **THEN** the UI SHALL display `Hoàn tất`
- **AND** polling SHALL stop
- **AND** completed samples SHALL no longer appear in the pending approval
  queue after refresh.

#### Scenario: Manager returns after reload

- **WHEN** the requesting manager reloads or reopens the approval page
- **THEN** the UI SHALL restore their latest active or recently completed batch
- **AND** it SHALL derive progress from server state rather than browser-only
  state.

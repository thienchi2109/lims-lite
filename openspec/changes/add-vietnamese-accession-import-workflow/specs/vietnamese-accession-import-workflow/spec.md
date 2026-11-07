## ADDED Requirements

### Requirement: Single accessible Vietnamese accession entry

The UI SHALL expose “Nhập từ Excel” beside the template action in `AccessionPageHeader` on `/analyst/accession`, preserve mobile wrapping and `WalkthroughTrigger`, and reuse repository keyboard/focus/label patterns. It MUST NOT add a duplicate `/samples` entry.

#### Scenario: Analyst opens and closes the import flow
- **WHEN** an analyst activates the entry by keyboard at desktop or mobile width
- **THEN** the import surface has an accessible name, usable focus order and labeled controls, closing returns focus appropriately, and template/walkthrough controls remain available

### Requirement: Strict file admission and honest cancellation

The UI SHALL admit only a nonempty original workbook strictly below 10,000,000 decimal bytes, show the size rule in Vietnamese, prevent duplicate pending preview requests and allow cancellation. Server validation SHALL remain authoritative, with no client/sample/assignment count caps or browser import engine.

#### Scenario: Decimal boundary is enforced
- **WHEN** files of 9,999,999, 10,000,000 and 10,000,001 bytes are selected
- **THEN** only the first passes the client size gate, and passing that gate does not claim workbook validity

#### Scenario: Preview is canceled or replaced
- **WHEN** an analyst cancels a pending preview or changes the selected file
- **THEN** waiting is canceled where supported, stale responses cannot replace current state, and the UI does not claim that a server preview was rolled back

### Requirement: Complete immutable preview and actionable errors

The UI SHALL display the server preview's counts and create/reuse client decisions, including existing values and fields kept unchanged. It SHALL make every returned validation error accessible with sheet, row, column/header, reason and Vietnamese correction guidance. It MUST NOT edit the immutable preview, truncate errors into a valid/partial preview or treat malformed/unavailable responses as success.

#### Scenario: Valid preview is shown
- **WHEN** the preview API returns a valid result
- **THEN** the analyst sees client/sample/assignment and create/reuse totals, client resolution details and server expiry without a browser-generated payload replacing the preview

#### Scenario: Multiple row failures are returned
- **WHEN** validation returns errors across sheets or related rows
- **THEN** all errors remain reachable with their source locations and remedies, and confirmation is unavailable

### Requirement: Source and preview privacy

The UI SHALL hold selected workbook bytes, preview responses/client display data and error responses only in browser memory, while sending the original file through the approved preview/confirmation API. These data MUST NOT enter durable browser stores/caches, URLs/history, telemetry or logs. The full normalized payload MUST NOT be sent to or retained by the browser; it SHALL remain transient server-side data under the approved contract. The UI SHALL clear abandoned sensitive state on replacement/close/logout as appropriate; a validated batch UUID alone SHALL be sufficient as a recovery locator without granting access.

#### Scenario: Flow is refreshed or abandoned
- **WHEN** the browser refreshes or the analyst abandons a selected workbook
- **THEN** no file/payload/client/error cache restores the source, and any retained batch locator still requires authenticated owner-authorized lookup

### Requirement: Explicit quality attestation and original-file confirmation

The UI SHALL enable confirmation only for a valid unexpired immutable preview, the exact original file and explicit initially unchecked attestation that all samples have been collected and meet quality requirements. Client mutations SHALL use `api-client.ts`. File change, role loss, authority drift, content mismatch or expiry SHALL require a new preview; browser edits MUST NOT repair a committed preview.

#### Scenario: Analyst confirms once
- **WHEN** the analyst attests and confirms the current valid preview
- **THEN** the existing confirmation client sends identical original bytes and attestation, and pending/double-click handling prevents an extra browser submission

#### Scenario: Preview authority changes
- **WHEN** the file changes or the server reports role loss, drift, changed content or expiry
- **THEN** stale confirmation is unavailable and the analyst receives Vietnamese guidance to obtain a new valid preview

#### Scenario: Confirmation response is lost
- **WHEN** a dispatched confirmation times out, aborts or loses its response
- **THEN** the UI preserves unresolved outcome, blocks further mutations and does not claim rollback or terminal failure

### Requirement: Committed receipt and official identifiers

After authorized success the UI SHALL display the durable receipt and official sample identifiers through an established owner-authorized read path, and invalidate relevant existing queries only after confirmed success. Counts alone MUST NOT substitute for official IDs, and the browser MUST NOT invent receipt fields. If the required read path is unavailable, Phase 2 SHALL stop for separately scoped resolution before acceptance.

#### Scenario: Success receipt is available
- **WHEN** the authenticated owner obtains committed success
- **THEN** the UI shows the same batch receipt, server receipt time and committed counts, plus official sample IDs from a verified authorized source without reconstructing source data

#### Scenario: Official identifier read is unproven
- **WHEN** Phase 2 discovery cannot establish an existing authorized receipt-to-sample read
- **THEN** Phase 2 stops with the concrete interface gap and does not silently extend the compact receipt or claim completion

### Requirement: Status-first recovery and eligible linked retries

The UI SHALL query status before retry after timeout/unknown and SHALL preserve `preparing`, `processing` and `unknown` as unresolved. It MUST NOT blindly replay confirmation, report a fabricated failure or start a new upload/attempt while the flow is unresolved. New attempts SHALL use the existing owner-checked linked-preview contract only for eligible states, without resetting the parent.

#### Scenario: Unknown later becomes succeeded
- **WHEN** the confirmation outcome is unknown and status later returns success
- **THEN** the UI shows the existing receipt without another POST or original file requirement

#### Scenario: File is lost and preview remains ready
- **WHEN** status returns unlocked valid `preview_ready` but browser memory no longer holds the source
- **THEN** confirmation requires reselection of the exact original file or an explicit eligible linked new preview, with server byte verification and no reconstruction from metadata

#### Scenario: Terminal attempt is retried
- **WHEN** status returns failed, rejected or expired and the analyst requests a new attempt
- **THEN** the UI uses a new linked preview through the existing retry client and preserves the original attempt's history

### Requirement: Recovery preserves owner isolation

Receipt/status recovery SHALL require current authenticated owner authorization even after refresh, and SHALL clear private displayed data on denial or actor change. A foreign or malformed locator MUST NOT expose another owner's batch, receipt or sample information.

#### Scenario: Different owner opens a recovery locator
- **WHEN** a different owner or withdrawn role requests a saved batch locator
- **THEN** the UI shows the safe Vietnamese denial/login behavior and no foreign batch/receipt/sample details

### Requirement: Review stops and evidence remain explicit

Checkpoint 0 SHALL contain artifacts only. Phases 1, 2 and 3 SHALL each stop for independent source review with focused accessible RED→GREEN evidence and relevant lint/typecheck/React/OpenSpec checks. Browser/runtime checks SHALL occur only in a separately authorized home-server session; UI mocks/source checks MUST NOT establish runtime acceptance. TASK-7 SHALL retain the full capacity, atomicity, security and fault matrix.

#### Scenario: Artifact or source checks pass
- **WHEN** OpenSpec validation or mocked interaction tests pass at a checkpoint
- **THEN** only that evidence lane is recorded as passing, implementation/runtime tasks remain unaccepted until their own checks run, and the next phase does not begin automatically

## Purpose

Provides an embedded Certificate of Analysis preview dialog that keeps users on the current page while viewing CoA documents, with explicit loading, error recovery, and mobile parity.
## Requirements
### Requirement: Embedded CoA preview preserves public portal context

The system SHALL let an authenticated client preview an available Certificate of Analysis inside the public `/coa/access` experience without navigating away from the authenticated sample list.

#### Scenario: Client opens CoA preview from authenticated sample list

- **GIVEN** a client has authenticated successfully in `/coa/access`
- **AND** the client sees a sample with a ready CoA
- **WHEN** the client activates the "Tải Kết Quả" action
- **THEN** the system SHALL open an embedded CoA preview in the current page context
- **AND** the authenticated sample list SHALL remain available behind the preview
- **AND** the preview SHALL load the authorized CoA HTML through the existing CoA access route
- **AND** the preview SHALL provide actions to print, close, and open the document in a full browser tab

#### Scenario: Client preview recovers from expired or invalid session

- **GIVEN** a client is viewing the authenticated sample list
- **WHEN** the preview request returns an authorization failure
- **THEN** the system SHALL display a Vietnamese error state inside the preview UI
- **AND** the system SHALL provide a recovery action that returns the client to the login state
- **AND** the system SHALL NOT display raw JSON or a blank embedded document

### Requirement: Embedded CoA preview is available across staff viewport sizes

The system SHALL let staff preview a ready Certificate of Analysis from the assigned tests workspace on both desktop and mobile layouts.

#### Scenario: Staff opens ready CoA from desktop toolbar

- **GIVEN** a sample is in a completed state and its CoA is ready
- **WHEN** a staff user chooses "Xem CoA đầy đủ" from the desktop CoA actions
- **THEN** the system SHALL open an embedded CoA preview in the assigned tests workspace
- **AND** the system SHALL preserve the current sample context behind the preview
- **AND** the existing "Chỉ in bảng kết quả" action SHALL remain available

#### Scenario: Staff opens ready CoA from mobile overflow menu

- **GIVEN** a sample is in a completed state and its CoA is ready
- **AND** the assigned tests workspace is rendered in the compact/mobile layout
- **WHEN** the staff user opens the overflow menu
- **THEN** the overflow menu SHALL expose "Xem CoA đầy đủ"
- **AND** the overflow menu SHALL expose "Chỉ in bảng kết quả"
- **AND** choosing "Xem CoA đầy đủ" SHALL open the same embedded preview experience used on desktop

### Requirement: Embedded CoA preview provides explicit loading and failure states

The system SHALL render embedded CoA preview states explicitly instead of delegating errors to browser popup or iframe behavior.

#### Scenario: Preview is loading

- **GIVEN** a user has opened the embedded CoA preview
- **WHEN** the document fetch is still in progress
- **THEN** the preview SHALL display a loading state
- **AND** the user SHALL remain on the current page without a new browser tab opening automatically

#### Scenario: Preview request fails

- **GIVEN** a user has opened the embedded CoA preview
- **WHEN** the backing CoA route returns a non-success response
- **THEN** the preview SHALL display a Vietnamese error message
- **AND** the preview SHALL provide a way to close the dialog
- **AND** the preview SHALL provide a way to open the document route in a full browser tab as a fallback
- **AND** the system SHALL NOT present raw JSON as the primary user-facing error experience

### Requirement: Embedded CoA preview provides a dedicated PDF download

The system SHALL provide a Vietnamese "Tải PDF" action in the existing staff and client CoA preview experiences without replacing the HTML preview or its existing actions.

#### Scenario: Client downloads PDF from the public preview

- **GIVEN** an authenticated client has opened a ready CoA in the embedded public preview
- **WHEN** the client activates "Tải PDF"
- **THEN** the preview SHALL request the client-authorized PDF route
- **AND** the current authenticated sample list and HTML preview SHALL remain available
- **AND** the client SHALL receive the PDF as a named attachment when generation succeeds

#### Scenario: Staff downloads PDF from the preview

- **GIVEN** an analyst, manager, or doctor has opened a ready CoA in the embedded staff preview
- **WHEN** the user activates "Tải PDF"
- **THEN** the preview SHALL request the staff-authorized PDF route
- **AND** the existing "Chỉ in bảng kết quả", close, and full-tab actions SHALL remain available

#### Scenario: PDF generation is pending

- **GIVEN** a user has activated "Tải PDF"
- **WHEN** PDF generation has not completed
- **THEN** the preview SHALL display a Vietnamese progress state
- **AND** the download action SHALL prevent duplicate activation
- **AND** the HTML preview SHALL remain visible

#### Scenario: PDF generation fails

- **GIVEN** the PDF request is rejected, rate-limited, fails integrity validation, or encounters a conversion error
- **WHEN** the preview receives the failure response
- **THEN** the preview SHALL display an actionable Vietnamese error
- **AND** the preview SHALL NOT display raw JSON
- **AND** the preview SHALL NOT open the browser print dialog automatically
- **AND** the user SHALL remain able to view or close the HTML preview

#### Scenario: Client PDF token has expired

- **GIVEN** a client is viewing the public CoA preview
- **WHEN** the PDF route rejects an expired or invalid CoA token
- **THEN** the UI SHALL return the client to the existing authentication/login recovery path
- **AND** the UI SHALL NOT automatically retry the PDF request
- **AND** the UI SHALL NOT fall back to the browser print dialog


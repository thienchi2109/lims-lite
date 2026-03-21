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

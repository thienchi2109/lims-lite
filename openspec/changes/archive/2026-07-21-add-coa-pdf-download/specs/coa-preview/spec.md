## ADDED Requirements

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

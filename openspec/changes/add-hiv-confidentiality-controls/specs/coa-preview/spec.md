## ADDED Requirements

### Requirement: Confidential CoA preview requires explicit staff authorization

The system SHALL require confidential authorization before rendering any CoA preview or direct staff-view response for a sample associated with a confidential assay.

#### Scenario: Staff without confidential authorization cannot preview confidential CoA

- **GIVEN** an authenticated analyst or manager without `can_access_confidential = true`
- **AND** the requested CoA belongs to a sample associated with at least one confidential assay
- **WHEN** the staff user opens the embedded CoA preview or direct CoA staff route
- **THEN** the system SHALL deny the request
- **AND** the system SHALL NOT stream the confidential CoA document

#### Scenario: Staff with confidential authorization can preview confidential CoA

- **GIVEN** an authenticated analyst or manager with `can_access_confidential = true`
- **AND** the requested sample has a ready CoA and satisfies existing workflow preconditions
- **WHEN** the staff user opens the embedded CoA preview
- **THEN** the system SHALL render the existing preview experience for that confidential CoA

### Requirement: Confidential CoAs are excluded from the public portal in MVP

The system SHALL keep confidential HIV-related CoAs out of the public `/coa/access` flow until a stronger client verification mechanism exists.

#### Scenario: Public portal excludes confidential sample CoAs

- **GIVEN** a client authenticates successfully in `/coa/access`
- **WHEN** the client account is associated with both standard and confidential samples
- **THEN** the system SHALL only list non-confidential CoAs for download or preview
- **AND** the system SHALL NOT reveal the existence of excluded confidential CoAs through counts, labels, or error details

#### Scenario: Direct public request for confidential CoA is denied

- **GIVEN** a client presents a valid public-session token
- **AND** the requested CoA belongs to a confidential HIV-related sample
- **WHEN** the client attempts to open the preview or download route directly
- **THEN** the system SHALL reject the request with a generic authorization failure
- **AND** the response SHALL NOT disclose whether a confidential CoA exists for that sample

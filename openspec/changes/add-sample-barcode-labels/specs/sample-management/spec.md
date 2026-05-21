## MODIFIED Requirements

### Requirement: Sample barcode label printing
The system SHALL allow authorized internal users to print barcode labels for physical sample containers.

#### Scenario: Print label after accession
- **GIVEN** an analyst has successfully created a sample
- **WHEN** the accession success state is shown
- **THEN** the UI offers `In nhãn barcode`
- **AND** the label encodes only the sample's `sample_id`

#### Scenario: Reprint label from sample detail
- **GIVEN** an analyst or manager can access a sample detail view
- **WHEN** they choose `In nhãn barcode`
- **THEN** the system records a label print request before opening print preview

### Requirement: Privacy-safe sample labels
Sample barcode labels SHALL avoid exposing client identity, test information, or confidentiality indicators.

#### Scenario: Sensitive sample label content
- **GIVEN** a sample is associated with HIV or other confidential testing
- **WHEN** a barcode label is generated
- **THEN** the label does not include client name, phone, CCCD, assay/test names, result status, HIV/confidential markers, portal URLs, or access tokens
- **AND** the barcode payload is only `sample_id`

### Requirement: Audited label print requests
The system SHALL audit every barcode label print/reprint request for sample containers.

#### Scenario: Authorized print request
- **GIVEN** an analyst or manager is authorized to access the sample
- **WHEN** they request barcode label printing
- **THEN** the system writes an audit event for the sample before printing
- **AND** the audit payload contains only non-sensitive print metadata

#### Scenario: Unauthorized confidential print request
- **GIVEN** a sample is confidential-associated
- **AND** the user does not have confidential access
- **WHEN** they request barcode label printing
- **THEN** the request fails closed
- **AND** no print preview is opened

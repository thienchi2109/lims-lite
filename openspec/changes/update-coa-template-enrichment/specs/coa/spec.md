## MODIFIED Requirements
### Requirement: CoA Generation
The system SHALL generate a PDF-ready HTML Certificate of Analysis for approved samples.

#### Scenario: Generate CoA with enriched info
- **WHEN** a Manager requests CoA generation for an approved sample
- **AND** provides manual inputs for "Referrer" and "Sample Quality"
- **THEN** the system retrieves Client details (Name, DOB, Gender, Address, Insurance)
- **AND** retrieves the "Testing Date" from audit logs (first `in_progress` status change)
- **AND** generates an HTML document containing:
  - Full Client and Sample administrative info
  - The manually provided Referrer and Quality values
  - The calculated Testing Date
  - Test results grouped by specialty
  - Manager's electronic signature

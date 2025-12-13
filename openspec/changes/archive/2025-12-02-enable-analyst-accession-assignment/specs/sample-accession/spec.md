## ADDED Requirements

### Requirement: Analysts assign assays during accession for their received samples
The system SHALL allow analysts to assign assays/methods when creating a sample, limited to samples they receive, while keeping managers able to assign tests for any sample.

#### Scenario: Analyst assigns tests at accession for their own sample
- **WHEN** an analyst submits the accession form with selected assays and methods
- **THEN** the system records `received_by` as that analyst, creates pending results for each assay/method pair, and rejects the request if the analyst is not the receiver of the sample.

#### Scenario: Manager retains full assignment rights
- **WHEN** a manager assigns tests to any sample
- **THEN** the operation succeeds without the receiver ownership restriction.

### Requirement: Accession and test assignment execute atomically
The system SHALL create the sample and its initial test assignments in a single transaction so no orphaned samples or partial assignments are produced.

#### Scenario: Roll back on assignment failure
- **WHEN** any test assignment insert fails during accession
- **THEN** the sample creation and all assignments are rolled back and the analyst sees a clear error message.

#### Scenario: Return created identifiers after success
- **WHEN** the accession + assignment transaction succeeds
- **THEN** the response includes the generated `sample_id`, sample record, and the list of assigned assays/methods for confirmation.

### Requirement: Accession UI requires assays/methods and key sample metadata
The analyst accession UI SHALL collect required sample details and at least one assay/method, validating inputs before submission.

#### Scenario: Prevent submission without tests
- **WHEN** an analyst attempts to submit accession without selecting any assay/method
- **THEN** client and server validation block submission and prompt to add at least one test.

#### Scenario: Default method selection and editing
- **WHEN** an analyst selects an assay
- **THEN** its default method is preselected (when available) and the analyst can choose another linked method before submitting the accession.

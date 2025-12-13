## ADDED Requirements

### Requirement: Certificate of Analysis (CoA) Generation

The system SHALL automatically generate a Certificate of Analysis (CoA) PDF report when a sample's status transitions to 'approved'.

#### Scenario: CoA auto-generation on approval

**GIVEN** a sample with status 'in_progress' or 'review'
**WHEN** a manager approves the sample (status changes to 'approved')
**THEN** the system SHALL:
- Trigger an AFTER UPDATE database trigger
- Check if a CoA report already exists for this sample_id
- If no CoA exists, invoke the PDF generation workflow
- Fetch sample metadata, client information, and test results
- Render the CoA using the existing print template
- Convert HTML to PDF format
- Upload the PDF to Supabase Storage bucket 'coa-reports' with path `{sample_id}/{iso-timestamp}.pdf`
- Insert a record in `coa_reports` table with status='ready', file_path, and generated_at timestamp
- Complete within 10 seconds for typical sample (5-10 tests)

#### Scenario: CoA generation failure handling

**GIVEN** the CoA generation workflow is triggered
**WHEN** PDF generation or storage upload fails (e.g., template error, storage unavailable)
**THEN** the system SHALL:
- Insert a record in `coa_reports` table with status='failed' and error_message
- Log the error with full stack trace for debugging
- NOT block the sample approval (sample status remains 'approved')
- Display the error to managers in the sample detail panel
- Provide a "Tạo lại CoA" (Regenerate CoA) button for manual retry

#### Scenario: Manager views CoA status

**GIVEN** a manager is viewing an approved sample's detail panel
**WHEN** the panel loads
**THEN** the system SHALL:
- Display CoA generation status badge (pending/ready/failed)
- Show 'generated_at' timestamp if status is 'ready'
- Provide download link if status is 'ready' (downloads PDF via signed URL)
- Show error message and retry button if status is 'failed'
- Update status automatically when regeneration completes

#### Scenario: CoA prevents duplicate generation

**GIVEN** a sample already has a CoA report (status='ready' or 'failed')
**WHEN** the sample status is updated to 'approved' again (e.g., after re-approval)
**THEN** the system SHALL:
- Check for existing `coa_reports` record with matching sample_id
- Skip CoA generation if record exists
- Managers can manually regenerate using the retry button if needed

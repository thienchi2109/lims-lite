## MODIFIED Requirements

### Requirement: Certificate of Analysis (CoA) Generation

The system SHALL allow authorized users to generate Certificate of Analysis (CoA) PDF reports for approved samples, with role-specific validation rules to ensure data integrity and compliance.

#### Scenario: Manager manually generates CoA for completed sample

**GIVEN** a manager is viewing a sample with status='completed' and at least one approved result
**WHEN** the manager clicks "Tạo CoA" (Generate CoA) button
**THEN** the system SHALL:
- Validate the manager role
- Validate sample has at least one approved result
- Fetch sample metadata, client demographic information (DOB, gender, address, health insurance), and approved test results
- Fetch testing date from audit logs (first status transition to 'in_progress')
- Fetch approver's active signature (if available) or use placeholder
- Verify signature integrity via SHA-256 hash check
- Collect manual inputs via dialog: referrer (required, max 200 chars), sample quality (enum: 'Tốt'|'Đạt'|'Không đạt')
- Render CoA HTML using template (docs/references/CoATemplate.html structure)
- Upload HTML to Supabase Storage bucket 'coa-reports' with path `{sample_id}/{version}-{iso-timestamp}.html`
- Insert record in `coa_reports` table with status='ready', file_path, file_hash (SHA-256), signature_id, version=1
- Return success with CoA ID and file path
- Complete within 5 seconds for typical sample (5-10 tests)

#### Scenario: Manager manually generates CoA for sample in review

**GIVEN** a manager is viewing a sample with status='review' and at least one approved result
**WHEN** the manager clicks "Tạo CoA" button
**THEN** the system SHALL:
- Allow generation even though sample is not fully completed (manager override privilege)
- Generate CoA with only the approved results (partial CoA)
- Follow same workflow as completed sample scenario
- Display warning if not all results are approved

#### Scenario: Analyst manually generates CoA for completed sample

**GIVEN** an analyst is viewing a sample with status='completed' and ALL results approved
**WHEN** the analyst clicks "Tạo CoA" button
**THEN** the system SHALL:
- Validate the analyst role
- Validate sample.status = 'completed' (strict check, no override)
- Validate ALL results for the sample have status='approved' (no pending/entered results allowed)
- If validation passes: generate CoA following same workflow as manager
- If validation fails: return Vietnamese error message explaining the specific validation failure

#### Scenario: Analyst blocked from generating CoA with partial approvals

**GIVEN** an analyst is viewing a sample with status='completed' but some results are still pending/entered
**WHEN** the analyst clicks "Tạo CoA" button
**THEN** the system SHALL:
- Validate ALL results are approved
- Count unapproved results
- Return error message: "Không thể tạo CoA: {count} kết quả chưa được phê duyệt"
- Do NOT generate CoA
- Display error in UI toast notification

#### Scenario: Analyst blocked from generating CoA for non-completed sample

**GIVEN** an analyst is viewing a sample with status='review' (or 'in_progress', 'assigned', 'received')
**WHEN** the analyst clicks "Tạo CoA" button
**THEN** the system SHALL:
- Validate sample.status = 'completed'
- Return error message: "Chỉ có thể tạo CoA cho mẫu đã hoàn thành (completed)"
- Do NOT generate CoA
- Display error in UI toast notification

#### Scenario: Analyst blocked from regenerating existing CoA

**GIVEN** an analyst is viewing a sample that already has a CoA with status='ready'
**WHEN** the analyst attempts to call `regenerateCoA()` server action
**THEN** the system SHALL:
- Validate user role
- Return error message: "Chỉ Quản lý mới có thể tạo lại CoA"
- Do NOT regenerate CoA
- Existing CoA remains unchanged

#### Scenario: Manager regenerates CoA (privilege retained)

**GIVEN** a manager is viewing a sample with an existing CoA (status='ready')
**WHEN** the manager clicks "Tạo lại CoA" (Regenerate CoA) button
**THEN** the system SHALL:
- Validate manager role
- Mark existing CoA as status='failed' with error_message='Regenerating CoA'
- Generate new CoA HTML file
- Upload to storage with new timestamp
- Update `coa_reports` record with new file_path, file_hash, signature_id, status='ready'
- Delete old file from storage
- If regeneration fails: restore previous status='ready' and file_path (rollback)

#### Scenario: CoA generation with manual inputs validation

**GIVEN** a user (analyst or manager) is generating a CoA
**WHEN** the CoA Generation Dialog is submitted
**THEN** the system SHALL:
- Validate `referrer` field: required, min 1 char, max 200 chars, string
- Validate `sampleQuality` field: required, must be one of ['Tốt', 'Đạt', 'Không đạt']
- If validation fails: return error message in Vietnamese with specific field error
- If validation passes: include manual inputs in CoA HTML template (sections: "Bác sĩ chỉ định" and "Chất lượng mẫu")

#### Scenario: CoA generation failure handling

**GIVEN** the CoA generation workflow is triggered (by analyst or manager)
**WHEN** HTML generation or storage upload fails (e.g., template error, storage unavailable, signature download fails)
**THEN** the system SHALL:
- Insert a record in `coa_reports` table with status='failed' and error_message
- Log the error with full stack trace for debugging
- Return error to user with Vietnamese message: "Đã xảy ra lỗi khi tạo CoA"
- Display error in UI toast notification
- Do NOT block sample workflow
- Managers can retry using "Tạo lại CoA" button

#### Scenario: CoA prevents duplicate generation

**GIVEN** a sample already has a CoA report with status='ready'
**WHEN** a user (analyst or manager) attempts to call `generateCoA()`
**THEN** the system SHALL:
- Check for existing `coa_reports` record with matching sample_id and status='ready'
- Return error message: "CoA đã được tạo cho mẫu này. Sử dụng chức năng tạo lại CoA nếu cần cập nhật."
- Do NOT generate duplicate CoA
- Direct user to use `regenerateCoA()` instead (manager only)

#### Scenario: Audit trail captures generator identity

**GIVEN** a CoA is successfully generated by any user (analyst or manager)
**WHEN** the CoA record is inserted into `coa_reports` table
**THEN** the system SHALL:
- Capture user_id of the generator (from auth.uid()) in audit log trigger
- Record operation='INSERT' in `audit_logs` table
- Store new_values with: sample_id, file_path, signature_id, status, generated_at
- Preserve approver identity in `signature_id` FK (links to manager who approved results)
- Maintain 21 CFR Part 11 compliance: signature (approver) ≠ generator (analyst/manager)

## ADDED Requirements

### Requirement: CoA Access Audit Trail

The system SHALL maintain a comprehensive audit trail of all Certificate of Analysis access attempts for compliance and security monitoring.

#### Scenario: Successful access logged

**GIVEN** a client successfully authenticates and downloads a CoA report
**WHEN** the download completes
**THEN** the system SHALL:
- Insert record in `coa_access_log` table with client_id, sample_id, accessed_at (current timestamp), IP address, success=true
- Capture request IP from HTTP headers (X-Forwarded-For or remote address)
- Store NULL in failure_reason field
- Record is immutable (no updates or deletes, insert-only)

#### Scenario: Failed access logged

**GIVEN** a client authentication fails (wrong passcode) or download is denied (invalid token)
**WHEN** the failure occurs
**THEN** the system SHALL:
- Insert record in `coa_access_log` table with client_id (if identifiable, else NULL), sample_id (if applicable, else NULL), accessed_at, IP address, success=false
- Store failure reason in `failure_reason` field (e.g., "Invalid passcode", "Token expired", "Rate limit exceeded")
- Do NOT log sensitive data (do not store attempted passcode)
- Record is immutable

#### Scenario: Manager views access audit log

**GIVEN** a manager wants to review CoA access history
**WHEN** the manager navigates to the audit log viewer
**THEN** the system SHALL:
- Display list of `coa_access_log` records with filters: date range, client, sample, success status
- Show columns: timestamp, client name, sample ID, IP address (masked last octet for privacy: 192.168.1.xxx), success, failure reason
- Sort by accessed_at DESC (most recent first)
- Paginate results (50 per page)
- Allow export to CSV for compliance reporting
- Require manager role (analyst cannot access)

#### Scenario: Access log retention and privacy

**GIVEN** CoA access logs are stored for compliance
**WHEN** logs are older than 90 days
**THEN** the system SHALL:
- Retain logs for minimum 1 year (configurable, default 365 days)
- After 90 days: anonymize IP addresses (replace with NULL or masked value) for privacy
- After retention period: soft delete (set deleted_at) or archive to cold storage
- Never hard delete logs (audit trail requirement)

### Requirement: CoA Report Storage and Lifecycle

The system SHALL store generated CoA PDF files in Supabase Storage with appropriate access controls and lifecycle management.

#### Scenario: CoA file stored securely

**GIVEN** a CoA PDF is successfully generated
**WHEN** the file is uploaded to Storage
**THEN** the system SHALL:
- Store file in bucket 'coa-reports' with path `{sample_id}/{iso-timestamp}.pdf`
- Set file permissions via RLS: INSERT (manager/analyst service role), SELECT (manager/analyst or signed URLs), deny UPDATE/DELETE
- Record file_path in `coa_reports` table
- File is immutable (no updates allowed; regenerate creates new file)

#### Scenario: CoA accessed via signed URL

**GIVEN** a client requests to download a CoA report
**WHEN** the download link is generated
**THEN** the system SHALL:
- Create signed URL with 15-minute expiry using Supabase Storage API
- URL includes authentication signature (cannot be forged)
- URL expires after 15 minutes (subsequent access requires re-authentication)
- Do NOT allow direct public access (RLS enforced)

#### Scenario: CoA file retention policy

**GIVEN** CoA files accumulate in Storage over time
**WHEN** a file is older than the retention period (configurable, default 1 year)
**THEN** the system SHALL:
- Keep file accessible for minimum 1 year from generated_at
- After retention period: mark `coa_reports.deleted_at` (soft delete)
- Archive or permanently delete file from Storage (configurable)
- Maintain metadata in `coa_reports` table for audit trail
- Compliance requirements may dictate longer retention (e.g., 7 years for medical records)

#### Scenario: Manager downloads CoA internally

**GIVEN** a manager views an approved sample's detail panel
**WHEN** the manager clicks the CoA download link
**THEN** the system SHALL:
- Verify manager role via RLS
- Generate signed URL with 15-minute expiry
- Download file without logging to `coa_access_log` (internal access, not client-facing)
- Optionally: log internal downloads separately for audit if required

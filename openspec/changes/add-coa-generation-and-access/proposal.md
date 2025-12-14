## Why
- Clients need to access their Certificate of Analysis (CoA) reports remotely without requiring analyst intervention or system login credentials.
- Current system lacks a public-facing CoA retrieval mechanism; reports exist only in internal workflows.
- **21 CFR Part 11 compliance requires:** Approved records must be immutable, retrievable artifacts (not dynamic queries) - CoA must be stored as static document at approval time.
- Industry standard practice for healthcare labs: issue formal reports as versioned documents, preserve original even if data corrected later.

## What Changes
- Add `coa_reports` table to store HTML file metadata (sample_id FK, file_path in Supabase Storage, generated_at timestamp, file_hash for integrity verification, version INT default 1, status enum: pending/ready/failed, superseded_by UUID nullable for amendments).
- Implement server-side HTML generation workflow triggered when sample status transitions to 'approved': fetch sample + test results data, render HTML using template (reference: `docs/references/CoATemplate.html`), upload to Supabase Storage `coa-reports/` bucket, store metadata with file hash in `coa_reports`.
- CoA template structure: organization header (CDC logo, name, address), sample info table (patient name, DOB, gender, phone, address, collection date, sample quality), results table grouped by test category, signature footer (technician, lab director with approver name), QR code with sample ID, footer disclaimer, version watermark if amended.
- Create public CoA access portal at `/coa/access` allowing clients to retrieve reports using phone number + passcode (last 6 digits of phone) authentication without system login.
- Add phone-based authentication mechanism: validate phone format (Vietnamese mobile format: 0[3|5|7|8|9][0-9]{8}), match against `clients.phone`, verify passcode (last 6 digits), return associated approved samples with CoA signed URLs.
- Extend RLS on storage bucket: public read access only via signed URLs (1-hour expiry) generated after phone-based auth; managers/analysts can read/write all files; enforce path prefix `coa-reports/{sample_id}/`.
- Add `coa_access_log` table for compliance auditing (client_id, sample_id, coa_report_id FK, accessed_at, ip_address, user_agent, success boolean).
- Support amendments: if approved sample data is corrected, generate new HTML file marked "Amended Report v{N}", link to previous version via `superseded_by`, preserve all versions for audit trail.

## Impact
- **Affected specs:** sample-management (add CoA generation on approval), client-management (add CoA access requirement), reporting (new capability).
- **Affected code:**
  - Database: new tables (`coa_reports`, `coa_access_log`), storage bucket `coa-reports/` with RLS policies, trigger on `samples` status change to 'approved'
  - Backend: HTML template generation utility, storage upload service action, phone-based auth server action, signed URL generation for CoA files, amendment workflow for corrections
  - Frontend: public CoA access portal (`/coa/access`), client phone + passcode form, sample list with CoA download links, HTML viewer/print option
  - Infrastructure: Supabase Storage bucket configuration, RLS policies on storage (`coa-reports/` prefix), cleanup job for expired files (optional: retention policy)
- **Security:** Phone-based authentication (last 6 digits as passcode) balances accessibility with reasonable security for non-critical health data; signed URLs with 1-hour expiry; rate limiting on auth attempts (max 5 failures/15min per phone number); all access logged with IP and user agent.
- **Compliance:**
  - **21 CFR Part 11:** Approved CoA stored as immutable HTML file with hash verification; amendments create new versioned file (original preserved); audit trail logs all generation and access events.
  - **Data Integrity:** File hash stored in DB to detect tampering; original approved reports never modified (amendments = new version).
  - **Retention:** CoA files retained for minimum 2 years (configurable); soft-delete for `coa_reports` metadata.
  - **Audit Trail:** `coa_access_log` records every client access with timestamp, IP, success/failure.
- **Dependencies:** Requires `add-clients-and-link-samples` to be completed first (needs `clients.phone` field).
- **Performance:** HTML files ~30-50 KB each; storage costs negligible (~500 MB/year for 10K samples); generation time <2 seconds per report.

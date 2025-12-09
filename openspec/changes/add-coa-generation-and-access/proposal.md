## Why
- Clients need to access their Certificate of Analysis (CoA) reports remotely without requiring analyst intervention or system login credentials.
- Current system lacks a public-facing CoA retrieval mechanism; reports exist only in internal workflows.
- Healthcare compliance requires secure, auditable, client-accessible test result delivery with proper authentication.

## What Changes
- Add `coa_reports` table to store PDF metadata (sample_id FK, file_path in Supabase Storage, generated_at, accessed_at timestamps, status enum: pending/ready/failed).
- Implement server-side PDF generation workflow triggered when sample status transitions to 'approved': render CoA using existing print template logic, upload to Supabase Storage `coa-reports/` bucket with RLS, store metadata in `coa_reports`.
- Create public CoA access portal at `/coa/access` allowing clients to retrieve reports using phone number + passcode (last 6 digits of phone) authentication without system login.
- Add phone-based authentication mechanism: validate phone format, match against `clients.phone`, verify passcode (last 6 digits), return associated approved samples with CoA links.
- Extend RLS on storage bucket: public read access only for authenticated CoA requests (via signed URLs with expiry); managers/analysts can read/write; audit all access attempts.
- Add CoA access logging in `coa_access_log` table (client_id, sample_id, accessed_at, ip_address, success boolean) for compliance auditing.

## Impact
- **Affected specs:** sample-management (add CoA generation requirement), client-management (add CoA access requirement), reporting (new capability).
- **Affected code:** 
  - Database: new tables (`coa_reports`, `coa_access_log`), storage bucket with RLS, triggers for auto-generation on approval
  - Backend: PDF generation service action, phone-based auth endpoint, storage upload/retrieval logic
  - Frontend: public CoA access portal (`/coa/access`), client phone + passcode form, PDF viewer/download
  - Infrastructure: Supabase Storage bucket configuration, RLS policies, signed URL generation
- **Security:** Phone-based authentication is intentionally simple (last 6 digits as passcode) balancing accessibility with reasonable security for non-critical health data; audit logging required; implement rate limiting on auth attempts.
- **Compliance:** All CoA access logged with timestamps and IP; soft-delete for coa_reports; RLS enforced on storage; follows 21 CFR Part 11 audit trail requirements.
- **Dependencies:** Requires `add-clients-and-link-samples` to be completed first (needs `clients.phone` field).

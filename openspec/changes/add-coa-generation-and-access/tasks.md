## 1. Design & Decisions ✅
- [x] 1.1 Review existing HTML template structure (`docs/references/CoATemplate.html`)
- [x] 1.2 Define CoA retention policy (suggest 2 years minimum per compliance, configurable)
- [x] 1.3 Finalize RLS policy matrix for coa_reports, coa_access_log, and Storage bucket
- [x] 1.4 Review security checklist and rate limiting strategy
- [x] 1.5 Decide on HTML template data binding approach (server-side string interpolation vs template engine)

## 2. Database Migration ✅
- [x] 2.1 Create `coa_reports` table with file_hash, version, superseded_by columns; constraints, indexes, audit triggers, RLS policies; document Security Impact: Medium
- [x] 2.2 Create `coa_access_log` table with constraints, indexes, audit triggers, RLS policies
- [x] 2.3 Add AFTER UPDATE trigger on `samples` to auto-generate CoA HTML on status='approved'
- [x] 2.4 Create indexes: `coa_reports(sample_id)`, `coa_reports(version)`, `coa_access_log(client_id, accessed_at)`
- [x] 2.5 Run `run_security_tests()` and validate constraints

## 3. Storage Infrastructure ✅
- [x] 3.1 Create `coa-reports` bucket in Supabase Storage with RLS policies
- [x] 3.2 Configure bucket policies: INSERT (manager/analyst), SELECT (manager/analyst/signed URLs), deny UPDATE/DELETE
- [x] 3.3 Test signed URL generation with 1-hour expiry
- [x] 3.4 Document storage path structure: `{sample_id}/{version}-{iso-timestamp}.html`

## 4. Backend - HTML Generation
- [x] 4.1 Create server action `generateCoA(sample_id)` with error handling
- [x] 4.2 Implement data fetching logic (sample + client + test results)
- [x] 4.3 Create HTML template rendering function based on `CoATemplate.html`
- [x] 4.4 Implement file hash generation (SHA-256) for integrity verification
- [x] 4.5 Upload HTML to Storage and insert `coa_reports` record with file_hash and status
- [x] 4.6 Test HTML output matches reference template
- [x] 4.7 Handle errors: insert failed status + error_message on failure

## 5. Backend - Authentication & Access
- [x] 5.1 Create phone normalization helper `normalizePhoneVN()` (+84 ↔ 0 conversion)
- [x] 5.2 Implement rate limiting middleware (5 attempts/15min/IP, in-memory or Redis)
- [x] 5.3 Create `/api/coa/authenticate` POST endpoint with validation
- [x] 5.4 Implement passcode verification (last 6 digits of phone)
- [x] 5.5 Create JWT signing/verification for download tokens (1-hour expiry)
- [x] 5.6 Create `/api/coa/download` endpoint with token validation, signed URL generation (1-hour expiry), audit logging
- [x] 5.7 Update Zod schemas and types for CoA authentication and download

## 6. Frontend - Public Portal
- [x] 6.1 Create `/coa/access` public page with Vietnamese UI
- [x] 6.2 Build phone + passcode form with validation (6-digit masked input)
- [x] 6.3 Display approved samples list with download links on success
- [x] 6.4 Handle auth errors with generic message (don't reveal if phone exists)
- [x] 6.5 Add loading states and error handling
- [x] 6.6 Test responsive design and accessibility

## 7. Frontend - Manager Features ✅
- [x] 7.1 Add CoA status indicator to sample detail panel
- [x] 7.2 Create "Tạo lại CoA" (Regenerate CoA) button for failed generations
- [x] 7.3 Display CoA generation errors to managers with retry option
- [x] 7.4 Add CoA access log viewer for managers (audit trail)

## 8. Testing & Validation
- [ ] 8.1 Test full workflow: approve sample → HTML auto-generated → verify Storage upload with file hash
- [ ] 8.2 Test public portal: phone auth → sample list → download → audit log
- [ ] 8.3 Test rate limiting: verify 429 after 5 failed attempts
- [ ] 8.4 Test phone normalization: +84 and 0 prefix both work
- [ ] 8.5 Test JWT expiry: tokens invalid after 1 hour
- [ ] 8.6 Test RLS policies: verify access controls on tables and Storage
- [ ] 8.7 Verify audit logging: all access attempts logged with IP and user agent
- [ ] 8.8 Test amendment workflow: generate new version, verify superseded_by linkage
- [ ] 8.9 Test file hash integrity: verify hash matches actual file content
- [ ] 8.10 Run typecheck, lint, and security validation

## 9. Documentation
- [ ] 9.1 Document CoA access flow for clients (Vietnamese user guide)
- [ ] 9.2 Document API endpoints (`/api/coa/authenticate`, `/api/coa/download`)
- [ ] 9.3 Add troubleshooting guide (common errors, rate limiting, token expiry)
- [ ] 9.4 Update README with CoA feature overview
- [ ] 9.5 Document security model and compliance considerations

## 1. Design & Decisions
- [ ] 1.1 Confirm PDF library choice (puppeteer vs react-pdf) based on existing dependencies
- [ ] 1.2 Define CoA retention policy (suggest 1 year minimum, configurable)
- [ ] 1.3 Finalize RLS policy matrix for coa_reports, coa_access_log, and Storage bucket
- [ ] 1.4 Review security checklist and rate limiting strategy

## 2. Database Migration
- [ ] 2.1 Create `coa_reports` table with constraints, indexes, audit triggers, RLS policies; document Security Impact: Medium
- [ ] 2.2 Create `coa_access_log` table with constraints, indexes, audit triggers, RLS policies
- [ ] 2.3 Add AFTER UPDATE trigger on `samples` to auto-generate CoA on status='approved'
- [ ] 2.4 Create indexes: `coa_reports(sample_id)`, `coa_access_log(client_id, accessed_at)`
- [ ] 2.5 Run `run_security_tests()` and validate constraints

## 3. Storage Infrastructure
- [ ] 3.1 Create `coa-reports` bucket in Supabase Storage with RLS policies
- [ ] 3.2 Configure bucket policies: INSERT (manager/analyst), SELECT (manager/analyst/signed URLs), deny UPDATE/DELETE
- [ ] 3.3 Test signed URL generation with 15-minute expiry
- [ ] 3.4 Document storage path structure: `{sample_id}/{iso-timestamp}.pdf`

## 4. Backend - PDF Generation
- [ ] 4.1 Install PDF library (puppeteer or react-pdf) and dependencies
- [ ] 4.2 Create server action `generateCoA(sample_id)` with error handling
- [ ] 4.3 Integrate existing print template (`src/lib/print-template.ts`) - render to HTML
- [ ] 4.4 Implement HTML→PDF conversion with inline CSS
- [ ] 4.5 Upload PDF to Storage and insert `coa_reports` record with status
- [ ] 4.6 Test PDF output matches print preview
- [ ] 4.7 Handle errors: insert failed status + error_message on failure

## 5. Backend - Authentication & Access
- [ ] 5.1 Create phone normalization helper `normalizePhoneVN()` (+84 ↔ 0 conversion)
- [ ] 5.2 Implement rate limiting middleware (5 attempts/15min/IP, in-memory or Redis)
- [ ] 5.3 Create `/api/coa/authenticate` POST endpoint with validation
- [ ] 5.4 Implement passcode verification (last 6 digits of phone)
- [ ] 5.5 Create JWT signing/verification for download tokens (15-min expiry)
- [ ] 5.6 Create `/api/coa/download` endpoint with token validation, signed URL generation, audit logging
- [ ] 5.7 Update Zod schemas and types for CoA authentication and download

## 6. Frontend - Public Portal
- [ ] 6.1 Create `/coa/access` public page with Vietnamese UI
- [ ] 6.2 Build phone + passcode form with validation (6-digit masked input)
- [ ] 6.3 Display approved samples list with download links on success
- [ ] 6.4 Handle auth errors with generic message (don't reveal if phone exists)
- [ ] 6.5 Add loading states and error handling
- [ ] 6.6 Test responsive design and accessibility

## 7. Frontend - Manager Features
- [ ] 7.1 Add CoA status indicator to sample detail panel
- [ ] 7.2 Create "Tạo lại CoA" (Regenerate CoA) button for failed generations
- [ ] 7.3 Display CoA generation errors to managers with retry option
- [ ] 7.4 Add CoA access log viewer for managers (audit trail)

## 8. Testing & Validation
- [ ] 8.1 Test full workflow: approve sample → PDF auto-generated → verify Storage upload
- [ ] 8.2 Test public portal: phone auth → sample list → download → audit log
- [ ] 8.3 Test rate limiting: verify 429 after 5 failed attempts
- [ ] 8.4 Test phone normalization: +84 and 0 prefix both work
- [ ] 8.5 Test JWT expiry: tokens invalid after 15 minutes
- [ ] 8.6 Test RLS policies: verify access controls on tables and Storage
- [ ] 8.7 Verify audit logging: all access attempts logged with IP
- [ ] 8.8 Run typecheck, lint, and security validation

## 9. Documentation
- [ ] 9.1 Document CoA access flow for clients (Vietnamese user guide)
- [ ] 9.2 Document API endpoints (`/api/coa/authenticate`, `/api/coa/download`)
- [ ] 9.3 Add troubleshooting guide (common errors, rate limiting, token expiry)
- [ ] 9.4 Update README with CoA feature overview
- [ ] 9.5 Document security model and compliance considerations

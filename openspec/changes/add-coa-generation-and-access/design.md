## Context
- Need to provide clients with secure, self-service access to their Certificate of Analysis (CoA) reports.
- Existing system has print template for CoA generation but no storage, public portal, or client-facing authentication.
- Must balance accessibility (simple auth for non-technical clients) with security and compliance (audit trails, RLS).
- Requires `add-clients-and-link-samples` change to provide `clients.phone` for authentication.

## Goals / Non-Goals
- Goals: auto-generate CoA PDFs on approval, store in Supabase Storage with RLS, provide public portal with phone-based auth, log all access, integrate with existing print template.
- Non-Goals: email/SMS notifications (future enhancement), complex multi-factor auth, client account creation, PDF customization UI, historical report versioning (use audit log).

## Decisions

### Data Model
- **coa_reports table:** `id UUID PK`, `sample_id UUID NOT NULL REFERENCES samples(id)`, `file_path TEXT NOT NULL` (Storage path: `coa-reports/{sample_id}/{timestamp}.pdf`), `generated_at TIMESTAMPTZ DEFAULT now()`, `accessed_at TIMESTAMPTZ NULL` (last access time), `status TEXT CHECK IN ('pending','ready','failed')`, `error_message TEXT NULL`, `created_at/updated_at` with defaults, `deleted_at TIMESTAMPTZ NULL` (soft delete).
- **coa_access_log table:** `id UUID PK`, `client_id UUID REFERENCES clients(id)`, `sample_id UUID REFERENCES samples(id)`, `accessed_at TIMESTAMPTZ DEFAULT now()`, `ip_address TEXT`, `success BOOLEAN NOT NULL`, `failure_reason TEXT NULL`, audit timestamps.
- **Storage bucket:** `coa-reports` with RLS; path structure: `{sample_id}/{iso-timestamp}.pdf`; signed URLs with 15-minute expiry for client access.

### PDF Generation Workflow
- **Trigger:** AFTER UPDATE on `samples` when `status` changes to `'approved'` and `coa_reports.sample_id` does not exist (prevent duplicates).
- **Process:** Server action `generateCoA(sample_id)` → fetch sample + client + test results → render using existing print template (React component to HTML) → convert HTML to PDF using library (puppeteer or similar) → upload to Storage → insert `coa_reports` record with status 'ready'.
- **Error handling:** On failure, insert `coa_reports` with status 'failed' + error_message; managers can retry via UI action.
- **Library choice:** Use `react-pdf` or `puppeteer` for HTML→PDF; prefer `puppeteer` for consistency with existing browser automation if available, otherwise `react-pdf` for lighter footprint.

### Authentication Mechanism
- **Endpoint:** Public API route `/api/coa/authenticate` (POST with rate limiting: 5 attempts per IP per 15 minutes).
- **Request:** `{ phone: string, passcode: string }` (passcode = last 6 digits of phone).
- **Validation:** 
  1. Validate phone format (Vietnamese: `^(0|\+84)[0-9]{9,10}$`)
  2. Query `clients` WHERE `phone = normalized_phone` (normalize +84 ↔ 0 prefix)
  3. Extract last 6 digits from stored phone, compare with provided passcode
  4. On success: return `client_id` + list of approved `samples` with CoA download tokens
  5. On failure: log to `coa_access_log` with success=false, return generic error (don't reveal if phone exists)
- **Security:** Intentionally simple (low-stakes health data); rate limiting prevents brute force; audit log tracks attempts; consider CAPTCHA for production.

### CoA Access Flow
- **Portal:** Public page `/coa/access` (no auth required to view form; Vietnamese UI).
- **Form:** Phone input + passcode input (6 digits, masked) + submit button.
- **Success response:** Display list of client's approved samples with "Tải xuống CoA" (Download CoA) links.
- **Download:** Generate signed URL (15-min expiry) via `/api/coa/download?sample_id={id}&token={jwt}` → verify token → fetch `coa_reports.file_path` → create signed Storage URL → log access to `coa_access_log` → redirect/return PDF.
- **Token:** JWT containing `client_id` + `sample_id` + `exp` (15 min), signed with server secret; validated before granting download.

### Storage RLS Policies
- **Bucket:** `coa-reports` with policies:
  1. INSERT: Allow authenticated users with role 'manager' OR 'analyst' (for generation workflow using service role)
  2. SELECT: Allow authenticated users with role 'manager' OR 'analyst' OR public via signed URLs (Supabase handles signed URL validation)
  3. UPDATE/DELETE: Deny all (use soft delete in `coa_reports` table; Storage files are immutable)
- **Path security:** Signed URLs include token validation; even if path is guessed, RLS + signature prevents unauthorized access.

### Existing Print Template Integration
- **Current:** `src/lib/print-template.ts` exports React component rendering CoA layout.
- **Reuse:** Import template in server action, render to HTML string using `ReactDOMServer.renderToStaticMarkup()`, pass to PDF library.
- **Styling:** Ensure CSS is inline or embedded; test PDF output matches print preview.

## Alternatives Considered
- **Email delivery:** Rejected for MVP; requires SMTP setup and client email validation; portal access is simpler and allows re-download.
- **SMS passcode:** Rejected; adds cost and complexity; phone number itself + last 6 digits is sufficient for low-stakes data.
- **Client accounts:** Rejected; overhead of registration/password management; phone-based auth is frictionless.
- **Real-time generation:** Rejected; pre-generate on approval to reduce wait time and load; store for auditing.
- **Database storage (bytea):** Rejected; Supabase Storage preferred for large files, better scalability, CDN support.

## Risks / Trade-offs
- **Weak authentication:** Last 6 digits of phone is predictable; mitigated by rate limiting, audit logging, low-stakes data; acceptable for MVP.
- **Phone number privacy:** Phone is exposed if someone has client name+DOB; mitigated by requiring both phone and passcode; consider masking phone display in UI.
- **Storage costs:** PDF files accumulate; mitigate with retention policy (e.g., auto-delete after 90 days) or archive old reports.
- **PDF generation performance:** Puppeteer is heavy; may need background job queue if generation is slow; for MVP, block on generation (samples approved infrequently).
- **Phone normalization:** +84 vs 0 prefix must be handled consistently; normalize on input and storage query.

## Migration Plan
1. **Database schema:** Create `coa_reports` and `coa_access_log` tables with constraints, indexes (`sample_id`, `client_id`), audit triggers, RLS policies (analyst/manager role checks). Security Impact: Medium (new public-facing auth vector).
2. **Storage setup:** Create `coa-reports` bucket in Supabase, configure RLS policies, test signed URL generation.
3. **PDF generation:** Implement server action with existing template, test HTML→PDF conversion, upload to Storage, insert metadata.
4. **Trigger setup:** Add AFTER UPDATE trigger on `samples` to invoke PDF generation; handle errors gracefully.
5. **Public portal:** Create `/coa/access` page, implement auth API route with rate limiting, build UI (Vietnamese labels).
6. **Download endpoint:** Implement JWT-based download API, integrate signed URLs, log access.
7. **Testing:** Test full flow (approve sample → PDF generated → client access via phone → download → audit log), verify RLS, load test rate limiting.
8. **Documentation:** Update user guide with CoA access instructions (Vietnamese), document API endpoints, add troubleshooting guide.

## Open Questions
- **PDF library preference:** Puppeteer (heavy, accurate) vs react-pdf (lighter)? → Decide based on existing dependencies; if puppeteer already in use, prefer it.
- **Retention policy:** How long to keep CoA files in storage? → Define based on compliance requirements; suggest 1 year minimum, configurable.
- **Error retry UI:** Should managers see failed generations and retry? → Yes, add to sample detail view with "Tạo lại CoA" (Regenerate CoA) button.
- **Multiple phones per client:** What if client updates phone? → Use current phone at access time; old CoAs still accessible via new phone (client_id link).

## Implementation Notes
- **Phone normalization function:** Create helper `normalizePhoneVN(phone: string): string` to convert +84 ↔ 0 consistently; use in auth and client creation.
- **Rate limiting:** Use IP-based in-memory cache (or Redis if available) to track attempts; reset after 15 minutes; return 429 Too Many Requests.
- **JWT secret:** Use `process.env.JWT_SECRET` for signing download tokens; ensure strong secret in production.
- **Audit logging:** Log both success and failure attempts with IP; consider anonymizing IP after 30 days for GDPR-style privacy.
- **Vietnamese labels:** 
  - "Truy cập Giấy chứng nhận phân tích" (Access Certificate of Analysis)
  - "Số điện thoại" (Phone number)
  - "Mật khẩu (6 chữ số cuối của số điện thoại)" (Passcode - last 6 digits of phone)
  - "Tải xuống CoA" (Download CoA)
  - "Không tìm thấy mẫu hoặc mật khẩu không đúng" (Sample not found or incorrect passcode)

## Security Checklist
- [ ] Rate limiting on auth endpoint (5 attempts/15 min/IP)
- [ ] Generic error messages (don't reveal if phone exists)
- [ ] JWT tokens with short expiry (15 min) for downloads
- [ ] Signed Storage URLs with expiry
- [ ] Audit logging for all access attempts (success + failure)
- [ ] RLS policies on `coa_reports`, `coa_access_log`, Storage bucket
- [ ] Phone normalization to prevent bypass via format variations
- [ ] HTTPS only for public portal (enforce in production)
- [ ] Consider CAPTCHA if abuse detected

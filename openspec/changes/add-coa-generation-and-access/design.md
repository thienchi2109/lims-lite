## Context
- Need to provide clients with secure, self-service access to their Certificate of Analysis (CoA) reports.
- Existing system has HTML print template for CoA generation (`docs/references/CoATemplate.html`) but no storage, public portal, or client-facing authentication.
- Must balance accessibility (simple auth for non-technical clients) with security and compliance (audit trails, RLS, immutable records per 21 CFR Part 11).
- Requires `add-clients-and-link-samples` change to provide `clients.phone` for authentication.

## Goals / Non-Goals
- Goals: auto-generate CoA HTML files on approval, store immutably in Supabase Storage with file hash verification, provide public portal with phone-based auth, log all access, support amendments with versioning, integrate with existing HTML template.
- Non-Goals: email/SMS notifications (future enhancement), complex multi-factor auth, client account creation, HTML customization UI, PDF generation (future enhancement if needed).

## Decisions

### Data Model
- **coa_reports table:** `id UUID PK`, `sample_id UUID NOT NULL REFERENCES samples(id)`, `file_path TEXT NOT NULL` (Storage path: `coa-reports/{sample_id}/{version}-{timestamp}.html`), `generated_at TIMESTAMPTZ DEFAULT now()`, `file_hash TEXT NOT NULL` (SHA-256 hash for integrity verification), `version INT DEFAULT 1` (increment for amendments), `status TEXT CHECK IN ('pending','ready','failed')`, `superseded_by UUID NULL REFERENCES coa_reports(id)` (for amendment trail), `error_message TEXT NULL`, `created_at/updated_at` with defaults, `deleted_at TIMESTAMPTZ NULL` (soft delete).
- **coa_access_log table:** `id UUID PK`, `client_id UUID REFERENCES clients(id)`, `sample_id UUID REFERENCES samples(id)`, `coa_report_id UUID REFERENCES coa_reports(id)`, `accessed_at TIMESTAMPTZ DEFAULT now()`, `ip_address TEXT`, `user_agent TEXT`, `success BOOLEAN NOT NULL`, `failure_reason TEXT NULL`, audit timestamps.
- **Storage bucket:** `coa-reports` with RLS; path structure: `{sample_id}/{version}-{iso-timestamp}.html`; signed URLs with 1-hour expiry for client access.

### HTML Generation Workflow
- **Trigger:** AFTER UPDATE on `samples` when `status` changes to `'approved'` and `coa_reports.sample_id` does not exist (prevent duplicates on first approval).
- **Process:** Server action `generateCoA(sample_id)` → fetch sample + client + test results → render HTML using template based on `CoATemplate.html` → generate SHA-256 hash of HTML content → upload HTML to Storage → insert `coa_reports` record with status 'ready', file_hash, and version=1.
- **Error handling:** On failure, insert `coa_reports` with status 'failed' + error_message; managers can retry via UI action.
- **Amendment workflow:** When approved sample data is corrected, invoke `generateCoA(sample_id, amendment=true)` → generate new HTML with "Amended Report v{N}" watermark → increment version → link previous version via `superseded_by` → preserve all versions for audit trail.

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
- **Download:** Generate signed URL (1-hour expiry) via `/api/coa/download?sample_id={id}&token={jwt}` → verify token → fetch latest `coa_reports` record (or specific version if requested) → validate file_hash matches stored HTML → create signed Storage URL → log access to `coa_access_log` → return HTML file for browser to open/print.
- **Token:** JWT containing `client_id` + `sample_id` + `exp` (1 hour), signed with server secret; validated before granting download.

### Storage RLS Policies
- **Bucket:** `coa-reports` with policies:
  1. INSERT: Allow authenticated users with role 'manager' OR 'analyst' (for generation workflow using service role)
  2. SELECT: Allow authenticated users with role 'manager' OR 'analyst' OR public via signed URLs (Supabase handles signed URL validation)
  3. UPDATE/DELETE: Deny all (use soft delete in `coa_reports` table; Storage files are immutable)
- **Path security:** Signed URLs include token validation; even if path is guessed, RLS + signature prevents unauthorized access.

### Existing HTML Template Integration
- **Current:** `docs/references/CoATemplate.html` contains Vietnamese lab report template with organization header, patient info table, test results grouped by category, QR code, signature footer.
- **Reuse:** Create server-side rendering function that takes sample data and generates HTML by interpolating values into template structure (or use template engine like Handlebars/EJS if preferred).
- **Styling:** Template uses inline CSS and embedded styles; ensure all styles are self-contained for offline viewing and printing.
- **Compliance Features:** Add version watermark for amendments, file hash display (optional), generation timestamp.

## Alternatives Considered
- **Dynamic HTML rendering:** Rejected; 21 CFR Part 11 requires approved records to be immutable artifacts (not dynamic queries); static storage is industry standard for regulated labs.
- **PDF generation:** Deferred; HTML provides same content with simpler generation pipeline, better browser compatibility, and easier amendments; PDF can be added later if clients request it.
- **Email delivery:** Rejected for MVP; requires SMTP setup and client email validation; portal access is simpler and allows re-download.
- **SMS passcode:** Rejected; adds cost and complexity; phone number itself + last 6 digits is sufficient for low-stakes data.
- **Client accounts:** Rejected; overhead of registration/password management; phone-based auth is frictionless.
- **Database storage (bytea):** Rejected; Supabase Storage preferred for large files, better scalability, CDN support.

## Risks / Trade-offs
- **Weak authentication:** Last 6 digits of phone is predictable; mitigated by rate limiting, audit logging, low-stakes data; acceptable for MVP.
- **Phone number privacy:** Phone is exposed if someone has client name+DOB; mitigated by requiring both phone and passcode; consider masking phone display in UI.
- **Storage costs:** HTML files accumulate (~30-50 KB each); mitigate with retention policy (2 years per compliance requirements) or archive old reports.
- **File integrity:** HTML can be manually edited after download; mitigated by storing file hash in database for verification; original stored file remains immutable.
- **Phone normalization:** +84 vs 0 prefix must be handled consistently; normalize on input and storage query.
- **Amendment complexity:** Multiple versions per sample increase storage; trade-off for compliance requirement to preserve original approved reports.

## Migration Plan
1. **Database schema:** Create `coa_reports` (with file_hash, version, superseded_by) and `coa_access_log` (with coa_report_id, user_agent) tables with constraints, indexes (`sample_id`, `version`, `client_id`), audit triggers, RLS policies (analyst/manager role checks). Security Impact: Medium (new public-facing auth vector).
2. **Storage setup:** Create `coa-reports` bucket in Supabase, configure RLS policies, test signed URL generation with 1-hour expiry.
3. **HTML generation:** Implement server action with template rendering (based on `CoATemplate.html`), file hash generation (SHA-256), upload to Storage, insert metadata with version tracking.
4. **Trigger setup:** Add AFTER UPDATE trigger on `samples` to invoke HTML generation; handle errors gracefully.
5. **Public portal:** Create `/coa/access` page, implement auth API route with rate limiting, build UI (Vietnamese labels).
6. **Download endpoint:** Implement JWT-based download API (1-hour expiry), integrate signed URLs, log access with user agent.
7. **Testing:** Test full flow (approve sample → HTML generated with hash → client access via phone → download → audit log), test amendments (version tracking, superseded_by linkage), verify RLS, load test rate limiting, verify file hash integrity.
8. **Documentation:** Update user guide with CoA access instructions (Vietnamese), document API endpoints, add troubleshooting guide, document amendment workflow.

## Open Questions
- **Template engine choice:** Plain string interpolation vs template engine (Handlebars/EJS)? → Decide based on complexity; start with string interpolation for simplicity, migrate to template engine if logic becomes complex.
- **Retention policy:** How long to keep CoA files in storage? → Define based on compliance requirements; suggest 2 years minimum per 21 CFR Part 11, configurable.
- **Error retry UI:** Should managers see failed generations and retry? → Yes, add to sample detail view with "Tạo lại CoA" (Regenerate CoA) button.
- **Multiple phones per client:** What if client updates phone? → Use current phone at access time; old CoAs still accessible via new phone (client_id link).
- **Version display:** Show all versions to clients or only latest? → Show latest by default, add "Xem phiên bản trước" (View previous versions) option for transparency.

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

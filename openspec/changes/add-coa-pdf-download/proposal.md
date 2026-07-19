## Why

Users can currently view a released Certificate of Analysis (CoA) as stored HTML, but downloading a portable PDF requires the browser print dialog and "Save as PDF". This is inconvenient on mobile browsers and produces inconsistent results across client devices.

## What Changes

- Add a one-click Vietnamese "Tải PDF" action alongside the existing HTML preview for analysts, managers, doctors, and authenticated clients.
- Generate a standard PDF on demand from the exact released CoA HTML snapshot; do not re-render the report from live React or database state.
- Run Gotenberg as an internal-only Docker microservice on the home server, using a custom Gotenberg 8 image that includes Times New Roman.
- Encapsulate Gotenberg behind a server-only conversion client configured by URL, so a future change can route LIMS through a shared Tailscale PDF gateway without changing the PDF routes or UI contract.
- Preserve the existing HTML preview routes and authorization boundaries:
  - staff access continues to use the authenticated Supabase session and current role/confidentiality checks;
  - client access continues to use the existing narrowly scoped service-role exception only after short-lived CoA token validation; the query is limited to the requested sample/report, may only evaluate ownership, ready/completed status, confidential concealment, and authorized artifact access, and does not create a general RLS bypass.
- Verify the stored HTML hash before conversion and fail closed if the released artifact cannot be trusted.
- Return the generated PDF directly without storing it in Supabase Storage or adding PDF metadata to `coa_reports`.
- Name the attachment `PhieuKetQuaXN-{samples.sample_id}-{YYYYMMDD}.pdf`, using the CoA release date in the `Asia/Ho_Chi_Minh` timezone and a filename-safe value from `samples.sample_id`.
- Preserve the released HTML's A4 print CSS, colors, logo, QR code, signatures, stamp, watermark, and footer. The MVP continues using the existing external logo and QR URLs.
- Limit PDF generation to five authorized requests per identity and IP address within ten minutes, using bounded in-memory state that cleans expired keys and rejects new keys when all 10,000 slots remain active.
- Prevent the conversion boundary from forwarding LIMS cookies, authorization headers, CoA tokens, service-role credentials, or other request credentials to Gotenberg, and deny Gotenberg access to private, loopback, link-local, and metadata-service addresses.
- Return an explicit Vietnamese error when conversion fails, times out, is rate-limited, fails integrity validation, or cannot load required external resources. HTML preview remains available and the system does not fall back to the browser print dialog.

## Capabilities

### New Capabilities

- `coa-pdf-download`: Generate and stream an authorized, print-faithful PDF from an immutable released CoA HTML snapshot through an internal Gotenberg service.

### Modified Capabilities

- `coa-preview`: Add a dedicated PDF download action to the existing staff and client CoA preview experiences without replacing HTML preview, print, close, or full-tab actions.

## Impact

- **Application:** New staff and client PDF route handlers, shared conversion/integrity/rate-limit helpers, and Vietnamese download/error UI states.
- **Deployment:** New internal Gotenberg container, custom font-enabled image, health check, resource limits, timeout configuration, and app-to-service environment configuration in Docker Compose.
- **Dependencies:** Gotenberg 8 and Microsoft Core Fonts installed during the custom image build with the required EULA acceptance.
- **Compliance:** The existing hashed HTML snapshot remains the canonical released CoA. The generated PDF is a transient presentation derivative and is not stored as a regulated record. Integrity validation occurs before conversion.
- **Audit logging:** Existing client CoA access logging remains mandatory. A generated PDF is delivered only after its success outcome is persisted; failed client PDF attempts record an appropriate failure reason. Audit persistence failure fails closed with no PDF delivery. Staff PDF access does not introduce a new database audit contract in this MVP because equivalent HTML views are not currently read-audited.
- **RLS and database:** No database migration, RLS policy change, storage bucket change, hard delete, or Supabase schema operation is required.
- **Localization:** All new user-facing labels, loading states, rate-limit messages, and conversion errors are Vietnamese.
- **Operations:** Gotenberg remains inaccessible through Nginx and Cloudflare Tunnel. A Gotenberg outage degrades PDF download only; CoA creation and HTML viewing continue to operate.
- **Future scaling:** This change serves LIMS only. Multi-application authentication, per-app quotas, and Tailscale gateway exposure are deferred, while the conversion-client boundary remains compatible with that future topology.

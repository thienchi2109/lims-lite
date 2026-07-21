## Why

Users can currently view a released Certificate of Analysis (CoA) as stored HTML, but downloading a portable PDF requires the browser print dialog and "Save as PDF". This is inconvenient on mobile browsers and produces inconsistent results across client devices.

## What Changes

- Add a one-click Vietnamese "Tải PDF" action alongside the existing HTML preview for analysts, managers, doctors, and authenticated clients.
- Generate a standard PDF on demand from the exact released CoA HTML snapshot; do not re-render the report from live React or database state.
- Run Gotenberg as an internal-only Docker microservice on the home server, using a custom Gotenberg 8 image that includes Times New Roman, and make it reachable only through the private authenticated `pdf-gateway`.
- Route every LIMS conversion through `POST /v1/convert/html` on the authenticated gateway. The server-only client uses the compatibility setting `GOTENBERG_URL=http://pdf-gateway:8080` plus the bearer credential mounted at `PDF_GATEWAY_TOKEN_FILE`; the application must not resolve or connect to raw Gotenberg.
- Preserve the existing HTML preview routes and authorization boundaries:
  - staff access continues to use the authenticated Supabase session and current role/confidentiality checks;
  - client access continues to use the existing narrowly scoped service-role exception only after short-lived CoA token validation; the query is limited to the requested sample/report, may only evaluate ownership, ready/completed status, confidential concealment, and authorized artifact access, and does not create a general RLS bypass.
- Verify the stored HTML hash before conversion and fail closed if the released artifact cannot be trusted.
- Return the generated PDF directly without storing it in Supabase Storage or adding PDF metadata to `coa_reports`.
- Name the attachment `PhieuKetQuaXN-{samples.sample_id}-{YYYYMMDD}.pdf`, using the CoA release date in the `Asia/Ho_Chi_Minh` timezone and a filename-safe value from `samples.sample_id`.
- Preserve the released HTML's A4 print CSS, colors, logo, QR code, signatures, stamp, watermark, and footer. The MVP continues using the existing external logo and QR URLs.
- Limit PDF generation to five authorized requests per identity and IP address within ten minutes, using bounded in-memory state that cleans expired keys and rejects new keys when all 10,000 slots remain active.
- Prevent the conversion client from forwarding LIMS cookies, incoming authorization headers, CoA tokens, service-role credentials, or other request credentials. It adds only the dedicated gateway bearer credential, and the gateway must not forward that credential or other control headers to Gotenberg. Gotenberg continues denying private, loopback, link-local, and metadata-service addresses.
- Return an explicit Vietnamese error when conversion fails, times out, is rate-limited, fails integrity validation, or cannot load required external resources. HTML preview remains available and the system does not fall back to the browser print dialog.

## Capabilities

### New Capabilities

- `coa-pdf-download`: Generate and stream an authorized, print-faithful PDF from an immutable released CoA HTML snapshot through the authenticated internal PDF gateway backed by Gotenberg.

### Modified Capabilities

- `coa-preview`: Add a dedicated PDF download action to the existing staff and client CoA preview experiences without replacing HTML preview, print, close, or full-tab actions.

## Impact

- **Application:** New staff and client PDF route handlers, shared conversion/integrity/rate-limit helpers, and Vietnamese download/error UI states.
- **Deployment:** The internal Gotenberg container remains behind the private `pdf-gateway`; the app-to-gateway URL and LIMS bearer credential are supplied through the existing Compose network and Docker-secret contract.
- **Dependencies:** Gotenberg 8 and Microsoft Core Fonts installed during the custom image build with the required EULA acceptance.
- **Compliance:** The existing hashed HTML snapshot remains the canonical released CoA. The generated PDF is a transient presentation derivative and is not stored as a regulated record. Integrity validation occurs before conversion.
- **Audit logging:** Existing client CoA access logging remains mandatory. A generated PDF is delivered only after its success outcome is persisted; failed client PDF attempts record an appropriate failure reason. Audit persistence failure fails closed with no PDF delivery. Staff PDF access does not introduce a new database audit contract in this MVP because equivalent HTML views are not currently read-audited.
- **RLS and database:** No database migration, RLS policy change, storage bucket change, hard delete, or Supabase schema operation is required.
- **Localization:** All new user-facing labels, loading states, rate-limit messages, and conversion errors are Vietnamese.
- **Operations:** The gateway and Gotenberg remain inaccessible through host ports, Nginx, Cloudflare Tunnel, and Tailscale. A gateway or Gotenberg outage degrades PDF download only; CoA creation and HTML viewing continue to operate.
- **Future scaling:** The private authenticated gateway serves LIMS only. A second consumer, Tailscale exposure, and cross-application policy remain deferred without changing the PDF route or UI contract.

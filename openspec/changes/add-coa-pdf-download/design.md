## Context

Released CoAs are currently generated as static HTML, hashed with SHA-256, stored in the private `coa-reports` bucket, and referenced by versioned `coa_reports` records. Staff view the latest ready report through a Supabase-session route, while clients use a short-lived CoA token, ownership checks, confidential-sample concealment, and `coa_access_log`.

The HTML is already the released artifact and contains the complete A4 layout, print CSS, signatures, manager stamp, watermark, footer, hidden verification metadata, and fixed external logo/QR URLs. Browser printing renders this document correctly, but mobile users must use browser-specific "Save as PDF" workflows.

The home-server deployment uses one Docker Compose network and one application container. Gotenberg must run only on that internal network and must not become a prerequisite for CoA creation, HTML viewing, Nginx, or Cloudflare Tunnel availability.

## Goals / Non-Goals

**Goals:**

- Provide one-click PDF download for every staff role and client that already has permission to view a ready CoA.
- Render the exact released HTML snapshot with its existing A4 print styles and Times New Roman typography.
- Keep staff and client authorization boundaries separate and fail closed for confidential or corrupted reports.
- Isolate Chromium and its image size from the Next.js application image.
- Protect the home server with bounded request rate, conversion timeout, health checks, and container resource limits.
- Keep PDF download an optional capability so a Gotenberg outage does not affect CoA creation or HTML preview.

**Non-Goals:**

- Storing, hashing, versioning, signing, or retaining generated PDF files.
- Treating PDF as the canonical regulated CoA artifact.
- Replacing the existing HTML preview, full-tab view, print action, or body-only print workflow.
- Re-rendering a report from current database data or React components.
- Removing the existing external logo and QR providers in this MVP.
- Adding a database migration, RLS policy, storage bucket, or staff read-audit schema.
- Supporting PDF/A, PDF encryption, email delivery, bulk export, or background pre-generation.
- Exposing a shared PDF API to other applications, binding a gateway to the Tailscale interface, or implementing per-application API keys and quotas.

## Decisions

### 1. Keep the released HTML as the canonical artifact

The PDF service will download the selected ready report's stored HTML and compare its SHA-256 hash with `coa_reports.file_hash` before conversion. A mismatch, missing hash, missing object, non-ready report, or soft-deleted report fails closed.

This preserves the existing Part 11-aware release boundary: PDF is only a transient presentation derivative of the immutable HTML. Rebuilding from React or live database state was rejected because it could produce content different from the released report.

### 2. Generate PDF on demand without persistence

Each authorized request sends the validated HTML to Gotenberg and streams the returned PDF to the browser. The application will not upload the PDF to Storage or write PDF metadata to `coa_reports`.

Generating and storing PDF during CoA creation was rejected for the MVP because it would couple report release to Chromium availability and introduce another artifact lifecycle. First-download caching was rejected because a reader request would create persistent regulated state and require concurrency, retention, and reconciliation rules.

### 3. Preserve separate staff and client route boundaries

Add two route handlers:

- `GET /api/coa/view/pdf?sample_id={uuid}` for Supabase-authenticated staff.
- `GET /api/coa/download/pdf?sample_id={uuid}` for authenticated clients using the existing `coa_token`.

Each route will reuse its corresponding HTML route's role, ownership, status, and confidentiality checks. Only after authorization will it call a shared server-only PDF conversion service. The shared service accepts authorized report metadata and HTML; it does not perform identity discovery or accept user-supplied URLs.

A client PDF request remains a narrow extension of the existing public CoA route. Service-role data access may begin only after the short-lived token establishes the client identity, must be scoped to the requested sample and report, and may only evaluate ownership, completed sample status, ready report status, confidential-sample concealment, and authorized artifact access. Conversion may begin only after those checks pass. The PDF route does not introduce a reusable service-role repository, a generic RLS bypass, or broader client data access.

A single route that auto-detects staff or client authentication was rejected because it would combine two security models and increase the chance of authorization regressions.

### 4. Submit the stored HTML directly to Gotenberg

The application will send multipart form data to `/forms/chromium/convert/html` with the document named `index.html`. The conversion client constructs a new server-to-server request from an explicit header and form-field allowlist. It will not forward incoming `Cookie`, `Authorization`, proxy authorization, Supabase session headers, CoA tokens, service-role credentials, or public download URLs. Gotenberg will not navigate to LIMS URLs.

The conversion request will set `emulatedMediaType=print`, `printBackground=true`, `preferCssPageSize=true`, `skipNetworkIdleEvent=false`, `failOnResourceLoadingFailed=true`, and `failOnResourceHttpStatusCodes=[400,599]`. It will preserve the HTML's current `@page` A4 rules and `@media print` overrides without injecting Chromium headers, footers, or margins.

URL conversion was rejected because it would require forwarding authentication into Chromium and would make conversion dependent on public routing and browser session state.

### 5. Keep external logo and QR resources for the MVP

Gotenberg may make outbound HTTPS requests for the fixed logo and QR URLs already embedded in released HTML. Conversion must fail if either resource cannot be loaded or returns an error; the application must not return a visually incomplete PDF.

Set `CHROMIUM_DENY_PRIVATE_IPS=true` so Chromium rejects navigations and sub-resources that resolve to non-public addresses, including loopback, RFC1918, link-local, IPv6 unique-local, and metadata-service ranges. Keep `CHROMIUM_PROXY_SERVER` and `CHROMIUM_HOST_RESOLVER_RULES` unset so Gotenberg's DNS-rebind pinning proxy remains active. Do not add a `CHROMIUM_ALLOW_LIST` entry that would bypass IP-class checks. The fixed external HTTPS resources remain reachable because they resolve publicly; redirects into denied ranges must fail conversion.

Self-hosting or embedding these assets is deferred and should be proposed separately because the user explicitly accepted the current external dependency for the MVP.

### 6. Use a custom Gotenberg image with Times New Roman

Create a small custom image derived from a digest-pinned Gotenberg 8 image. During the image build, install Microsoft Core Fonts with non-interactive EULA acceptance, then return to the unprivileged `gotenberg` user. Do not commit font binaries or licensing secrets.

The build and verification workflow must confirm `fc-match "Times New Roman"` resolves to the installed Microsoft font. Relying on Gotenberg's metric-compatible Liberation fallback was rejected because it can alter glyph metrics, wrapping, and page breaks.

### 7. Keep Gotenberg internal and independently degradable

Add a `gotenberg` service to the default Compose network and configure the app with server-only `GOTENBERG_URL=http://gotenberg:3000`. Do not publish port 3000 to the host, Nginx, or Cloudflare Tunnel.

Gotenberg will have a `/health` health check, restart policy, bounded CPU/RAM/shared-memory settings, and a conversion timeout initially targeted at 30 seconds. The app health check and startup dependency graph must not require Gotenberg to be healthy, so HTML workflows remain available during a converter outage.

### 8. Preserve a future shared-gateway extension point

Gotenberg-specific request construction will live behind one server-only conversion client configured by `GOTENBERG_URL`. Route handlers and UI code depend on the application's PDF conversion contract, not on Docker service discovery or Gotenberg details.

For this change, `GOTENBERG_URL` points directly to the private Compose service. A future independent change may point the same client to an authenticated PDF gateway bound to the home server's Tailscale interface. That future gateway can add per-application credentials, quotas, and cross-host policy without changing the LIMS authorization, filename, or response behavior.

Building the shared gateway now was rejected because it would broaden the MVP into multi-application infrastructure before another consumer has concrete requirements.

### 9. Apply a dedicated in-memory generation limiter

Allow at most five conversion attempts per ten-minute window for each authenticated identity combined with client IP:

- staff key: `staff:{user_id}:{ip}`;
- client key: `client:{client_id}:{ip}`.

The limiter is checked after authorization and before calling Gotenberg, so invalid unauthenticated requests do not populate it and authorized callers cannot consume unbounded Chromium work. A request that reaches the conversion boundary consumes one attempt even if Gotenberg later fails.

The single application-container deployment permits a bounded in-memory map for the MVP, matching the existing public authentication limiter pattern. The map has a hard cap of 10,000 keys. On insertion at capacity, it first removes expired windows. If all 10,000 remaining keys are still active, it rejects the new key with HTTP `429` and does not call Gotenberg. It never evicts an active key because recreating that key would reset its counter and violate the five-attempt limit. Counters may reset on app restart. Distributed persistence is deferred until the app runs multiple instances.

### 10. Stream a private, filename-safe attachment

Successful responses will use:

- `Content-Type: application/pdf`;
- `Content-Disposition: attachment` with `PhieuKetQuaXN-{samples.sample_id}-{YYYYMMDD}.pdf`;
- `Cache-Control: private, no-store`.

The date is derived from `coa_reports.generated_at` and formatted in `Asia/Ho_Chi_Minh`. The value read from `samples.sample_id` is normalized to a conservative filename-safe character set without changing the visible report content.

### 11. Preserve current access logging semantics

After the short-lived token establishes a client identity, the route persists one terminal `coa_access_log` outcome before completing the response. For success, Gotenberg first returns valid PDF bytes, the success audit insert must then commit, and only then may the route deliver the PDF. If that insert fails, the route discards the generated bytes, returns a generic Vietnamese service-unavailable error, and emits a non-sensitive operational alert with a trace ID.

Ownership, status, confidentiality, storage, integrity, rate-limit, resource-loading, timeout, and conversion failures use a small allowlist of non-sensitive failure codes. The route attempts to persist the failure outcome before returning the failure response. If failure-audit persistence is unavailable, the request remains failed, the response becomes the same generic service-unavailable error, and an operational alert is emitted without recursively attempting another audit insert. Audit and operational details must not contain sample identifiers, patient data, HTML, URLs, tokens, cookies, authorization headers, or service credentials.

No new staff read-audit persistence is added because equivalent staff HTML views are not currently read-audited. Operational logs may include a generated trace ID, route class, response status, duration, and Gotenberg trace header, but must not include HTML, tokens, patient data, or service credentials.

### 12. Expose explicit Vietnamese UI states

The existing preview remains visible while a PDF request is pending. The action is disabled for duplicate clicks and shows a progress state. For the public client flow, an expired or invalid CoA token returns the user to the existing authentication/login recovery path and does not automatically retry the PDF request. Rate-limit and conversion failures show Vietnamese messages without raw JSON.

There is no automatic retry and no fallback to browser printing. Users may continue viewing HTML and retry manually when allowed.

## Risks / Trade-offs

- **[External logo or QR provider is unavailable]** -> Require successful resource loading and fail the PDF request rather than returning an incomplete document.
- **[External QR request discloses the display sample ID]** -> Accept for the approved MVP scope; track asset self-hosting as a separate hardening change.
- **[On-demand PDF bytes can change after a Gotenberg upgrade]** -> Keep HTML as the canonical hashed artifact and pin the Gotenberg base image digest.
- **[Microsoft font installation adds image size and EULA obligations]** -> Install only the required core-font package during the isolated Gotenberg build and document license acceptance.
- **[Chromium exhausts home-server resources]** -> Use rate limiting, timeout, queue bounds, container limits, health monitoring, and focused load verification before deployment.
- **[In-memory rate limits reset on restart]** -> Accept for the single-instance MVP; move to shared persistence before horizontal scaling.
- **[Gotenberg is unreachable]** -> Return a Vietnamese PDF-specific error while leaving CoA creation and HTML preview operational.
- **[A future shared gateway requires a different transport or credentials]** -> Keep all Gotenberg transport details in one configurable server-only client and defer multi-app policy to a separate change.
- **[Authorization logic diverges between HTML and PDF routes]** -> Extract narrowly scoped shared authorization/report-loading helpers or add parity tests around both route families.
- **[Large PDFs increase Next.js memory pressure]** -> Avoid unnecessary copies where supported, enforce response-size expectations, and stream or forward the binary response directly.

## Migration Plan

1. Add the custom Gotenberg image definition, Compose service, health check, resource limits, and `GOTENBERG_URL` example configuration.
2. Deploy Gotenberg on the home server without exposing a host port; verify `/health`, installed Times New Roman, outbound logo/QR loading, and container limits.
3. Add and test shared report loading, hash verification, filename formatting, rate limiting, and Gotenberg conversion utilities.
4. Add staff and client PDF routes with authorization-parity and failure-path coverage.
5. Add the Vietnamese "Tải PDF" action and loading/error states to staff and client preview surfaces.
6. Run focused tests, lint, typecheck, build, Compose validation, font verification, conversion smoke tests, and mobile browser verification.
7. Deploy the application after Gotenberg is healthy, then verify HTML preview remains usable with Gotenberg stopped.

Rollback removes the PDF UI action, routes, app environment variable, and Gotenberg service. No database or stored CoA rollback is required.

## Open Questions

None. Product and architecture decisions for the MVP were approved during proposal discovery.

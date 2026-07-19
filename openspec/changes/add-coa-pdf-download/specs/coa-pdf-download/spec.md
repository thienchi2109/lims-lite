## ADDED Requirements

### Requirement: Authorized users can download a ready CoA as PDF

The system SHALL allow analysts, managers, doctors, and authenticated clients to download a standard PDF only when they already have permission to view the corresponding ready CoA.

#### Scenario: Authorized staff downloads a ready CoA

- **GIVEN** an analyst, manager, or doctor has an authenticated Supabase session
- **AND** the user is authorized to view a completed sample and its latest ready CoA
- **WHEN** the user requests the PDF download
- **THEN** the system SHALL generate and return the PDF
- **AND** the system SHALL NOT expand the user's existing sample or confidentiality access

#### Scenario: Authorized client downloads a ready CoA

- **GIVEN** a client has a valid short-lived CoA session
- **AND** the requested non-confidential sample belongs to that client
- **AND** the sample is completed and has a ready CoA
- **WHEN** the client requests the PDF download
- **THEN** any service-role query SHALL begin only after the token establishes the client identity
- **AND** the query SHALL be scoped to the requested sample and report and limited to ownership, completed status, ready report status, confidential concealment, and authorized artifact access
- **AND** conversion SHALL begin only after all access checks succeed
- **AND** the route SHALL NOT expose a general service-role repository or RLS bypass
- **AND** the system SHALL generate and return the PDF
- **AND** the successful access SHALL be logged only after PDF generation succeeds

#### Scenario: Unauthorized or concealed CoA is requested

- **GIVEN** the requester is unauthenticated, lacks the required role, does not own the sample, or cannot access a confidential-associated sample
- **WHEN** the requester requests the PDF
- **THEN** the system SHALL reject the request using the same concealment and authorization semantics as the corresponding HTML route
- **AND** the system SHALL NOT call Gotenberg

### Requirement: PDF derives from the released HTML artifact

The system MUST generate the PDF from the exact stored HTML snapshot associated with the selected ready `coa_reports` version and MUST NOT rebuild report content from live database state or React components.

#### Scenario: Stored HTML passes integrity validation

- **GIVEN** the latest ready CoA HTML object is available
- **AND** its computed SHA-256 hash matches `coa_reports.file_hash`
- **WHEN** an authorized PDF request reaches the conversion boundary
- **THEN** the system SHALL submit that HTML snapshot to Gotenberg as `index.html`

#### Scenario: Stored HTML fails integrity validation

- **GIVEN** the stored CoA HTML is missing or its computed hash does not match `coa_reports.file_hash`
- **WHEN** an authorized PDF request reaches integrity validation
- **THEN** the system SHALL fail closed with a Vietnamese error
- **AND** the system SHALL NOT submit the document to Gotenberg
- **AND** the system SHALL NOT return a PDF

### Requirement: PDF preserves the released CoA print presentation

The system SHALL render the released CoA using print media, CSS-defined A4 page size, background graphics, Times New Roman, and the HTML's existing layout and assets.

#### Scenario: Complete CoA renders successfully

- **GIVEN** the released HTML contains the current CoA CSS, logo, QR code, signatures, manager stamp, watermark, and footer
- **AND** all required external resources load successfully
- **WHEN** Gotenberg converts the HTML
- **THEN** the PDF SHALL preserve the existing print styles and colors
- **AND** Chromium SHALL NOT add its own header, footer, or page margin

#### Scenario: Required external resource fails to load

- **GIVEN** the released HTML references the approved external logo or QR URL
- **WHEN** a required resource cannot be loaded or returns an error response
- **THEN** the conversion SHALL fail
- **AND** the system SHALL NOT return a visually incomplete PDF

### Requirement: PDF is a transient presentation derivative

The system SHALL stream the generated PDF directly to the requester and SHALL NOT store, hash, version, sign, or retain the PDF as a `coa_reports` artifact.

#### Scenario: Successful conversion is returned without persistence

- **GIVEN** Gotenberg returns a successful PDF conversion
- **WHEN** the application returns the response to the requester
- **THEN** the response SHALL contain the generated PDF bytes
- **AND** no PDF object SHALL be uploaded to Supabase Storage
- **AND** no PDF metadata SHALL be written to the database

### Requirement: PDF download uses a deterministic attachment name

The system SHALL return the PDF as `PhieuKetQuaXN-{samples.sample_id}-{YYYYMMDD}.pdf`, using the value from `samples.sample_id` and the CoA release date.

#### Scenario: Attachment filename is generated

- **GIVEN** a ready CoA is associated with `samples.sample_id` and has a `coa_reports.generated_at` timestamp
- **WHEN** the PDF response is created
- **THEN** the value from `samples.sample_id` SHALL be normalized for safe use in a filename
- **AND** the date SHALL be formatted as `YYYYMMDD` in `Asia/Ho_Chi_Minh`
- **AND** the filename SHALL match `PhieuKetQuaXN-{samples.sample_id}-{YYYYMMDD}.pdf`
- **AND** the response SHALL use `Content-Type: application/pdf`
- **AND** the response SHALL use attachment disposition and `Cache-Control: private, no-store`

### Requirement: PDF generation is rate limited

The system SHALL allow no more than five authorized PDF conversion attempts per authenticated identity and client IP address in any ten-minute window.

#### Scenario: Request is within the generation limit

- **GIVEN** an authorized identity and IP combination has made fewer than five conversion attempts in the active ten-minute window
- **WHEN** another authorized PDF request is accepted
- **THEN** the system SHALL count the attempt
- **AND** the request SHALL be allowed to proceed to conversion

#### Scenario: Request exceeds the generation limit

- **GIVEN** an authorized identity and IP combination has already made five conversion attempts in the active ten-minute window
- **WHEN** another PDF request is made
- **THEN** the system SHALL return HTTP `429`
- **AND** the response SHALL provide a Vietnamese retry message
- **AND** the system SHALL NOT call Gotenberg
- **AND** HTML preview SHALL remain available

#### Scenario: Limiter state reaches its hard capacity

- **GIVEN** the in-memory limiter is at its hard cap of 10,000 keys
- **WHEN** a new authorized identity and IP key must be inserted
- **THEN** the limiter SHALL remove expired keys first
- **AND** if all 10,000 remaining keys are active, the system SHALL reject the new key with HTTP `429`
- **AND** the limiter SHALL NOT evict an active key or reset its active counter
- **AND** the system SHALL NOT call Gotenberg
- **AND** the limiter SHALL NOT retain more than 10,000 keys

### Requirement: Conversion requests protect credentials and internal networks

The system MUST construct a new allowlisted server-to-server request for Gotenberg, MUST NOT forward LIMS authentication material, and MUST deny Chromium access to non-public network ranges.

#### Scenario: Authorized HTML is submitted for conversion

- **GIVEN** an authorized route has loaded and verified a released HTML artifact
- **WHEN** the conversion client creates the Gotenberg request
- **THEN** the multipart request SHALL contain the authorized HTML as `index.html` and only explicitly supported conversion fields
- **AND** it SHALL NOT forward `Cookie`, `Authorization`, proxy authorization, Supabase session headers, CoA tokens, service-role credentials, or incoming request headers

#### Scenario: Released HTML requests a denied network address

- **GIVEN** the submitted HTML or an external redirect targets a private, loopback, link-local, reserved, multicast, or cloud metadata address
- **WHEN** Chromium attempts to load the resource
- **THEN** Gotenberg SHALL deny the request through `CHROMIUM_DENY_PRIVATE_IPS=true`
- **AND** the deployment SHALL preserve Gotenberg's DNS-rebind pinning proxy and SHALL NOT configure an allow-list entry that bypasses IP-class checks
- **AND** the application SHALL NOT return a PDF
- **AND** the HTML preview SHALL remain available

### Requirement: Client PDF attempts are audited after identity resolution

After a short-lived CoA token establishes the client identity, the system SHALL persist one terminal client PDF access outcome before delivering a successful PDF and SHALL fail closed when audit persistence is unavailable.

#### Scenario: Identified client PDF request succeeds

- **GIVEN** a valid CoA token has established the client identity
- **WHEN** Gotenberg returns a valid PDF response
- **THEN** the system SHALL persist a successful PDF access outcome after conversion completes
- **AND** the system SHALL deliver the PDF only after the audit insert succeeds

#### Scenario: Identified client PDF request fails

- **GIVEN** a valid CoA token has established the client identity
- **WHEN** the request fails an ownership, status, confidentiality, storage, integrity, rate-limit, resource, timeout, or conversion check
- **THEN** the system SHALL record one failed PDF access outcome using an allowlisted non-sensitive reason code
- **AND** the failure reason SHALL NOT contain sample identifiers, patient data, HTML, URLs, tokens, cookies, authorization headers, or service credentials

#### Scenario: Client audit persistence is unavailable

- **GIVEN** a valid CoA token has established the client identity
- **WHEN** the success or failure audit insert cannot be persisted
- **THEN** the system SHALL NOT deliver a PDF
- **AND** the system SHALL return a generic Vietnamese service-unavailable error
- **AND** the system SHALL emit a non-sensitive operational alert with a trace ID
- **AND** the system SHALL NOT recursively attempt another audit insert

### Requirement: PDF failures are isolated from core CoA workflows

The system SHALL treat Gotenberg as an optional internal service whose failure affects only PDF download.

#### Scenario: Gotenberg is unavailable or times out

- **GIVEN** an authorized PDF request passes report and integrity validation
- **WHEN** Gotenberg is unavailable, unhealthy, returns an error, or exceeds the configured timeout
- **THEN** the system SHALL return an explicit Vietnamese PDF error
- **AND** the system SHALL NOT fall back to the browser print dialog
- **AND** CoA creation and HTML preview SHALL remain operational

### Requirement: Gotenberg is internal and font-compatible

The deployment MUST run a custom Gotenberg 8 service with Times New Roman on the private Docker network and MUST NOT expose its API through a host port, Nginx, or Cloudflare Tunnel.

#### Scenario: Production service is deployed

- **WHEN** the production Compose stack starts
- **THEN** the app SHALL reach Gotenberg through its internal service URL
- **AND** Gotenberg SHALL expose a container health check
- **AND** the custom image SHALL resolve `Times New Roman` to the installed Microsoft font
- **AND** the container SHALL run with bounded compute resources
- **AND** application health SHALL NOT depend on Gotenberg health

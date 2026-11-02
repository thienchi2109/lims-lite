## ADDED Requirements

### Requirement: Analyst downloads a versioned accession workbook

The system SHALL allow an authenticated analyst to download a server-generated XLSX template with `template_id` `lims-bulk-accession` and literal Text `template_version` `1`. Authorization SHALL occur server-side before catalog access. This download SHALL create no clients, samples, assignments or import preview. It SHALL preserve the approved #112 contract.

#### Scenario: Authorized download
- **WHEN** an authenticated analyst requests the current template and catalog/configuration is ready
- **THEN** the server returns an XLSX attachment with the supported version and no business writes

#### Scenario: Unauthorized request
- **WHEN** an unauthenticated user or a user whose current role is not analyst requests the download directly
- **THEN** the server denies the request without returning a template or exposing catalog binding internals

### Requirement: Workbook contains exactly the fixed eight sheets

The workbook SHALL contain exactly eight visible sheets named `Hướng dẫn`, `Thông tin template`, `Khách hàng`, `Mẫu`, `Chỉ định`, `Danh mục loại mẫu`, `Danh mục chỉ tiêu`, `Danh mục tương thích`. It SHALL use headers, column order and metadata keys exactly as #112 §3. Optional columns SHALL retain headers. Business headers SHALL occupy row1 and data start at row2; business sheets SHALL contain no seeded example rows. Sheet order SHALL NOT define references.

#### Scenario: Round-trip layout
- **WHEN** a generated workbook is opened and read back by the existing workbook engine
- **THEN** all eight sheet names/visibility, exact headers/columns and metadata keys match #112 and business data rows are empty

### Requirement: Generated fields preserve literal Text and Vietnamese guidance

All metadata values SHALL be literal Text; metadata SHALL include each of `template_id`, `template_version`, `generated_at`, `compatibility_revision`, `catalog_binding` exactly once. The revision SHALL be positive ASCII decimal without leading zeros; generated_at SHALL be a valid server UTC `YYYY-MM-DDTHH:mm:ss.sssZ` timestamp. Business columns SHALL use Text format `@`. Vietnamese instructions SHALL explain literal Text/paste values, ISO `YYYY-MM-DD` real dates in1900–2100, leading zeros, typed CCCD/CMND, conditional new-client phone/gender, already-collected acceptable samples and source XLSX strictly <10.000.000 decimal bytes without business count caps. Examples SHALL appear only in Hướng dẫn.

#### Scenario: Text fields survive round trip
- **WHEN** the analyst downloads the template
- **THEN** version `1`, revision and generated_at remain string cells; business columns are Text and Vietnamese guidance explains date/identity input without inserting importable example rows

### Requirement: Catalog is one authoritative published snapshot

The server SHALL obtain revision, canonical code-to-UUID and lifecycle generations, eligible entities and configured pairs from one consistent database snapshot. Catalogs SHALL contain unique codes/pairs without orphans, draft/retired/soft-deleted/not-assignable/stale entries. Sample types SHALL have at least one eligible pair; assays SHALL be the union used by eligible pairs, with published labels/method text. The system SHALL fail closed without a supported version, non-null published revision, eligible pair or valid server configuration. It SHALL NOT infer authority from unverified workbook values or synthesize generation from incomplete legacy responses.

#### Scenario: Catalog changes during generation
- **WHEN** another session publishes or changes catalog generations while a download snapshot is being read
- **THEN** the resulting workbook binds one consistent revision/entities/pairs snapshot and never mixes revisions

#### Scenario: Catalog is not ready
- **WHEN** no published revision or eligible configured pair is available
- **THEN** the server returns a safe Vietnamese unavailable error and does not issue an importable workbook

### Requirement: Server authenticates template and catalog binding

The server SHALL issue and verify an opaque authenticated descriptor binding template id/version/generated_at/revision, code-to-canonical-UUID/generation and all three catalog contents. Metadata or catalog tampering SHALL invalidate verification, including changed labels, method text, pairs or codes. Sheet protection and a user-recomputable checksum SHALL NOT establish trust. Missing/unknown/retired signing key or malformed descriptor SHALL fail closed. The descriptor SHALL be verifiable after restart without retaining the workbook. Generated_at SHALL NOT impose a separate template TTL; preview30-minute TTL and current authority rechecks belong to successor changes.

#### Scenario: Catalog or metadata is modified
- **WHEN** a verifier receives a workbook whose bound metadata or any catalog content differs from the issued descriptor
- **THEN** verification rejects the binding instead of accepting client-declared revision, UUID or generation

#### Scenario: Restart with valid signing configuration
- **WHEN** a previously issued supported descriptor is verified after server restart with its valid key available
- **THEN** verification succeeds for the unchanged binding without reading a retained workbook or template registry

### Requirement: Download preserves privacy and existing accession UX

The system SHALL generate the workbook in request memory, return it with XLSX content type/attachment disposition and private no-store caching, and SHALL NOT retain workbook bytes in application disk/temp files/Storage/cache/logs. Metadata/catalog SHALL contain no client PII or input payload. Security/audit handling SHALL preserve existing authorization/RLS/audit conventions without logging secrets or creating business accession events. The Vietnamese download control SHALL have accessible name, keyboard focus, pending and error states and preserve the existing accession walkthrough. Proposed placement is the header of `/analyst/accession`; final placement SHALL be confirmed against user steering before UI implementation.

#### Scenario: Download or generation fails
- **WHEN** the analyst starts a download and the server cannot produce a valid authenticated workbook
- **THEN** the UI leaves the existing accession flow usable, announces a safe Vietnamese error and allows another download attempt without stored workbook payload

### Requirement: Source and runtime verification have separate gates

Implementation SHALL include focused snapshot/authorization, descriptor tampering, workbook round-trip and download/accessibility tests. Any database migration SHALL be new and forward-only with explicit security impact, SQL regression coverage and post-apply `run_security_tests()`. Production migration/deployment verification SHALL occur only on the authorized home server through SSH and Docker psql. Source tests SHALL NOT establish SQL/deployed download or whole-importer runtime capacity acceptance.

#### Scenario: Only source tests have passed
- **WHEN** focused tests, typecheck/lint and OpenSpec strict validation pass without authorized SQL execution and deployed download verification
- **THEN** source gates are reported separately and the corresponding runtime gates remain incomplete

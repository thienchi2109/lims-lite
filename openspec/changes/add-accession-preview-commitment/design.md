## Context

Approved authority: `docs/superpowers/specs/2026-11-01-excel-template-contract-design.md` (#112), `2026-11-01-atomic-import-provenance-contract-design.md` (#113), and `2026-11-02-import-implementation-partition.md` (#115). TASK-10/#138 follows TASK-8/9 and precedes TASK-11/12/13. Each phase is a separately reviewed PR/session. This document is checkpoint 0; no implementation is released by writing it.

Current parser: `validateAccessionWorkbook(bytes, {snapshot, signingConfig, resources})` returns typed ephemeral clients/samples/assignments or safe workbook errors. All seven finite server-owned resource limits remain mandatory, without production defaults. Current resolver: `src/lib/client-resolution/server.ts::resolveClientIdentityV2` calls the read-only v2 RPC but authorizes analysts or managers and returns only outcome/reason/UUID/created. `resolveOrCreateClientV2` is a write path and is prohibited here.

SQL authority: migration 215 canonical normalizers; migration 221 deterministic resolver, accent folding and adjudicated-distinct checks; migration 231 integrity enforcement. GitNexus is stale at `0d62612` versus baseline `c7c6806`, so current source is authoritative. The capacity prototype does not implement canonical hashing.

## Goals / Non-Goals

Goals: canonical all-or-nothing client planning, stable intent hash, durable immutable owner-bound preview, and an analyst-only API without business writes or retained payload.

Non-goals: business creation/confirmation/dedup success claims (TASK-11), recovery/purge runners (TASK-12), UI (TASK-13), capacity defaults or runtime acceptance (TASK-7), and TASK-8 deferred authenticated download acceptance. No runtime operations are authorized in this workspace.

## Decisions

### 1. Phase 1 needs a narrow SQL bridge

Use SQL canonical authority rather than approximating ICU/POSIX behavior in JavaScript. Existing JS phone validation and parser schemas remain the input boundary; they do not replace SQL normalization. A new forward-only migration adds a read-only `resolve_accession_preview_clients_v1(p_clients jsonb)` bridge. Durable commitment tables stay in Phase 3. The next migration is currently 233; recheck before creation and never edit historical SQL.

The bridge accepts an array of parser-validated client objects: integer row locator, input name/DOB, explicit typed identity pair/null, gender/phone/address/BHYT/expiry/null. The server supplies sheet context; caller references remain ephemeral. SQL independently validates JSON types, required/optional fields, ISO dates and typed identity pairing before casts. It rejects unsupported keys and invalid surrogate input at the application boundary. It checks authenticated analyst role and never accepts actor/role/resolved UUID from the input.

For each row, call `resolve_client_identity_internal_v2` behind the same authorization/confidentiality rules as public v2; call the 215 normalizers and 221 accent folder. Return one typed row per locator: normalized nine input fields, v2 outcome/reason/UUID with `created=false`, internal matched trusted identity projection (type/value/trusted, including legacy no-typed-input reuse), and related row locators for batch errors. Matched decision/display values needed for later HMAC are request-local and visible only after the resolver has authorized that match. Never return candidates/restricted details on conflict. Prefer a structured wrapper in `src/lib/client-resolution/server.ts` so RPC result validation and safe reason mapping stay shared.

The bridge does not create temp tables, clients, samples, results, or audit business rows. Candidate arrays/CTEs are request-local. A SQL `STABLE` read-only function and retained SQL tests enforce that the bridge cannot execute business DML. Failure returns no partial successful plan.

### 2. Same-batch guard algorithm preserves v2 semantics

Resolve every row against current persisted candidates first, keeping original caller coordinates. Any ambiguous/conflict/restricted/malformed/unavailable result rejects the batch. A matched result must have a UUID and `created=false`; not_found must have no UUID. Validate all supplied optional fields even for reuse; require valid non-placeholder phone and gender only for not_found/create. Never update existing identity or fill null fields.

Then evaluate candidate groups using canonical typed identity, exact name+DOB, accent-folded name+DOB, and canonical phone. Use indexed groupings of input rows, not an unconditional all-pairs scan. All involved rows receive safe errors; never choose first/last or merge:

1. Equal resolved active UUID with consistent evidence is `CLIENT_DUPLICATE`. Contradictory evidence is conflict, not duplicate.
2. Equal trusted typed identity keys are duplicate only when canonical evidence agrees; disagreement in name, DOB or supplied phone is conflict. Include the trusted typed projection of matched legacy rows when input omits identity.
3. Different resolved UUIDs stay distinct when shared v2 permits them. Existing manager-confirmed-distinct decisions remain authoritative; equal name+DOB is not identity proof and is never a duplicate key.
4. For any proposed creation, treat other batch rows as ephemeral candidates under the same v2 name/accent/phone/trusted-identity precedence. Equal/overlapping weak keys without a permitted distinct resolution are conflict. Two different typed strings alone do not override a cross-key collision. Same phone across conflicting keys is conflict; accent-only collision is conflict. Two not_found rows cannot both create the same trusted identity.
5. Delegate adjudicated-distinct decisions for persisted UUIDs to `is_client_collision_confirmed_distinct_v1`; do not fabricate adjudication for ephemeral clients. Factor only the shared candidate-guard SQL necessary for this bridge; do not replace the existing resolver or introduce an app identity heuristic.

Retained SQL fixtures must compare bridge decisions with public v2 and canonical normalizers for matched/no-typed-input legacy identity, restricted/inactive candidates, confirmed-distinct existing UUIDs, and unadjudicated not_found collisions. Static SQL contract tests are source checks only; runtime parity stays INCOMPLETE until the authorized home-server session.

### 3. Application interfaces and file ownership

| File | Responsibility / interface |
| --- | --- |
| `src/lib/accession-preview/clients.ts` | `resolveAccessionPreviewClients(workbook)` → `{ok:true,clients}` or `{ok:false,errors}`; no hashing/retention/business writes. Accepted client contains normalized input, create/reuse disposition, internal matched UUID and caller coordinates. |
| `src/lib/client-resolution/server.ts` | Typed read-only bridge wrapper, safe RPC mapping and fail-closed errors; retain existing v2 callers. |
| `src/lib/accession-preview/intent.ts` | `canonicalizeAccessionIntent(workbook, resolvedClients)` → canonical JSON + version + hash, independent of resolution outcome/UUID. |
| `src/lib/accession-preview/server.ts` | Preparation orchestration, current snapshot/bindings recheck, request-local preview and metadata sealing. |
| `src/app/api/accession-preview/route.ts` | Authenticated POST request boundary, envelope/bytes/resource limits, no-store response; no confirm endpoint. |
| `src/lib/api-client.ts` | `createAccessionPreviewClient(file, retryOfBatchId?)`; FormData transport to preview route, existing session-error conventions. |
| New `supabase/migrations/NNN_*.sql` + `tests/*.sql` | Phase 1 read-only bridge, later Phase 3 commitment schema/RPC/security tests; immutable independently reviewed changes. |

No generic repository/service/factory abstraction is needed. Tests colocate beside preview modules plus focused SQL regression files. File names can be narrowed further during the released phase without changing these contracts.

### 4. Canonical intent is exactly accession-intent-v1

Client tuple: `[normalizedName, DOB, identityType, identityValue, gender, phone, address, BHYT, expiryDate, samples]`. These are normalized input values, including optional values ignored on reuse, not post-write entity state. Sample tuple: `[sampleTypeImportCode, "acceptable", sortedAssayImportCodes]`. Keep identical sample blocks with multiplicity. Preserve client→sample→assignment edges by nesting.

Sort assay codes, serialized sample tuples and serialized client tuples by UTF-8 byte lexicographic order (`Buffer.compare`), then ECMAScript JSON.stringify of tuple arrays; no object keys, BOM, trailing newline, undefined or ASCII-only escaping. Absent optional fields are JSON null. Reject unpaired surrogates. Hash UTF-8 bytes of `lims-lite:bulk-accession:intent:v1` + exactly one LF + canonical JSON. Store lowercase SHA-256 and `accession-intent-v1`.

Exclude temporary references, row order/formatting, filename, labels, descriptor/revision/generations, template version, actor, batch ID, resolver UUID/outcome and received_at. The approved vector remains `090da05ce3b97394845d98b5d3fde180f150b3d452b5f067155466859a4e908e`. SQL/application fixtures must cover Unicode/control escapes, nulls and byte sorting; SQL JSONB pretty/text output is not canonical serialization.

### 5. Durable state and controlled bindings

Phase 3 adds batch metadata and separate expiring bindings. Metadata holds server batch/actor/retry IDs, state, database timestamps, exact source SHA-256/size, intent hash/version, template/descriptor digests, revision/validation/resolver versions, validated counts, binding-set digest, correlation IDs and safe reason/coordinates. Unknown values remain null. No filename, raw reference/cell/profile/exception, source bytes, or full normalized payload is durable.

Bindings hold row locators/ref graph, code→UUID/generation/method, resolution outcome/matched UUID and keyed client fingerprint, without raw identifying input. Use HMAC-SHA-256 with a separate server-only key, explicit key version and domain `lims-lite:bulk-accession:client-binding:v1`; canonical input includes batch ID, row locator, outcome, UUID/null and decision/display values. Cover existing canonical fields displayed for reuse; rerun absence for not_found at confirm. Store a digest of the whole binding set in durable metadata. Never use raw SHA-256 for low-entropy identity fields. Key configuration fails closed; no generated/default key.

Create preparing only after authentication and request-envelope admission. Seal preview_ready only after source/hash/bindings/counts and response agree, in one metadata transaction. Database sets preview_created_at and expires_at = preview_created_at + 30 minutes. Equality at expiry is expired. Owner, sealed commitments/bindings/deadline cannot change; retries/reloads/heartbeats never extend expiry.

States: preparing→preview_ready/rejected/failed; preview_ready→succeeded/failed/expired; all terminal states remain terminal. TASK-11 alone supplies atomic success. RLS and privileged RPCs enforce owner + current analyst role; manager cannot substitute. Authenticated users cannot directly forge/seal/update commitment fields.

### 6. Preparing lease contract for TASK-12

Preparing metadata records an opaque server request lease token/generation, DB last-heartbeat and lease deadline. Heartbeat requires matching owner/request token and preparing state; renewals use DB time and a server-owned finite duration. Recovery must lock the row, recheck token/generation/state and expired lease before changing preparing→failed. Active request heartbeats and stale worker updates cannot race a sealed/terminal batch. Lease duration/heartbeat frequency must be chosen against measured request/deployment timeouts in TASK-7; no arbitrary production defaults are added here. This lease never creates or extends preview TTL. TASK-12 implements the runner, not this change.

### 7. Preview API security and response

Authenticate analyst before accepting file bytes or allocating a batch. Independently enforce analyst even though the shared resolver also supports managers. Validate one multipart file, retry linkage ownership and server-owned envelope/resource policy; do not trust filename, body owner, timestamps, status, hashes, UUIDs, or normalized JSON. Use the existing template authority snapshot/binding verifier and TASK-9 validator. Recheck supported template version, published revision, generations/pairs/methods and current client resolution before sealing; drift fails closed.

Response returns batch ID, database expiry, counts, create/reuse summaries and Vietnamese row errors; preview content exists only in request/browser memory. It issues no official sample IDs. Existing client fields that will remain unchanged are explicit. `Cache-Control: no-store` covers success/errors; no raw request/response logging. Lifecycle audit contains only safe batch/actor/time/reason/count/hash/correlation fields. Reload must not reconstruct a preview from metadata; TASK-12 owns status/receipt transport and TASK-11 reparse/confirm.

## Risks / Trade-offs

- Canonical overlay logic can drift → SQL shared authority, explicit precedence matrix, application/SQL fixtures and runtime parity gate; no heuristic fallback.
- Metadata/bindings can reveal sensitive correlations → owner-and-analyst access, minimal fields, separate HMAC key/version and later lock-safe purge.
- Source tests cannot prove deployed SQL, restart durability or RLS → report SOURCE ONLY / runtime INCOMPLETE until separate authorized home-server verification.
- Large imports can exhaust resolution resources → preserve explicit parser policy, group-based batch guards, bounded bridge input/output and measured TASK-7 capacity; do not add business row caps.

## Migration Plan

Checkpoint 0 approves this plan; release one phase at a time. Root reviews retained RED→GREEN evidence and independent spec/standards review before integration. Phase 1 can add the new read-only migration source; Phase 3 adds durable schema in another new migration. Recheck next version each time; validate required baseline, privileges and final state. No migration is applied here. Runtime later applies committed SQL only from `/opt/lims-lite` via home-server SSH/Docker, runs focused SQL plus `run_security_tests()`, verifies privileges/RLS and deploys/smokes only under operation-specific authorization. Rollbacks use forward-only corrective migrations and application compatibility, never historical migration edits.

## Open Questions / Checkpoint Decisions

Root has accepted a Phase 1 source-only SQL bridge as necessary for canonical reuse; root must review this concrete input/output and overlay precedence before release. Exact helper factoring must preserve public v2 behavior and confirmed-distinct adjudication; any inability to do so is a stop at the next checkpoint, not an invitation to alter policy. No canonical hash serialization ambiguity was found.

Phase 3 must select the privileged seal/heartbeat boundary and binding HMAC key provisioning/rotation without exposing keys or accepting body actor authority. Phase 4 needs explicit deployed upload/resource/lease policy tied to TASK-7 measurements; it must fail closed while absent. These are implementation/runtime configuration gates, not changes to approved product contracts.

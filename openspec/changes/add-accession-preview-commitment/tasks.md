# Accession Preview Commitment Implementation Plan

> For agentic workers: use the released phase only, with root coordination and independent spec/standards review. Root owns integration/tracking/commit/push; workers do not commit. Approved product contracts remain authority. Interfaces and file responsibilities are in design.md.

**Goal:** Produce a canonical, immutable, analyst-owned preview without business writes or retained source/payload.

**Architecture:** SQL canonical normalization/resolution and batch guards feed request-local tuple serialization. A later metadata transaction seals protected bindings and hashes for TASK-11 revalidation.

**Tech stack:** Existing Next.js/TypeScript/Zod/Supabase PostgreSQL, node:crypto, Vitest; no new dependencies.

## 0. Review checkpoint — artifacts only

- [x] 0.1 Inspect approved #112/#113/#115 contracts and TASK-8/9/current canonical shared capabilities; record normalization/batch-context gaps.
- [x] 0.2 Define narrow SQL bridge, collision precedence, application interfaces and evidence boundary in proposal/design/spec/tasks.
- [x] 0.3 Run `rtk proxy openspec validate add-accession-preview-commitment --strict`; root independently verified PASS, approved artifacts/bridge semantics and released Phase 1 source only.

## 1. Phase 1 — canonical client planning (one PR/session)

Files: create `src/lib/accession-preview/client-contract.ts`, `clients.ts`, `clients.test.ts`, `src/lib/client-resolution/preview-server.test.ts`, `tests/accession-preview-clients.sql` and `tests/accession-preview-clients-migration.test.ts`; extend `src/lib/client-resolution/server.ts` only for the typed bridge. Add next-numbered `supabase/migrations/NNN_add_accession_preview_client_resolution.sql` after rechecking the current maximum (233 at checkpoint 0).

- [x] 1.1 Root approves bridge inputs/output validation, read-only SQL security boundary and exact guard precedence. Recheck existing helpers/SQL; no JS ICU/identity approximation or historical migration edits.
- [x] 1.2 Retain application RED assertions for resolver request projection/caller coordinates, reuse/create requirements, supplied optional validation and fail-closed results; actual RED→GREEN commands/results are in evidence.md.
- [x] 1.3 Retain source migration RED checks and `tests/accession-preview-clients.sql` behavioral fixtures covering normalizers, typed/legacy matches, duplicates/conflicts, confirmed-distinct UUIDs, unresolved name/accent/phone collisions and restricted/inactive/unauthorized cases. Authorized DB gate on 2026-11-04: corrected committed fixture passed 22 assertions, five denied-role and six malformed-input cases with rollback verified; see phase-3-db-gate-2026-11-04.md.
- [x] 1.4 Implement minimal read-only SQL bridge and typed adapter without metadata/hashing/API or business writes. Grouped guards retain one bounded related group witness per affected row; conflict takes precedence over duplicates.
- [x] 1.5 Run immediate-blast-radius parser/template/resolver/preview suite: 13 files/203 tests PASS. Scoped ESLint, typecheck and strict OpenSpec PASS; exact commands in evidence.md. Later authorized migration 233/behavioral/security execution passed on 2026-11-04.
- [x] 1.6 Root independently reviewed source and reran 14 files/222 tests, scoped ESLint/typecheck/OpenSpec strict: PASS. Independent SPEC PASS and STANDARDS no findings; Phase 1 source accepted. Later DB gate retained a fixture authority failure, corrected only the fixture in d24e8e0 without widening grants, and verified behavioral/security GREEN with rollback cleanup.

## 2. Phase 2 — accession-intent-v1 (one PR/session)

Files: create `src/lib/accession-preview/intent.ts` and `intent.test.ts`; add `tests/accession-preview-canonicalization.sql` fixtures, extending SQL bridge source only through a new forward-only migration if required.

- [x] 2.1 Root released Phase 2 source only from clean/pushed `d1823898ebe8f3e293a4ae92449b5323a1eeff21` and approved normalized input tuple / SQL fixture boundary.
- [x] 2.2 Retain 24 canonicalization tests; actual RED exit 1 / 24 failed assertions before implementation, then GREEN 24/24. Covers golden bytes/hash, UTF-8 ordering/control escapes/null/surrogates, references/metadata/order invariance, multiplicity, changed distinct graph edges, create→reuse stability, input versus display and malformed graph/plan rejection.
- [x] 2.3 Implement exact nested tuples with native byte sorting/hashing, no input mutation or normalization approximation. Retain independent fixture-local SQL serialization/normalization/byte/hash vectors in `tests/accession-preview-canonicalization.sql`; no production SQL/migration changes. User-authorized home-server execution on 2026-11-04: 10 SQL assertions PASS, matching application bytes/hashes; see phase-2-sql-parity-2026-11-04.md.
- [x] 2.4 Worker Phase 1+2 focused suite 15 files/255 tests PASS; root independently ran 16 files/274 tests including template API coverage. Scoped ESLint, typecheck, OpenSpec strict and diff/whitespace checks PASS. Root source review accepted; independent SPEC PASS and STANDARDS no findings. On 2026-11-04 root reran 24/24 intent tests alongside SQL parity PASS. Phase 1/3 SQL/security subsequently passed the separately authorized DB gate; Phase 4 and broader runtime acceptance remain open.

## 3. Phase 3 — durable commitments (one PR/session)

Files: `supabase/migrations/234_add_accession_preview_commitment.sql` (now applied and immutable), `tests/accession-preview-commitment.sql`, `tests/accession-preview-commitment-migration.test.ts`, and minimal `src/lib/accession-preview/server.ts`/`server.test.ts` orchestration.

- [x] 3.1 User released Phase 3 source on 2026-11-04 with worker `gpt-6.1-sol/high`; root reviewed the concrete metadata/bindings lifecycle, service-role-only RPC plus current analyst/owner checks, separate HMAC key ring/version, DB-only TTL, token/generation lease and transactional authority rechecks. Mandatory measured server policy has no defaults; absent configuration fails closed. Source release excluded migration execution/deployment; a later separate authorization covered the DB gate in 5.1 only.
- [x] 3.2 Worker retained source contract/application tests and captured RED with `rtk npm exec -- vitest run tests/accession-preview-commitment-migration.test.ts src/lib/accession-preview/server.test.ts`: exit 1, 2 files / 10 failed assertions, no collection errors. Expanded orchestration tests, GREEN and independent review completed in 3.5; retained SQL fixtures subsequently passed the separately authorized gate in 5.1. Static checks alone are not runtime proof.
- [x] 3.3 Migration 234 and server orchestration implement metadata/typed bindings, current analyst/owner service boundary, write-once known source, immutable seal, database TTL/lease and safe lifecycle audit. Baseline rejects existing preview routine names; exact RPC signatures are security-verified. Historical migrations remain untouched; TASK-11 success and TASK-12 runners remain excluded.
- [x] 3.4 Retain rollback-only SQL lifecycle/forged-role/owner/manager/immutability/stale-fence/drift/partial-rollback/no-business-write fixtures, including early-expiry denial and past-deadline state handling. Authorized home-server execution on 2026-11-04 passed all 35 assertions with explicit rollback and no residual synthetic state. Exact clock equality, real concurrent races, restart and full application TTL/retention remain INCOMPLETE.
- [x] 3.5 Root independently ran 18 files / 292 tests, scoped ESLint, typecheck, strict OpenSpec and diff checks: PASS. Independent SPEC PASS; STANDARDS P2 overload-privilege finding fixed and re-reviewed. Initial acceptance was SOURCE ONLY; the later authorized DB gate applied immutable migration 234 and passed behavioral/RLS/security verification, including independent root read-only checks. See evidence.md and phase-3-db-gate-2026-11-04.md. Phase 4/restart/concurrency/full TTL remain open.

## 4. Phase 4 — analyst preview API (one PR/session)

Files: create `src/app/api/accession-preview/route.ts`/`route.test.ts`, extend `src/lib/api-client.ts` and focused transport tests; use existing TASK-8 server snapshot and TASK-9 validation. No React UI in this phase.

- [x] 4.1 User released Phase 4 source to worker `gpt-6.1-sol/high` on 2026-11-04. Root reviewed active-analyst/OTP-before-body authentication, bounded in-memory multipart admission, mandatory measured request/response/deadline policy, pre-seal response budget, abort propagation and heartbeat termination, session-error compatibility, no-store and sanitized responses. In-flight seal outcome after disconnect remains unknown; no deployment or runtime configuration provisioning is authorized by this source release.
- [x] 4.2 Retained route/bridge RED: 2 files / 30 failed before implementation; additional root-review regressions reproduced lost HTTP 422 row errors, synchronous parser overrun dispatching seal before the abort timer, and elapsed-deadline HTTP 503 instead of 408. Final focused suite covers auth/OTP/CSRF, exact bytes/strict multipart/resource limits, stale authority, complete safe summaries/errors, no-store and cancellation without business writes or official sample IDs.
- [x] 4.3 Implemented Node POST and api-client FormData bridge with current active analyst/OTP and Origin guards before body, mandatory measured request policy, strict complete 422 transport schema, pre-seal response admission and absolute monotonic deadline/abort propagation. Actor/current authority remain server-derived; existing mutation session behavior is preserved. No deployment or runtime configuration provisioning.
- [x] 4.4 Root independently verified 26 files / 362 tests, scoped ESLint, typecheck, strict OpenSpec and CRLF-aware diff check PASS after review corrections. Independent SPEC PASS and STANDARDS no remaining findings. Phase 4 accepted SOURCE ONLY; deployed authenticated HTTP, restart/retention/concurrency/full TTL/capacity remain runtime gates, not certified by source tests.

## 5. Separately authorized runtime and exit gates

- [x] 5.1 User authorized the home-server DB gate on 2026-11-04. Root reviewed preflight; worker applied committed migrations 233 then 234 through SSH/sudo Docker psql, with security 36/36 PASS after each and final. Corrected committed client fixture and original commitment fixture passed with rollback verified; root independently verified privileges/RLS/security/cleanup. Migrations are now immutable; platform/storage ledgers were left unchanged because they do not track repo migration numbers. Exact provenance, hashes and limits: phase-3-db-gate-2026-11-04.md. Phase 2 parity remains 10 assertions PASS.
- [ ] 5.2 Authorized rollout verifies authenticated analyst preview, manager/other-owner denial, immutable exact-byte/hash commitment through application restart, absent source/payload retention, no business writes, current catalog/client drift and DB expiry semantics. Record deployed commit and exact PASS/INCOMPLETE evidence.
- [ ] 5.3 TASK-11 consumes sealed source/hash/bindings and reruns normalized intent; TASK-12 implements lease recovery/lock-safe purge; TASK-7 retains real stress/TTL/crash acceptance. Do not close those gates or TASK-8 deferred authenticated download acceptance from source checks.
- [ ] 5.4 Root updates TASK-10/#138 status to match evidence and integrates/pushes each released phase. No full TASK-10 DONE claim until its runtime exit evidence is satisfied.

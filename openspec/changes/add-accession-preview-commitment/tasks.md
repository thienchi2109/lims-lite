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
- [x] 1.3 Retain source migration RED checks and `tests/accession-preview-clients.sql` behavioral fixtures covering normalizers, typed/legacy matches, duplicates/conflicts, confirmed-distinct UUIDs, unresolved name/accent/phone collisions and restricted/inactive/unauthorized cases. SQL fixture source is written; SQL behavior remains NOT RUN / INCOMPLETE.
- [x] 1.4 Implement minimal read-only SQL bridge and typed adapter without metadata/hashing/API or business writes. Grouped guards retain one bounded related group witness per affected row; conflict takes precedence over duplicates.
- [x] 1.5 Run immediate-blast-radius parser/template/resolver/preview suite: 13 files/203 tests PASS. Scoped ESLint, typecheck and strict OpenSpec PASS; exact commands in evidence.md. Runtime SQL/security remains INCOMPLETE.
- [x] 1.6 Root independently reviewed source and reran 14 files/222 tests, scoped ESLint/typecheck/OpenSpec strict: PASS. Independent SPEC PASS and STANDARDS no findings; the nonblocking SQL fixture actor note was corrected and inspected. Phase 1 source accepted for integration; Phase 2 remains unreleased and SQL runtime remains INCOMPLETE.

## 2. Phase 2 — accession-intent-v1 (one PR/session)

Files: create `src/lib/accession-preview/intent.ts` and `intent.test.ts`; add `tests/accession-preview-canonicalization.sql` fixtures, extending SQL bridge source only through a new forward-only migration if required.

- [x] 2.1 Root released Phase 2 source only from clean/pushed `d1823898ebe8f3e293a4ae92449b5323a1eeff21` and approved normalized input tuple / SQL fixture boundary.
- [x] 2.2 Retain 24 canonicalization tests; actual RED exit 1 / 24 failed assertions before implementation, then GREEN 24/24. Covers golden bytes/hash, UTF-8 ordering/control escapes/null/surrogates, references/metadata/order invariance, multiplicity, changed distinct graph edges, create→reuse stability, input versus display and malformed graph/plan rejection.
- [x] 2.3 Implement exact nested tuples with native byte sorting/hashing, no input mutation or normalization approximation. Retain independent fixture-local SQL serialization/normalization/byte/hash vectors in `tests/accession-preview-canonicalization.sql`; no production SQL/migration changes. User-authorized home-server execution on 2026-11-04: 10 SQL assertions PASS, matching application bytes/hashes; see phase-2-sql-parity-2026-11-04.md.
- [x] 2.4 Worker Phase 1+2 focused suite 15 files/255 tests PASS; root independently ran 16 files/274 tests including template API coverage. Scoped ESLint, typecheck, OpenSpec strict and diff/whitespace checks PASS. Root source review accepted; independent SPEC PASS and STANDARDS no findings. On 2026-11-04 root reran 24/24 intent tests alongside SQL parity PASS. Phase 1 SQL/security and Phase 3/4 remain open.

## 3. Phase 3 — durable commitments (one PR/session)

Files: create next-numbered `supabase/migrations/NNN_add_accession_preview_commitment.sql`, `tests/accession-preview-commitment.sql`, `tests/accession-preview-commitment-migration.test.ts`, and minimal `src/lib/accession-preview/server.ts`/`server.test.ts` orchestration.

- [x] 3.1 User released Phase 3 source on 2026-11-04 with worker `gpt-6.1-sol/high`; root reviewed the concrete metadata/bindings lifecycle, service-role-only RPC plus current analyst/owner checks, separate HMAC key ring/version, DB-only TTL, token/generation lease and transactional authority rechecks. Mandatory measured server policy has no defaults; absent configuration fails closed. See design checkpoint below; no migration execution/deployment authorized.
- [x] 3.2 Worker retained source contract/application tests and captured RED with `rtk npm exec -- vitest run tests/accession-preview-commitment-migration.test.ts src/lib/accession-preview/server.test.ts`: exit 1, 2 files / 10 failed assertions, no collection errors. GREEN/expanded orchestration coverage and independent review remain pending; SQL fixtures are not runtime proof.
- [x] 3.3 Migration 234 and server orchestration implement metadata/typed bindings, current analyst/owner service boundary, write-once known source, immutable seal, database TTL/lease and safe lifecycle audit. Baseline rejects existing preview routine names; exact RPC signatures are security-verified. Historical migrations remain untouched; TASK-11 success and TASK-12 runners remain excluded.
- [x] 3.4 Retain rollback-only SQL lifecycle/forged-role/owner/manager/immutability/stale-fence/drift/partial-rollback/no-business-write fixtures, including early-expiry denial and past-deadline state handling. SQL NOT RUN; exact clock equality, real concurrent races and RLS/security/TTL runtime remain INCOMPLETE. Static source checks do not substitute for execution.
- [x] 3.5 Root independently ran 18 files / 292 tests, scoped ESLint, typecheck, strict OpenSpec and diff checks: PASS. Independent SPEC PASS; STANDARDS P2 overload-privilege finding fixed and re-reviewed with no further actionable findings; root accepted SOURCE ONLY. See evidence.md. Phase 4 remains unreleased; SQL/RLS/security/restart/TTL runtime INCOMPLETE.

## 4. Phase 4 — analyst preview API (one PR/session)

Files: create `src/app/api/accession-preview/route.ts`/`route.test.ts`, extend `src/lib/api-client.ts` and focused transport tests; use existing TASK-8 server snapshot and TASK-9 validation. No React UI in this phase.

- [ ] 4.1 Obtain explicit release and root review of multipart envelope, finite server-owned limits, request cancellation/timeouts that terminate preparation heartbeats, session error convention, no-store and sanitized logging/audit boundary.
- [ ] 4.2 Write retained failing route/bridge tests: unauthenticated/manager/other-owner denial before file processing; invalid envelope/resource rejection; stale descriptor/revision/generation/client resolution; exact source-byte digest; complete create/reuse summary; Vietnamese safe errors; no official sample IDs; no retention/business writes; no-store on all paths. Capture focused RED before route code.
- [ ] 4.3 Implement POST integration and api-client FormData bridge; trust only session actor/current authority; seal only complete consistent commitment; preserve current mutation session handling.
- [ ] 4.4 Run focused parser/template/resolver/preview/API tests and scoped lint/typecheck/strict OpenSpec; root and independent reviewers inspect evidence/diff. Source handoff explicitly remains SOURCE ONLY until runtime gate.

## 5. Separately authorized runtime and exit gates

- [ ] 5.1 Root obtains operation-specific home-server runtime authorization after committed/pushed source: apply only committed new migrations through home-server SSH + sudo Docker psql; run focused SQL behavioral/parity regressions and run_security_tests(); verify privileges/RLS and migration state. Partial evidence 2026-11-04: only Phase 2 parity authorized/executed (10 SQL assertions PASS; baseline security 36/36). Migrations 233/234 and their behavioral/security fixtures remain unapplied/unexecuted.
- [ ] 5.2 Authorized rollout verifies authenticated analyst preview, manager/other-owner denial, immutable exact-byte/hash commitment through application restart, absent source/payload retention, no business writes, current catalog/client drift and DB expiry semantics. Record deployed commit and exact PASS/INCOMPLETE evidence.
- [ ] 5.3 TASK-11 consumes sealed source/hash/bindings and reruns normalized intent; TASK-12 implements lease recovery/lock-safe purge; TASK-7 retains real stress/TTL/crash acceptance. Do not close those gates or TASK-8 deferred authenticated download acceptance from source checks.
- [ ] 5.4 Root updates TASK-10/#138 status to match evidence and integrates/pushes each released phase. No full TASK-10 DONE claim until its runtime exit evidence is satisfied.

# TASK-10 source evidence

Baseline: `c7c6806`; Phase 1 source-only release after root independently verified checkpoint 0 strict OpenSpec validation. No Phase 2–4 release. No SQL/database/Docker/SSH execution, deployment, commit or push by the worker.

## RED — before production implementation

`rtk npm exec -- vitest run src/lib/accession-preview/clients.test.ts src/lib/client-resolution/preview-server.test.ts tests/accession-preview-clients-migration.test.ts`

Exit 1; 3 test files / 32 assertion failures: missing adapter export, missing typed server bridge export, missing migration 233. Initial run encountered an unresolved static import in the new adapter suite; corrected test import loading only, then reran with 32 assertion failures and no collection error. Ordinary direct imports replaced the temporary missing-module assertion once modules existed; behavior cases remain retained.

Follow-up retained localization regression: `rtk npm exec -- vitest run src/lib/accession-preview/clients.test.ts` first returned exit 1 / 1 failed + 12 passed, demonstrating generic text obscured phone-conflict versus ambiguous reasons. Reused `localizeClientResolution` without caller-context interpolation; rerun passed 13 tests.

## GREEN — frozen Phase 1 source

`rtk npm exec -- vitest run src/lib/accession-preview src/lib/client-resolution src/lib/accession-workbook src/lib/accession-template tests/accession-preview-clients-migration.test.ts tests/accession-template-snapshot-migration.test.ts`

Exit 0; **13 files / 203 tests passed**. Includes parser large-batch/final-error coverage, template binding/generation source contracts, unchanged public resolver/caller tests and new adapter/typed bridge/source migration contracts. No SQL behavioral execution is included.

`rtk npm exec -- eslint src/lib/accession-preview/client-contract.ts src/lib/accession-preview/clients.ts src/lib/accession-preview/clients.test.ts src/lib/client-resolution/server.ts src/lib/client-resolution/preview-server.test.ts tests/accession-preview-clients-migration.test.ts` — exit 0.

`rtk npm run typecheck` — exit 0.

`rtk proxy openspec validate add-accession-preview-commitment --strict` — exit 0, change valid.

`rtk git diff --check` — exit 0; separate whitespace inspection of all new source/test/SQL files found no trailing whitespace. New SQL migration is 248 lines; retained SQL fixture 202 lines; all touched application/test files remain below 350 lines.

The bridge reuses SQL normalizers/public-v2 internal authority and five grouped canonical keys. One related group witness per error keeps output linear; it is not promised to identify the exact disagreeing pair in a mixed group. Three-row SQL fixture requires conflict to take precedence over a compatible-identity duplicate group. Existing permitted/adjudicated distinct UUIDs remain distinct. Existing display values are typed fingerprint inputs, not subjected to new-client phone/profile requirements.

Production/test source frozen after root and independent spec/standards review. Root owns backlog changes/integration/commit/push; those files were not modified by the implementation worker.

## Root checkpoint acceptance — 2026-11-03

Root inspected the complete source and SQL guard logic independently. SPEC review PASS; STANDARDS review found no actionable issues. A nonblocking SQL fixture note was corrected: synthetic manager JWT context is now set before business fixture inserts, so their rolled-back audit rows have an actor. Root inspected the three-line correction and reran the migration source test: 3/3 PASS. No PostgreSQL execution occurred.

Root independently ran the worker's focused command with `src/app/api/accession/template/route.test.ts` added for immediate API regression coverage: **14 files / 222 tests PASS**, 2026-11-03 05:56 UTC. The same scoped ESLint, `rtk npm run typecheck`, strict OpenSpec and diff checks all PASS. Production source did not change after these checks; the later correction touched only the unexecuted SQL fixture.

Checkpoint 1 is accepted as **SOURCE ONLY**. Phase 2 canonical hashing, Phase 3 durable commitment/TTL and Phase 4 preview API remain unreleased. TASK-10/#138 stays In Progress/OPEN; no migration application or deployment is part of this source checkpoint.

## Current boundary

Application/static source tests do not execute SQL, prove canonical SQL parity, RLS/security behavior, restart durability or full AC1. Retained SQL fixtures must run only in the separately authorized home-server session. Runtime SQL/security acceptance: **INCOMPLETE**.

## Phase 2 — source release and RED→GREEN

Root released Phase 2 from verified clean/pushed `d1823898ebe8f3e293a4ae92449b5323a1eeff21`; the unreleased Phase 2 statement in the historical Phase 1 record above applied at that earlier checkpoint. Phase 3/4 remain unreleased. No database/SSH/Docker/deployment/dependency/commit/push operations by the worker; migration 233 is unchanged.

`rtk npm exec -- vitest run src/lib/accession-preview/intent.test.ts` — before implementation: exit 1 / **24 failed assertions**, no collection failure, for the missing canonicalizer. After implementation and replacement of temporary missing-module loading with ordinary imports: exit 0 / **24 passed**.

New `intent.ts` consumes only Phase 1 normalized input and nested graph references. It encodes each sortable value once before comparison, uses Buffer.compare, preserves identical sample multiplicity and all graph edges, and returns canonicalJson/canonicalizationVersion/normalizedPayloadHash without mutating inputs. One-line export of the existing PlannedClient type is the only Phase 1 production change.

Golden JSON bytes/hash match the approved `090da05ce3b97394845d98b5d3fde180f150b3d452b5f067155466859a4e908e` vector. The shared named unicode-control vector is 239 UTF-8 bytes with digest `6ef396284f59ca65aa652936439faffc4406111fb34f3fa99de59a8bbfc72b5d`; it includes U+E000 versus U+10000 ordering, quote/backslash/control escapes and literal U+2028/U+2029. Tests also retain create→reuse stability, significant supplied optional input versus ignored display state, metadata/ref/order independence, distinct graph rebind changes, identical-node permutation, surrogate rejection and graph/plan consistency failures.

`rtk npm exec -- vitest run src/lib/accession-preview src/lib/client-resolution src/lib/accession-workbook src/lib/accession-template tests/accession-preview-clients-migration.test.ts tests/accession-template-snapshot-migration.test.ts tests/client-resolution-contracts.test.ts` — exit 0 / **15 files, 255 tests passed**.

`rtk npm exec -- eslint src/lib/accession-preview/intent.ts src/lib/accession-preview/intent.test.ts src/lib/accession-preview/clients.ts` — exit 0.

`rtk npm run typecheck` — exit 0. `rtk proxy openspec validate add-accession-preview-commitment --strict` — exit 0, valid. `rtk git diff --check` — exit 0; separate new-file trailing-whitespace inspection clean. Source sizes: intent.ts 67 lines, intent.test.ts 147, parity SQL 105.

`tests/accession-preview-canonicalization.sql` retains independent PostgreSQL tuple-array serialization, explicit UTF-8 byte sorting and native sha256 checks against the same named fixed vectors, plus SQL normalizer, nested ordering/multiplicity/edge checks. All helpers are pg_temp and the fixture rolls back; there is no production helper/migration. **This SQL has NOT RUN.** Application success and matching expected constants do not prove cross-runtime SQL/application parity. Phase 1 SQL/security and Phase 2 parity acceptance remain **INCOMPLETE** until an authorized home-server session executes the retained fixtures.

Phase 2 production/test source frozen after root and independent spec/standards reviews. No Phase 3/4 or full TASK-10 completion claim.

## Root checkpoint 2 acceptance — 2026-11-03

Root independently reviewed the canonicalizer and SQL fixture. SPEC PASS; STANDARDS no actionable findings. Golden bytes/hash, literal Unicode/control escaping, UTF-8 sorting, nested graph/multiplicity, create→reuse stability, optional input significance and fail-closed graph checks match the approved contract. No historical migration, dependency or runtime configuration changed.

At 07:56 UTC root ran the worker's Phase 1+2 command with `src/app/api/accession/template/route.test.ts` added: **16 files / 274 tests PASS**. Root also reran scoped ESLint, `rtk npm run typecheck`, `rtk proxy openspec validate add-accession-preview-commitment --strict --no-interactive` and diff checks: all PASS. The approved golden hash was separately recomputed with Node stdlib before implementation review.

Checkpoint 2 is accepted as **SOURCE ONLY**. SQL canonicalization fixtures and Phase 1 migration/security fixtures remain **NOT RUN / INCOMPLETE**; no SQL/application runtime parity, deployment or whole-import acceptance is claimed. Next checkpoint is Phase 3 durable commitments/TTL; user release is still pending. TASK-10/#138 remains OPEN/In Progress.

## Authorized SQL parity follow-up — 2026-11-04

[Exact runtime evidence](phase-2-sql-parity-2026-11-04.md): user authorized Phase 2 parity; root streamed the committed fixture from `2fd0d5c` through home-server SSH/Docker psql. PostgreSQL 15.1/UTF8 executed all **10 SQL assertions PASS**, explicit `ROLLBACK`, no remaining fixture helpers and unchanged normalizer definitions. Root reran **24/24 application intent tests PASS**; golden/Unicode canonical bytes/hashes match. Current deployed security baseline **36/36 PASS**.

This closes the previously unexecuted **Phase 2 parity vector gate only**. Migration 233 remains absent; Phase 1 SQL/security, Phase 3/4, rollout and full TASK-10 acceptance remain open. No migration application or deployment occurred.

## Phase 3 — released source checkpoint, 2026-11-04

User dispatched worker `gpt-6.1-sol/high`; root reviewed the schema/lifecycle, service-role/current analyst/owner boundary, separate versioned HMAC key ring, database TTL/lease and transactional authority rechecks before implementation. Source scope only: no migration execution, production configuration or deployment.

Worker captured meaningful RED with `rtk npm exec -- vitest run tests/accession-preview-commitment-migration.test.ts src/lib/accession-preview/server.test.ts`: exit 1, **2 files / 10 failed tests**, five missing migration contract assertions and five application behavior failures against an explicit unimplemented surface, without collection errors. An earlier harness collection failure was corrected before this retained RED.

### GREEN and independent review

Five feature files implement migration 234, minimal server orchestration and retained source/application/SQL fixtures. Known source SHA/size bind write-once after preparing allocation, counts remain null until validation/seal, and database time owns lease/30-minute TTL/finished_at. Full snapshot and canonical client decisions are transactionally rechecked under documented coarse SHARE locks. Only safe metadata/typed bindings/HMAC survive; identity recheck parameters remain transient.

Independent SPEC PASS. STANDARDS found one P2: the privilege loop could change pre-existing same-name overloads. Worker added a fail-closed routine-name baseline and exact-signature security assertions; re-review found no remaining actionable issue. Root also inspected final schema/grants/lifecycle/audit/HMAC/lease and application/fixture diff. A naming clarification changed `descriptor_digest` to `template_claims_digest`: it commits to authenticated parser claims, while source SHA-256 binds the exact original descriptor/workbook bytes. These corrections retained an additional RED run (2 failed / 16 passed), then **18/18 affected tests PASS**.

At 09:40 UTC, after the corrections, root independently ran:

`rtk npm exec -- vitest run src/lib/accession-preview src/lib/client-resolution src/lib/accession-workbook src/lib/accession-template tests/accession-preview-clients-migration.test.ts tests/accession-template-snapshot-migration.test.ts tests/client-resolution-contracts.test.ts tests/accession-preview-commitment-migration.test.ts src/app/api/accession/template/route.test.ts`

Exit 0: **18 files / 292 tests PASS**, including 12 server behavior tests with real parser/planner and mocked SQL transports, plus 6 migration source checks. The source checks do not execute SQL.

`rtk npm exec -- eslint src/lib/accession-preview/server.ts src/lib/accession-preview/server.test.ts tests/accession-preview-commitment-migration.test.ts` — exit 0, no warnings.

`rtk npm run typecheck` — exit 0. `rtk proxy openspec validate add-accession-preview-commitment --strict --no-interactive` — exit 0, valid. `rtk git diff --check` — exit 0.

New application/test files are 146/148/38/213 lines; migration 234 is 367 lines and keeps its single-purpose schema, baseline, security, audit and final verification atomic. No dependency, historical migration or deployment configuration changed.

### Root checkpoint 3 acceptance and limits

**SOURCE ONLY accepted**, with independent SPEC/STANDARDS/root review. TASK-10/#138 remains OPEN/In Progress; AC #3 and the runtime exit criteria remain unchecked. Phase 4 has not been released.

Migrations **233/234 are unapplied**; all new SQL behavioral/RLS/security fixtures are **NOT RUN / INCOMPLETE**. Exact database clock equality, real concurrent heartbeat/recovery races, restart, retention and TTL acceptance require separately authorized home-server execution and `run_security_tests()`. The prior deployed 36/36 baseline does not certify either new migration. No DB operation or deployment occurred in this phase.

Runtime must provision separate `ACCESSION_PREVIEW_BINDING_KEY_ID`/`ACCESSION_PREVIEW_BINDING_KEYS` and measured `ACCESSION_PREVIEW_POLICY` (evidence ID, finite lease/heartbeat and parser resources); absent/invalid policy or key fails closed, with no production defaults or secrets introduced. TASK-7 must benchmark coarse SHARE-lock contention; Phase 4 must integrate request cancellation/timeouts with heartbeat termination. TASK-11 owns atomic success; TASK-12 owns recovery/purge. TASK-8 deferred download gates remain deferred.

# TASK-11 source evidence

Baseline: `be7eb5c7b8943fd4fb904e9c9aae7df41b29683a`. User explicitly dispatched worker `gpt-6.1-sol/high` on 2026-11-05, with root coordination and independent review, continuing Backlog order. TASK-13 UI and deployment preparation were removed after the user postponed them; no UI implementation or production mutation occurred. Root owns tracking, integration, commit and push.

Decision authority: approved contracts #112/#113 and TASK-11/#139. TASK-10 source and its scoped SQL gate are accepted; deployed authenticated preview, restart, retention, exact clock equality, true concurrency/full TTL and capacity acceptance remain separate. Migrations 233/234 are applied and immutable; this source session performs no migration, database, Docker, SSH or deployment operation.

## Checkpoint 0 — artifact review

Worker drafted proposal/design/spec/tasks before migration or application code. Root independently ran `rtk proxy openspec validate add-atomic-accession-confirmation --strict --no-interactive` and `rtk proxy git diff --check`: PASS for the initial draft.

Initial independent SPEC review found one normative omission: cross-batch duplicate losers must become terminal `failed/ALREADY_IMPORTED`, not merely return a safe error. Initial STANDARDS/root review required explicit active-user read predicates, preservation of canonical confidential-client masking, and final invariant validation inside the business exception/savepoint block so a deferred commit-time failure cannot escape the outer safe failure/audit path. These are checkpoint corrections, not SQL runtime findings.

Root inspected the corrected actual artifacts and independently reran strict OpenSpec and whitespace checks: **PASS**. Duplicate losers now explicitly become terminal failed; read predicates require active users, parent receipt authority and current confidentiality/entity gates; succeeded repeats short-circuit before file/attestation/keys/expiry; the private final validator runs inside the business savepoint, with a single deferred receipt-INSERT safety check rather than a full graph scan per mapping. The exact ordered authority locks and schema-only Phase 1 fixture limits are documented.

**Root Phase 1 SOURCE release accepted, 2026-11-05:** implement receipt/global claim and typed immutable provenance with strict privilege/RLS guards and retained source RED→GREEN/rollback fixtures. Later phases remain root-gated. SQL behavioral/RLS/security/concurrency/atomicity fixtures are **NOT RUN / INCOMPLETE** until a separately authorized home-server session executes committed new migrations and their tests.

Deferred deployment finding: Compose currently does not forward the three `ACCESSION_PREVIEW_*` runtime variables. The user postponed deployment/UI; runtime wiring and measured key/policy provisioning belong in the later authorized rollout, not this TASK-11 source phase.

## Phase 1 — receipt/provenance source, 2026-11-05

Both independent reviewers confirmed their initial artifact findings are closed. Worker retained source RED before writing migration SQL: `rtk npm exec -- vitest run tests/accession-import-provenance-migration.test.ts` exited 1 with **6 failed / 1 passed**. The preservation check for applied 233/234 passed; missing schema/private-validator/RLS/security/fixture checks failed as intended. A subsequent security refinement retained **1 failed / 6 passed** before the owner/policy/grant assertions were added. These are source-contract failures, not executed PostgreSQL behavioral failures.

Migration 235 adds one immutable receipt/global hash claim and typed client/sample/assignment mappings. Noncascading FKs, local shape/uniqueness checks, an indexed parent lookup and one private final graph validator protect provenance. A single deferred receipt trigger is the commit-time safety belt; Phase 3 must also invoke the validator inside its business savepoint. Active owner-analyst/manager receipt RLS, current entity/confidentiality mapping gates, hidden hash column grants and private postgres-owned helpers leave business/audit policies and applied migrations unchanged. No confirmation entrypoint or business writes are introduced.

Root independently inspected the actual frozen source and partial SQL fixture, then ran:

| Check | Exact command | Result |
| --- | --- | --- |
| Focused migration source contracts | `rtk proxy npx vitest run tests/accession-import-provenance-migration.test.ts tests/accession-preview-clients-migration.test.ts tests/accession-preview-commitment-migration.test.ts tests/accession-template-snapshot-migration.test.ts` | **4 files / 25 tests PASS**, exit 0 |
| Touched test ESLint | `rtk proxy npx eslint tests/accession-import-provenance-migration.test.ts` | **PASS**, exit 0 |
| TypeScript | `rtk npm run typecheck` | **PASS**, exit 0 |
| OpenSpec | `rtk proxy openspec validate add-atomic-accession-confirmation --strict` | **PASS**, exit 0 |
| Tracked whitespace | `rtk git diff --check` | **PASS**, exit 0 |
| New file whitespace/lengths | Root inspected trailing whitespace and line counts in all three new SQL/test files | **PASS**, 263 / 87 / 191 lines |

Frozen SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `supabase/migrations/235_add_accession_import_provenance.sql` | `afd069b663bee98feed3d9ea33d9654a3fe52e3bc38c054cd4c354259f67ceaa` |
| `tests/accession-import-provenance-migration.test.ts` | `7e52f4c987d64a2e14d23d17038a0cb8044e2ea7488c2bfbc338ef8b91c7c1b5` |
| `tests/accession-import-provenance.sql` | `2621f1cd662c33a9a95d0f1ff81b5ee520d5f44d21dd5d9ec2ea8797882b8db1` |
| Applied migration 233, unchanged | `fc895bc7c2ea1976b80f145263a3e8dd7d672fe443f29650905473c2741254dc` |
| Applied migration 234, unchanged | `a4bb16cb004da4799c3084734a02f3eb3fbbb5904311c5ee0661ac5ff0a9ff53` |

Independent implementation review: **SPEC PASS; STANDARDS PASS after correction and re-review.** STANDARDS identified that policy substring checks could accept a weakened `true OR (...)` expression. Worker retained a focused source **RED 1 failed / 7 passed**, then changed the verifier to compare complete policy expressions against escaped literals frozen from reviewed DDL within the migration transaction. Creation-time capture occurs before the final owner/revoke/grant block; the verifier never reloads its expected expression at check-call time. Root inspected this correction and reran all checks above against the final hashes; both reviewers independently confirmed no remaining findings. This is metadata drift verification anchored to reviewed DDL, not independent behavioral RLS proof.

The retained SQL fixture uses pending deferred rows for all mapping kinds, checks shape/uniqueness/immutability, explicit/deferred rejection of unbacked success, owner/manager/withdrawn-role reads, confidential flag withdrawal, sample deletion, current result visibility and denied browser/service writes. It ends with `ROLLBACK`; it requires an existing published eligible confidential assay/sample-type pair and never changes the real catalog. Migration 234's success guard stays intact, so this fixture deliberately cannot establish a positive committed import. **Migration 235 application, SQL behavior, RLS/security runtime, full positive graph validation, atomicity, concurrency, drift and lock-time TTL are NOT RUN / INCOMPLETE.** No SSH, Docker, database or deployment operation ran. Root accepted **Phase 1 SOURCE ONLY**, completing 8/28 OpenSpec tasks including the artifact checkpoint. Phase 2 remains unreleased; TASK-11/#139 stays open and Backlog runtime/exit criteria remain unchecked.

## Phase 2 — worker evidence, pending root review, 2026-11-05

Root released only tasks 2.1–2.6 against `ceb56e3d0506c0fe559d6663376861c087123bcc`. This section is worker evidence, **not root acceptance**. No task boxes, Backlog state, GitHub state, commit or remote ref were changed by the worker.

Retained expected source RED: `rtk proxy npx vitest run src/lib/accession-preview/confirmation.test.ts tests/accession-confirmation-validation-migration.test.ts` produced **2 files / 42 failed**, exit 1, at 03:19 UTC (`/tmp/task11-phase2-red.log`). Failures followed correction of a strict-schema fixture setup error and were caused by the missing preparation module, migration and retained SQL fixture. These are application/source-contract failures, not PostgreSQL behavior. The local `rtk npx vitest` rewrite is unsuitable here; `rtk proxy npx vitest` invokes the installed runner correctly.

New server-only `confirmation.ts` checks analyst/UUID and calls a protected service reader first. Its current-active-owner succeeded receipt shortcut precedes source, quality attestation, configuration, retained keys and expiry. New work reparses original transient bytes, current snapshot/planner and canonical intent; compares source, complete sealed metadata/counts and typed binding graph/digest; recomputes client HMAC using each retained key version; and returns only a transient handoff. The approved small reuse change exports existing `buildBindings` and adds optional per-row retained key selection; existing preview assembly remains covered by its original tests.

New migration 236 leaves 233/234/235 untouched, adds a service-only protected reader and an **ungranted** locked validator/compact tuple serializer. Validation holds current actor and owned batch, takes the exact nine ordered final-mode locks, reruns snapshot/resolver under verified actor JWT context, restores all three JWT settings on success/exception, checks exact row/parent/catalog/client/count/hash bindings, independently reconstructs canonical intent and takes one post-validation database acceptance clock (`>= expires_at` rejects). It persists no batch state, business row, official ID or receipt timestamp. The new metadata security verifier is registered in `run_security_tests()`; executing it is deferred with migration application.

| Worker check | Command | Result |
| --- | --- | --- |
| Focused and immediate regression tests | `rtk proxy npx vitest run src/lib/accession-preview/confirmation.test.ts tests/accession-confirmation-validation-migration.test.ts src/lib/accession-preview/server.test.ts src/lib/accession-preview/intent.test.ts src/lib/accession-preview/clients.test.ts tests/accession-import-provenance-migration.test.ts` | **6 files / 109 tests PASS**, exit 0; `/tmp/task11-phase2-green.log` |
| Touched ESLint | `rtk proxy npx eslint src/lib/accession-preview/confirmation.ts src/lib/accession-preview/confirmation.test.ts src/lib/accession-preview/server.ts tests/accession-confirmation-validation-migration.test.ts` | **PASS**, no warnings |
| TypeScript | `rtk npm run typecheck` | **PASS** |
| Strict OpenSpec | `rtk proxy npx openspec validate add-atomic-accession-confirmation --strict` | **PASS** |
| Tracked whitespace | `rtk git diff --check` | **PASS** |
| Historical migration preservation | SHA-256 compared with Phase 1 frozen evidence | **233/234/235 unchanged** |

`tests/accession-confirmation-validation.sql` retains rollback-only synthetic behavioral assertions and a separate multi-session runbook for creator/lifecycle/publisher, confidentiality relationships, actor withdrawal and waiting across TTL. It does not disable historical guards/RLS/audit. Exact wall-clock microsecond equality is source-predicate coverage; real lock-time admission and accepted-before-deadline completion remain runtime scenarios. The positive succeeded-receipt scenario and real business audit attribution require Phase 3 committed graph fixtures. **All SQL behavioral/security/RLS/concurrency/parity scenarios are NOT RUN / INCOMPLETE.** No DB, SSH, Docker, deployment or runtime configuration operation occurred; Phase 3 and runtime release remain gated.

### Worker review corrections — pending root re-review

Retained source RED at `/tmp/task11-phase2-review-red.log`: migration source suite **2 failed / 5 passed**, exit 1, for missing explicit locked-current/sealed revision equality and missing actual authority mutation/concrete concurrency scenarios. Added `v_snapshot->>'revisionNumber' IS DISTINCT FROM v_batch.revision::TEXT` rejection before acceptance. This closes an independent SQL consistency gap; it is **not evidence of a reachable bypass through the current correct adapter**. The adapter derives snapshot digests/revision, verifies the signed workbook descriptor, compares all derived metadata to the immutable batch, and passes that same snapshot; SQL compares it to the locked current snapshot. Thus concurrent drift already failed the existing handoff comparison. SQL continues to trust privileged original-byte/HMAC/signature preparation; no generic duplicate digest serializer or new dependency was introduced.

The behavioral fixture now mutates actual assay catalog name/method text, introduces a real exact client candidate, changes the reused client's profile, and inserts real sample/result confidentiality relationships in rollback subtransactions. It asserts full business/provenance/**audit** count equality immediately after pure validation, before fixture-only authority/batch mutations. These scripts are retained and **NOT RUN**, so they are not runtime findings. The new `tests/accession-confirmation-concurrency.md` supplies exact uncommitted B setup/payload, real creator/lifecycle calls, publisher revision conflict modes, validator call, pg_locks/pg_blocking_pids assertions, TTL cases and ROLLBACK cleanup. It requires a separately authorized disposable home-server DB named `task11_disposable_*`; it commits no fixture. Direct publisher/relationship mode cases establish only the relevant lock intersections when executed; full real publisher/single-accession transaction/deadlock rehearsal remains INCOMPLETE.

Correction GREEN: the same six-file focused command above now reports **111/111 PASS**, exit 0 (`/tmp/task11-phase2-review-green.log`). Touched ESLint, typecheck, strict OpenSpec and tracked whitespace checks passed again. SQL scenarios, migration application, security execution and concurrency remain **NOT RUN / INCOMPLETE**. No runtime operation occurred.

**Phase 3 pre-release note:** verify actual current assay method authority against `results.method_id` before releasing business writes. The snapshot and sealed binding carry authoritative assay-owned `methodName` text (migration 143/232/234); legacy method UUIDs are a separate compatibility field. Phase 2 validates snapshot/generation/methodName only and makes no automatic text-to-UUID inference. This note releases no Phase 3 work.

Final worker fixture correction: source regression retained **RED 1 failed / 7 passed** (`/tmp/task11-phase2-method-red.log`) before removing the invalid `assay_definitions.method_id` selection from the new confidentiality fixture; the nullable `results.method_id` is now omitted. Focused source suite then passed **8/8**, with touched test ESLint and whitespace clean. No SQL was run.

**Phase 3 BLOCKER — pre-existing migration 235 baseline defect:** its private receipt validator at lines 140–141 references `assay.method_id`, but migration 011 removed `assay_definitions.method_id` and migration 143 adds authoritative `method_name` text only. The root/scout verified this against current migration source. Migration 235 remains byte-for-byte unchanged. Before any Phase 3 business-write/runtime release, correct that validator and settle text/nullable-result-UUID semantics in a **new forward-only migration after 236**, with focused regression and separately authorized SQL validation. Current Phase 2 source checks do not certify the defective pre-existing receipt validator at runtime.

### Root Phase 2 source acceptance — 2026-11-05

Root inspected the final diff and live fixture, independently reran the six-file focused command: **112/112 tests PASS**, exit 0. Touched ESLint, `rtk proxy npm run typecheck`, strict OpenSpec and whitespace checks all passed. Original migration 233/234/235 SHA-256 values match the Phase 1 evidence byte-for-byte. New migration 236 SHA-256: `c1e804b0f1293304c0650d7036a3c279d2c4f938cd80a22f270de571a2417803`.

Independent **SPEC PASS; STANDARDS PASS** on the final correction. The explicit SQL revision/scenario gaps were corrected; root additionally caught and removed the new fixture's invalid assay method-column selection. A stale-index standards finding about the audit assertion was withdrawn after rereading the live file: the immediate pure-validator check compares all six counts, including audit. Source reviews do not prove SQL execution.

Root accepts **Phase 2 SOURCE ONLY**, completing 14/28 OpenSpec tasks. TASK-11/#139 remains open/In Progress. **Phase 3 is not released** and its migration-235 method-column baseline defect must be corrected forward-only before business-write/runtime release. SQL application/security/behavior/parity/concurrency, real publisher/single-accession rehearsal, browser/UI/deployment and TASK-7/12/13 gates remain **NOT RUN / INCOMPLETE / DEFERRED** as applicable. No SSH, Docker, database, deployment or runtime configuration operation occurred in this session.

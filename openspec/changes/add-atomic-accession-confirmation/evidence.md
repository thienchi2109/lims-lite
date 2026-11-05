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

# TASK-10 Phase 1 source evidence

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

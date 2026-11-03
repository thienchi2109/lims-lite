# TASK-9 source verification evidence

Source only. No runtime upload/proxy/DB/capacity acceptance is claimed. TASK-8 deferred 4.4/4.6 and TASK-7 acceptance remain unchanged.

## Phase 1 — archive/resource/XML primitives

- Initial RED, 2026-11-03 01:00 UTC: `rtk proxy npx vitest run src/lib/accession-workbook/archive.test.ts src/lib/accession-workbook/xml.test.ts --reporter=dot` → 28 failed because the new archive/XML implementation modules did not exist.
- Additional concrete adversarial RED, 01:02:58 UTC: same command after adding actual-CRC/EOCD tests → 1 failed / 30 passed. ZIP end-record search incorrectly accepted an EOCD just outside the legal comment window. Retained regression: `requires a real end record within the ZIP comment search window`.
- Additional concrete deadline RED, 01:03:44 UTC: `rtk proxy npx vitest run src/lib/accession-workbook/archive.test.ts -t 'large finite policy' --reporter=dot` → 1 failed. Native timeout overflow converted a valid large finite policy to 1ms. Retained regression and capped native timer fix; monotonic deadline remains authoritative.
- Guards cover real 9,999,999-byte archive and rejection at 10,000,000/10,000,001; local/central/descriptor/CRC mismatches; stored/deflated bytes; entry paths/duplicates; forged actual-inflate bomb; finite policy; retained-state checks before copying/SAX; XML namespaces/DTD/custom entities/depth/token/cell geometry; asynchronous yielding and deadline.
- Native `node:zlib.crc32` is supported by the project's Node20.20.2 baseline (added Node20.15). No custom CRC code or runtime dependency on dev-only packages.

Final Phase 1 gates at 01:04 UTC:

- Focused Vitest command above → 2 files / 32 tests PASS.
- `rtk proxy npx eslint src/lib/accession-workbook/*.ts` → PASS, no output.
- `rtk npm run typecheck` → PASS.
- `rtk proxy openspec validate add-accession-workbook-validation --strict --no-interactive` → valid.

Root independently reran the 32 focused tests, scoped ESLint, typecheck and OpenSpec strict at 01:04 UTC: all PASS. Root inspected the source and retained EOCD/deadline fixes; independent spec review found no blocking Phase 1 issue. Phase 2 cleared after this review.

## Phase 2 — exact literal OOXML and template authority

- Producer RED 01:06:19 UTC: `rtk proxy npx vitest run src/lib/accession-template/workbook.test.ts -t 'physically encodes' --reporter=dot` → 1 failed. Existing SheetJS output used `t="str"`; approved input accepts shared/inline strings. Minimal producer fix `bookSST:true`; all 6 producer tests GREEN at 01:06:21.
- Parser RED 01:07:32: `rtk proxy npx vitest run src/lib/accession-workbook/workbook.test.ts --reporter=dot` → 19 failed because semantic modules did not exist. Initial semantic implementation → 18 passed; corrected a test's partial-array expectation to assert all 10 columns, then 19 passed.
- Additional real RED 01:12:32: extended semantic suite → 2 failed / 25 passed for empty styled numeric cells and expected missing-sheet locations. Both retained regressions now GREEN.
- Coverage: arbitrary worksheet order/namespace aliases; hidden/filter rows; shared/inline/rich text; static named/direct catalog dropdowns and range bounds; all independent raw cell errors sorted by contract coordinates; missing sheets; exact read-only guide; literal metadata/catalog verification; formulas/cached formulas/nontext; extra empty columns, duplicate cells, merges, external links, macro parts, computed names, malformed namespaces/nested cells and unsafe unused shared-string constructs.
- Known metadata errors point at real cells (descriptor B6, revision B5, version B3). Workbook-global failures retain null coordinates. Safe semantic errors survive SAX parsing.
- The reused synchronous TASK-8 verifier receives conservative charged working state before Zod/JSON/hash allocations, with deadline yields before/after. Matrix, row/error sorting and final return check budgets/deadlines. No hard process watchdog claim.
- Combined parser/template tests at 01:13 UTC: `rtk proxy npx vitest run src/lib/accession-workbook src/lib/accession-template src/app/api/accession-template --reporter=dot` → 5 files / 99 tests PASS. Correctly located immediate route test: `rtk proxy npx vitest run src/app/api/accession/template/route.test.ts --reporter=dot` → 19 PASS. Scoped ESLint/typecheck PASS; OpenSpec strict valid.
- Compatibility limit: deployed/older producer revisions may emit unsupported `t="str"`; prior downloads require a regenerated template after eventual source deployment. This session does not deploy the producer or fix TASK-8 deferred runtime gates.
- Root's server-readiness review retained concrete RED→GREEN at 01:16 UTC: focused `-t 'unavailable server'` failed then passed. Invalid trusted signing configuration/current authority now return their safe server-unavailable codes with Vietnamese messages and workbook-null coordinates, without secrets or falsely blaming B6.
- Readiness checkpoint with the correct route path: `rtk proxy npx vitest run src/lib/accession-workbook src/lib/accession-template src/app/api/accession/template/route.test.ts --reporter=dot` → 6 files / 119 tests PASS. Scoped ESLint, `rtk npm run typecheck`, and OpenSpec strict PASS after the readiness fix.
- Independent review found ambiguous repeated singleton XML containers. Retained RED 9 failed at 01:20:30 → GREEN 9 passed at 01:20:42; singleton containers and rich-text choices now reject duplicate/mixed representations.
- Independent review found nonrepresentable OOXML escapes. Retained RED 4 failed / 1 passed at 01:21:17 → GREEN: NUL/unpaired surrogates rejected with safe coordinates; valid pairs and escaped literal sequences preserved. Native `isWellFormed()` avoids a custom surrogate scanner.
- Root independently reran the reviewed Phase 2 scope at 01:22 UTC: **133/133** tests, scoped ESLint, typecheck and OpenSpec strict PASS. Root read the fixes; independent spec re-review cleared both blockers before Phase 2 commit. Runtime acceptance remains unclaimed.

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

## Phase 3 — structural rows and TASK-10 handoff

- RED 01:19:13 UTC: `rtk proxy npx vitest run src/lib/accession-workbook/validate.test.ts --reporter=dot` → 18 failed because `validate.ts` did not exist. First implementation → 17 passed / 1 failed: an invalid optional gender enum prevented Zod's canonical identity pairing refinement. Separate canonical base and optional-field validation preserved independent errors; 18 GREEN at 01:23:26.
- Additional typed CCCD/CMND pairing/ASCII/length/case, optional length and namespace coverage → 28 structural tests PASS at 01:26 UTC.
- Test-only historical-cap fixtures prove 501 clients, 1,001 samples and 20,001 assignments are processed without business count caps. The last case changes the final assignment at physical B20002 to an invalid catalog code and proves errors-only output. Explicit test resource profiles, including a 1GiB conservative allocation budget for the large fixture, are NOT production configuration/capacity evidence.
- Phone `0000000000` becomes null as the approved missing/untrusted sentinel. Supplied length is checked after trim/NFC before existing `isValidVietnamesePhone`/`normalizePhoneVN`; missing phone/gender stay deferred to TASK-10 create resolution.
- Reused canonical date/identity/name/optional validators; no name+DOB matching/dedup, identity resolution, business writes or retained workbook/payload/cache/logs.
- Source security follow-up: unexpected nonwhitespace literal content in package relationship/content-type XML was previously ignored by the generic semantic handler. Retained focused RED at 01:28:30 → GREEN at 01:28:32; structural XML now rejects text unless an explicit literal/defined-name consumer exists.
- Final worker gates at 01:28 UTC: `rtk proxy npx vitest run src/lib/accession-workbook src/lib/accession-template src/app/api/accession/template/route.test.ts --reporter=dot` → 7 files / 162 tests PASS. Scoped ESLint, `rtk npm run typecheck`, OpenSpec strict and `rtk proxy git diff --check` PASS. Independent final review remains pending; task 3.3 is intentionally unchecked until root accepts it.
- Final independent spec review found no blocker and standards review found no findings. One minor duplicate-diagnostic case was corrected with local validator guards: focused `-t 'single diagnostic'` RED at 01:31:40 → GREEN at 01:31:43 for overlong phone/unknown paper type. No global dedup abstraction was added.
- Post-review final worker gates at 01:32 UTC: same complete focused suite → **7 files / 163 tests PASS**; scoped ESLint, typecheck, OpenSpec strict and diff whitespace check PASS. Task 3.3 awaits root's final integration acceptance; runtime claims remain unchanged.

### Consumer interface

Import `validateAccessionWorkbook` and `ValidatedAccessionWorkbook` from `src/lib/accession-workbook/validate.ts`; options/result types are in `workbook.ts`, error/location types in `errors.ts`.

`validateAccessionWorkbook(bytes: Uint8Array, { snapshot, signingConfig, resources })` asynchronously returns `{ok:true,value:{template,clients,samples,assignments}}` or `{ok:false,errors}`. Outputs are mutually exclusive. `resources` is mandatory server-owned policy, never request-derived; all seven limits must be positive finite safe integers. There are no production defaults.

- `template` contains authenticated TASK-8 claims, including revision and authority/catalog digest.
- `clients` contain temporaryReference, canonical-resolution input fields plus supplied optional profile fields and original-row callerContext. Optional fields are null, phone is canonical, typed identity enum is lowercase `cccd`/`cmnd`; input paper labels remain strict uppercase CCCD/CMND.
- `samples` contain temporaryReference, clientTemporaryReference, sampleTypeCode and callerContext.
- `assignments` contain sampleTemporaryReference, assayCode and callerContext.
- Rows preserve real sheet/row coordinates; errors add column/header, related duplicate locations and deterministic contract-sheet/row/column/code sorting. Error objects omit raw profile values and exception/secret details.
- TASK-10 owns canonical identity resolution, same-batch identity guards, create-only missing phone/gender validation, UUID/generation resolution from current trusted authority, normalized hash/commitment and preview persistence. Public success returns no raw workbook, raw matrices, signing config, budget or candidate identities.

### Source map and limits

- `archive.ts`/`budget.ts`/`xml.ts`: ZIP/CRC/actual-inflate and controlled-resource primitives.
- `package.ts`/`ooxml.ts`/`decorations.ts`: namespace-aware package relationships, semantic allowlists and singleton cardinality.
- `strings.ts`/`worksheet.ts`/`workbook.ts`: literal text, physical sparse rows, exact guide/headers and TASK-8 verifier.
- `clients.ts`/`structure.ts`/`validate.ts`: canonical field checks, references and typed public all-or-nothing result.
- Source validation only. No migration/rollout is needed here. Actual process RSS/concurrency, production resource policy, app/proxy upload boundary and DB/HTTP acceptance stay TASK-7. TASK-8 deferred 4.4/4.6 remain unchecked. Older deployed `t="str"` templates remain a compatibility boundary until eventual authorized generator deployment/regeneration.

## Root source acceptance — 2026-11-03 01:32 UTC

- Root independently ran `rtk npm run test:run -- src/lib/accession-workbook src/lib/accession-template src/app/api/accession/template/route.test.ts`: **7 files / 163 tests PASS**. This includes the final XML-text and duplicate-diagnostic regressions.
- Root independently ran scoped ESLint for all parser files and the touched producer/tests, `rtk npm run typecheck`, `rtk proxy openspec validate add-accession-workbook-validation --strict`, and `rtk git diff --check`: **PASS**.
- Root inspected each source phase and final diff. Independent spec review cleared its singleton/Unicode findings and the final structural-XML change; standards review found no actionable issue. The minor repeated-diagnostic finding was fixed with local validator guards and a retained RED→GREEN regression.
- Source exit accepted: OpenSpec **10/10**, Backlog TASK-9 **5/5**. Reviewable source checkpoints are `0e06bbe` (Phase 1), `b9c4301` (Phase 2), followed by Phase 3 integration. No full test suite, deployment, database test or production-capacity claim is implied by these focused source gates.
- TASK-8 remains **17/19, 4.4/4.6 DEFERRED**. TASK-10 is not started; the consumer interface above is its handoff. TASK-7 retains runtime acceptance.

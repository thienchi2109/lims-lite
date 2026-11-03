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

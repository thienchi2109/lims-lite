# Phase 2 source evidence — 2026-11-02 UTC

Status: **SOURCE ONLY**. Phase 2 adds descriptor/digest verification and an in-memory generator; Phase 3 download/UI and Phase 4 runtime gates remain incomplete. Source baseline: `62305bc632467d27256e059f7b4cf3da04ad6421`. No SQL/history or Phase 1 evidence was changed. Migration 232 remains **unapplied**; SQL regression, `run_security_tests()`, deployed download/restart/rotation/no-retention checks are **NOT RUN**.

## RED → GREEN

- Before production modules existed, `rtk proxy npm run test:run -- src/lib/accession-template/binding.test.ts src/lib/accession-template/workbook.test.ts` exited **1**, **35/35 failed** (31 binding, 4 workbook): expected missing `./binding` / `./workbook` imports. All assertions were retained through GREEN.
- Root review found malformed positive-decimal validation could throw a native BigInt error. Added regression first: binding suite exited **1**, **1 failed / 31 passed**, expecting the fixed catalog error but receiving `Cannot convert invalid-generation to a BigInt`. Lexical decimal bounds now avoid numeric conversion entirely, including malformed/overlong input.
- Native writer overflow regression first: workbook suite exited **1**, **1 failed / 4 passed**, because a one-cell range `A1048577` did not throw. Existing `XLSX.write` option `WTF: true` now rejects an Excel grid overflow; no business count cap or silent catalog truncation was introduced.
- Final focused and immediate authority blast-radius command:

```sh
rtk proxy npm run test:run -- src/lib/accession-template/binding.test.ts src/lib/accession-template/workbook.test.ts tests/accession-template-snapshot-migration.test.ts tests/assay-sample-type-catalog-rpc-migration.test.ts tests/assay-sample-type-catalog-stale-state-migration.test.ts tests/assay-sample-type-catalog-review-hash-migration.test.ts tests/assay-sample-type-enforcement-migration.test.ts
```

Result: exit **0**, **68/68 PASS**, seven files (38 Phase 2 execution tests + 30 existing SQL-source contracts). Scoped `rtk npm run lint -- src/lib/accession-template`, `rtk npm run typecheck`, `rtk proxy openspec validate add-versioned-accession-template --strict --no-interactive` and `rtk proxy git diff --check` exit **0**. These are local source checks; SQL-source contracts do not execute PostgreSQL.

Root independently reviewed the signing/digest/workbook implementation and tests, then reran every command above with the same **68/68 PASS** and exit **0** results. Separate spec and standards review found no remaining issues. Root also updated the backlog index to the Phase 1–2 source checkpoint; overall TASK-8 remains In Progress.

## Successor API and canonical schemas

Server-only source: `src/lib/accession-template/{contract,binding,workbook}.ts`; existing `xlsx` and Node `crypto`, no new dependencies.

- `validateTemplateSnapshot(unknown)` validates the [Phase 1 RPC shape](phase-1-source-evidence.md), canonical UUID/code formats, positive decimal BIGINT strings through `9223372036854775807`, unique entities/pairs, nonempty pairs and exact referenced entity unions. It cannot independently prove SQL eligibility: callers must use the authenticated server RPC, never a workbook-provided snapshot.
- `generateAccessionTemplate(snapshot, signingConfig): Buffer` validates that one snapshot, emits server UTC milliseconds, signs it and returns memory-only XLSX bytes. It performs no RPC, authorization, file/cache/log/Storage write or business mutation. Phase 3 must authorize analyst **before** fetching the single snapshot, load server configuration, return binary attachment/private no-store and map fixed error codes to safe Vietnamese messages.
- `readTemplateSigningConfig(env = process.env)` requires `ACCESSION_TEMPLATE_SIGNING_KEY_ID` and `ACCESSION_TEMPLATE_SIGNING_KEYS` (JSON object mapping key id to exactly 32 random bytes encoded as 64 hex characters). IDs use 1–32 ASCII alphanumeric/underscore/hyphen characters. The active key must exist as an own property. Retained configured keys verify old templates; removing a key retires it. No defaults or committed runtime keys; test secrets are synthetic. Configuration errors never include source values.
- `createTemplateBinding(snapshot, config, generatedAt): string[][]` returns the metadata header plus five exact #112 key/value rows. `catalog_binding` is `keyId.base64url(claimsJSON).base64url(HMAC-SHA256(keyId + '.' + payload))`, bounded at 2048 characters independently of catalog cardinality. Claims are the explicit array `["accession-template-binding", 1, "lims-bulk-accession", "1", generatedAt, revisionNumber, authorityDigest, catalogDigest]`. No catalog, business rows or PII are embedded.
- `verifyTemplateBinding(metadataMatrix, catalogMatrices, config, currentSnapshot): TemplateClaims` requires original literal string matrices, including headers, for metadata and the three catalog sheets in contract order. It validates envelope bounds/key/encoding, timing-safe MAC **before** parsing claims, strict claims schema, metadata equality, original catalog digest and current authority digest. No generated-at TTL is imposed. It returns verified template id/version/time/revision/digests, not secret material.

Both digests are SHA-256 of UTF-8 `JSON.stringify` of explicit JSON arrays; objects/ZIP order never define their schema. Entity/pair arrays sort lexicographically by their JSON array encodings (codes have fixed widths); workbook catalog row order does not affect the digest. Literal label/method text is neither trimmed nor normalized.

```text
authority = ["accession-authority", 1, [revisionId, revisionNumber],
             sorted[[sampleCode, sampleUUID, generation], ...],
             sorted[[assayCode, assayUUID, generation], ...],
             sorted[[sampleCode, assayCode], ...]]
catalog   = ["accession-catalog", 1,
             [[literalHeaders, ...sortedLiteralRows], ...threeCatalogs]]
```

Nullable `methodName` becomes literal empty Text in the workbook/catalog digest. Independent current label/method-display renames with unchanged revision/UUID/code/generation/eligibility pass authority verification; editing **original workbook** labels/methods always fails. Revision, UUID, code, generation, valid pair changes or eligible union removal fail closed. Unsupported versions, malformed/unknown/retired keys, incomplete/duplicate/orphan authority and malformed metadata fail closed.

TASK-9 must first enforce file/ZIP/XML/resource bounds and reject formulas/non-Text cells before forming these matrices; passing a numeric/date cell through string coercion is forbidden. Binding verification is not structural/business parsing. TASK-10/11 still own server resolution, preview TTL, referenced bindings and lock-safe confirmation rechecks; this digest does not replace them.

## Workbook and proof limits

Actual XLSX round trips verify eight visible sheets in #112 order, exact optional headers and metadata, literal Text (including leading-zero/formula-like published labels), empty business sheets, original catalog integrity and Vietnamese guidance. SheetJS CE 0.20.3 ignores `!cols[].numFmt`; the generator uses its already-bundled CFB API to append built-in `numFmtId=49` and set business column defaults in the self-generated OOXML ZIP, in memory. Tests inspect actual column min/max/style indices, referenced Text format and header-only worksheet rows. The patch fails closed on unexpected generated XML and uses fixed v1 sheet positions; dynamic layouts would need relationship lookup.

The final Buffer must be strictly **<10,000,000 decimal bytes**. Tests cover 9,999,999 / 10,000,000 / 10,000,001 boundary arithmetic and an oversized serializer result rejected by the actual generator. There are no business count caps, catalog truncation or seeded business examples; native Excel format limits fail closed. Browser Excel/LibreOffice editing, real configured catalogs, endpoint/no-store behavior, deployed restart/rotation and production disk/proxy/log retention remain unverified. The restart test reloads the module with reconstructed config and a distant clock; it is not a server deployment test.

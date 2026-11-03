## Context

Implements TASK-9/#137 and the approved contracts in `docs/superpowers/specs/2026-11-01-excel-template-contract-design.md` and `2026-11-01-atomic-import-provenance-contract-design.md`. TASK-8 source authority exists; its deferred 4.4/4.6 runtime gates remain unchecked. Current graph is stale, so targeted source is authoritative.

## Goals / Non-Goals

**Goals:** hostile-input defense, exact literal-text workbook parsing, authenticated catalogs and structural row validation, Vietnamese errors with real coordinates, all-or-nothing in-memory output.

**Non-Goals:** identity matching, create-only phone/gender requirements, preview persistence/hash/commit, HTTP upload routes, DB writes/migrations, production operations or capacity acceptance.

## Decisions

### Trust boundary and dependency reuse

Accept only a Buffer/Uint8Array whose actual byte length passes existing `assertTemplateFileSize` (<10,000,000 decimal bytes), before ZIP processing. Do not accept filename, MIME, advertised size or ZIP size fields as proof. Reuse TASK-8 constants, `verifyTemplateBinding`, snapshot validation, `isIsoDateString` and canonical client phone validation. `saxes` 6.0.0 is already installed but dev-transitive; root promotes that exact installed version and `xmlchars` to the runtime graph without installing packages. No `fflate` runtime import, formula engine, ad hoc XML lexer or regex XML security scanner.

### ZIP and resource threat model

Read the small fixed ZIP record structures directly because no suitable installed runtime ZIP validator exists; inflate only with native `node:zlib`. Reject encrypted/multidisk/ZIP64 archives, unknown compression, duplicate/path-traversal names, overlapping records, local/central filename/flags/method/size/CRC disagreement, malformed data descriptors, extra undeclared local data and truncated/trailing records. Validate actual expanded byte count and CRC for every entry, including ignored metadata parts. Reject unrecognized package parts or relationship/content types before semantic parsing.

Require an explicit server-owned resource policy (no production-capacity defaults): maximum actual inflated bytes, entry count, cell count, XML depth/text token size, retained-state allocation budget and elapsed milliseconds. Values must be positive safe integers. These are defensive resource ceilings, never business client/sample/assignment caps. A resource rejection returns no partial data. Tests use documented test-only profiles; TASK-7 selects and verifies deployed resource capacity. The old 32MiB/256-entry/160k-cell/watchdog prototype is not reused as authority.

Inflate entries sequentially with bounded native output, process XML in bounded chunks, check deadline during ZIP/XML/cell work and yield between chunks. Account conservatively for retained decoded strings, cells, maps, row objects and errors before retaining them. Archive validation returns all expanded buffers still charged; the semantic phase releases each buffer after use. The caller's original input stays charged throughout public validation; only the private compressed copy is released after archive validation. Reserve conservative SAX working state before parsing any bytes so attributes/text accumulated before callbacks are covered. No process-RSS or hard external watchdog claim is made by an allocation budget: runtime isolation/concurrency and actual peak memory belong to TASK-7.

### OOXML semantics and supported surface

Namespace-aware SAX processing rejects malformed XML, DTD/custom entities, excessive depth/text, duplicate semantic elements/attributes, undeclared references and unexpected semantic constructs. Predefined/numeric character references remain valid literal text. Resolve package/workbook relationships, never assume sheet file indices. Only the exact eight visible contract sheets are accepted in arbitrary worksheet order; contract order controls error sorting only. All cells in every sheet are inspected, including hidden/filtered rows, out-of-range cells and structural sheets. Only absent/empty or literal shared/inline strings are accepted. Rich text is flattened to text without using formatted display values. Numbers, booleans, errors, native dates and formulas/cached formulas are rejected.

Allow harmless font/fill/width/wrap/freeze/filter metadata. Reject macros, external links/hyperlinks, DDE, connections, embedded objects, scripts, arbitrary defined names, merges in metadata/catalog/business sheets and data outside fixed columns. Current generator defines no static dropdown names: arbitrary names/rules are rejected unless they validate as internal static catalog ranges defined by the template contract. Guide text is never business data; it is inspected for unsafe constructs.

### Semantic and structural output

Verify exact headers/metadata/catalogs with TASK-8 verifier before trusting catalog codes or UUID mappings. Preserve original sheet/row/column for all cells. Apply trim then NFC; whitespace-only optional fields become null; retain leading zeros, apostrophes and literal placeholder strings. ISO dates use only `isIsoDateString` (1900–2100). Validate typed CCCD/CMND pairing/ASCII digits, supplied optional fields and canonical phone syntax; defer missing create-only phone/gender to TASK-10.

Validate case-sensitive temporary reference syntax and all duplicates, forward references, all duplicate sample-assay pairs, catalog codes/pairs and orphan rows. Do not deduplicate by name+DOB or resolve identity. Return `{ok:true,value}` with typed clients/samples/assignments and authenticated template claims, or `{ok:false,errors}` containing all independent errors, never both. Errors use stable codes, Vietnamese messages, null coordinates for workbook failures, related locations for duplicates, and deterministic sheet/row/column/code ordering. Do not echo raw identity/profile values or exception messages.

## Risks / Trade-offs

- ZIP subset rejects unusual valid packaging → fail closed; broaden only with explicit fixtures/review.
- Compression can fit huge XML in a small file → enforce actual inflation and retained-state budgets before allocation/retention.
- XML objects may consume more heap than text → conservative state accounting plus cell/depth/token ceilings; TASK-7 measures actual process memory/concurrency.
- No production policy selected here → no runtime upload acceptance claim or runnable production route is added.
- Parser errors can expose PII → fixed messages plus coordinates/temp references only; no logs or storage.

## Migration Plan

Source-only implementation and checks. No DB/migration/rollout in this workspace. TASK-10 consumes the in-memory interface; TASK-7 retains deployed app/proxy/resource acceptance.

## Open Questions

Root checkpoint review must confirm the explicit resource-policy interface and conservative allocation/deadline enforcement before implementation. Production resource values remain TASK-7 work, not a reopened business contract.

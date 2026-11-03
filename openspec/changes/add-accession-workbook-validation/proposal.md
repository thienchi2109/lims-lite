## Why

TASK-8 emits authenticated accession templates, but uploaded XLSX bytes remain hostile input. TASK-9 implements the approved #112/#113 contracts as a source-only, read-only parser before TASK-10 identity resolution and preview commitments.

## What Changes

- Bound original bytes, actual ZIP inflation, XML complexity, retained parser state, cells and elapsed time before returning any business structure.
- Validate exact eight-sheet v1 layout, literal text and authenticated metadata/catalogs with TASK-8 helpers.
- Validate structural rows and return typed in-memory rows or all Vietnamese errors with real Excel coordinates.
- Retain no workbook/payload in storage, cache or logs; perform no business writes or identity matching.

## Capabilities

### New Capabilities

- `accession-workbook-validation`: hostile XLSX validation and structural row parsing under the approved template contract.

### Modified Capabilities

None. TASK-8 authority and deferred acceptance remain unchanged.

## Impact

New server-only modules/tests under `src/lib/accession-workbook/`; reuse `accession-template` contract, verifier and size boundary, canonical ISO-date/phone validators. Existing installed `saxes` 6.0.0 becomes an explicit runtime dependency without package installation or version changes. Native `node:zlib` handles bounded inflation. No migration, RPC, RLS, audit mutation, route, deployment or production access. Errors are Vietnamese. TASK-7 retains actual runtime capacity/upload acceptance.

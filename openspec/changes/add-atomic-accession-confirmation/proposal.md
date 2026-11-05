## Why

TASK-10 seals an analyst-owned preview without business writes. TASK-11 must consume that commitment once, creating the entire accession batch and durable provenance atomically under the approved [#113 contract](../../../docs/superpowers/specs/2026-11-01-atomic-import-provenance-contract-design.md), without retaining the workbook or normalized payload.

## What Changes

- Add an immutable success receipt whose globally unique normalized-intent hash also serves as the durable successful import claim, plus protected row-to-entity mappings.
- Add a trusted server confirmation boundary and one database transaction that rechecks current authorization, source/intent/bindings, catalog and client authority before creating clients, samples and results.
- Retain safe terminal failures outside the business subtransaction and return the existing receipt for authorized same-batch repeats.
- Add focused source checks and rollback/concurrency/security SQL fixtures, with separately authorized home-server runtime gates.
- Apply the user's explicit current-schema method exception: imported result/mapping `method_id` is NULL; validate authoritative assay `method_name` against sealed text at creation without inventing a UUID or adding a durable method-text snapshot.

## Capabilities

### New Capabilities

- `atomic-accession-confirmation`: Confirm a sealed accession preview once, with atomic business writes, global successful-intent deduplication, immutable receipt/provenance, and current authorization.

### Modified Capabilities

None. Existing single-accession and canonical client-resolution contracts remain unchanged.

## Impact

New forward-only migrations extend the applied migration-234 preview boundary; migrations 233/234 remain byte-for-byte unchanged. New narrow server-only code reuses workbook validation, canonical intent, client resolver and keyed binding functions. RLS, grants, lifecycle/business audit, confidentiality and failure rollback require explicit verification. No dependencies, UI/localization changes, HTTP/status/recovery/purge endpoints, deployment or runtime operations are included. TASK-12/13 and TASK-7 keep their established ownership and acceptance gates.

## Why

TASK-8–12 provide the template, immutable preview and atomic confirmation/status contracts, but analysts cannot yet use that import flow from the Vietnamese accession screen. TASK-13 connects those boundaries in small reviewable sessions while preserving uncertainty, owner isolation and original-file verification.

## What Changes

- Add “Nhập từ Excel” beside the template download in `AccessionPageHeader` on `/analyst/accession`, retaining mobile wrapping and the walkthrough.
- Phase 1: select/cancel a workbook, enforce the strict decimal file ceiling, and show the complete Vietnamese preview, client resolution and actionable row errors.
- Phase 2: attest sample quality, confirm the immutable preview with identical original bytes, and show the committed receipt and authorized official identifiers.
- Phase 3: recover by batch status before retry, including response loss, refresh and missing-file cases, without replaying an uncertain import.
- Require an independent review stop after artifact preparation and each source phase. Browser/runtime acceptance is a separately authorized session; TASK-7 retains full capacity, atomicity and fault acceptance.

## Capabilities

### New Capabilities

- `vietnamese-accession-import-workflow`: Accessible Vietnamese browser workflow consuming the existing preview, confirmation, receipt and status contracts.

### Modified Capabilities

None. The approved template/atomic contracts and TASK-12 backend semantics remain authoritative.

## Impact

Future source changes are confined to accession UI, focused interaction tests and the existing `src/lib/api-client.ts` boundary as needed. Reuse repo components, pending states and query invalidation; add no dependency, count cap, duplicate `/samples` entry or second import engine.

The workflow must preserve server authorization/RLS, immutable audit/provenance and explicit quality attestation. It introduces no migration, audit rewrite or retention exception. Workbook bytes, preview client data and full row errors stay only in browser memory, with no durable browser cache or telemetry payloads. All user-visible copy is Vietnamese.

Checkpoint 0 creates artifacts only. TASK-12 acceptance is **ISOLATED ONLY**, not a production rollout; source/mocked UI checks cannot establish deployed browser acceptance. Official sample identifiers are not present in the current compact receipt response; Phase 2 must verify an existing authorized read path or stop with that concrete contract gap before expanding scope.

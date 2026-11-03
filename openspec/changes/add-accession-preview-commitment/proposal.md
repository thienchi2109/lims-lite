## Why

TASK-9 validates a versioned workbook but cannot yet produce a client-resolution plan that survives a server restart. TASK-10 implements the approved preview boundary from #112/#113 so TASK-11 can later confirm the same source bytes and normalized intent without retaining the workbook or full payload.

## What Changes

- Adapt validated workbook clients to the shared canonical resolver v2, canonical SQL normalization, conditional create fields, and same-batch identity guards.
- Implement `accession-intent-v1` nested graph serialization and SHA-256 with the approved golden vector and SQL/application parity fixtures.
- Add owner-bound durable preparation/preview commitments, controlled HMAC client bindings, immutable database timestamps, and a hard 30-minute logical expiry.
- Add an authenticated analyst-only preview API and browser mutation bridge with Vietnamese row errors and summaries; no official sample IDs or business writes.
- Separate source verification from authorized migration, security, restart, expiry, and owner-isolation runtime evidence.

## Capabilities

### New Capabilities

- `accession-preview-commitment`: Canonical read-only resolution, normalized intent hash, owner-bound durable preview lifecycle, and analyst-only preview API.

### Modified Capabilities

None. Existing canonical resolution and workbook contracts remain authoritative; the importer adapter consumes them.

## Impact

Source: `src/lib/accession-preview/`, narrowly extended shared client-resolution SQL/server boundaries, a new preview route, and `src/lib/api-client.ts`. Database changes use new forward-only migrations; historical migrations remain unchanged. Preview writes only safe batch/binding/lifecycle audit records, with owner-and-analyst authorization enforced by both application and database boundaries. Bindings contain keyed fingerprints rather than identity values; no source workbook, filename, normalized payload, raw errors, or PII enters durable logs.

No dependencies are added. TASK-11 owns atomic business writes and successful dedup claims; TASK-12 owns recovery/purge runners; TASK-13 owns the Vietnamese UI. TASK-7 remains the real stress/TTL/crash acceptance gate. TASK-8 authenticated download acceptance remains deferred. This source-only change does not authorize deployment or database execution.

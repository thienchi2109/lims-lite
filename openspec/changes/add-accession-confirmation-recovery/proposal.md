## Why

The atomic confirmation adapter has no authenticated HTTP caller, so analysts cannot confirm a preview or recover a receipt after a lost response. TASK-12 supplies that boundary and lock-aware recovery while preserving the approved no-retention, immutable-preview and atomic-import contracts.

## What Changes

- Phase 1: expose analyst owner-only confirmation and lock-aware status foundations through the existing request/session conventions; reupload identical original bytes, require explicit quality attestation and call the existing adapter once.
- Phase 2: complete durable status, unknown-before-retry and linked terminal-attempt behavior, including receipt retrieval without the workbook.
- Phase 3: recover abandoned preparation leases and physically purge expired transient commitments under locks, without replaying business writes or deleting durable provenance.
- Retain meaningful RED→GREEN checks, SQL/security fixtures and separate authorized runtime gates, including an isolated authenticated adapter smoke dependency for TASK-11.

## Capabilities

### New Capabilities

- `accession-confirmation-recovery`: authenticated confirmation transport, committed status/receipt lookup, safe retry, abandoned preparation recovery and lock-safe transient commitment purge.

### Modified Capabilities

None. TASK-9/10/11 parser, commitment, canonical identity and atomic confirmation guarantees remain authoritative.

## Impact

Touches API routes, narrowly reused preview transport/auth helpers, server-only status code and new forward-only SQL for a lock-aware status RPC; later phases add minimal recovery tooling using existing worker conventions. No new framework or dependency is planned. Vietnamese API messages are required; TASK-13 owns UI. DB role/owner/confidentiality checks, fixed search paths, least privileges, audit integrity and historical migration immutability remain mandatory. Physical deletion is restricted to contract-approved transient commitment/binding data; receipts, dedup claims, mappings, business entities and audit are retained. This source workspace performs no database, container, SSH, deployment or production fixture operation.

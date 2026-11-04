# Phase 2 SQL/application parity — PASS, 2026-11-04

User explicitly authorized running SQL parity. Root executed only the committed, rollback-only Phase 2 fixture; no migration application, application deployment or Phase 3 release occurred.

## Exact source and environment

- Source commit: `2fd0d5c752e1b1e1003914b50d0443655ff6ee96`.
- Fixture: `tests/accession-preview-canonicalization.sql`; SHA-256 `5458347bdbeb5305d6d9006f986796282b0558de1cd256f0e2ef01940272052c`. Local bytes were checked against `git show` before execution.
- Home server: `khoa-xn-cdc@100.93.19.42`, working directory `/opt/lims-lite`; PostgreSQL database `postgres`, version `15.1 (Ubuntu 15.1-1.pgdg20.04+1)`, encoding `UTF8`.
- Home checkout remained clean at `c7c68067dbc16102c22ef156ee0b7468204d340b`. Committed fixture bytes were streamed over SSH stdin, without copying source files or syncing the checkout.
- `lims-postgres` container `16b48329c4ca10d6cac542e5f59aec3a3fc278160705908ac6a90a12494448fe`; start time remained `2026-08-17T01:12:37.410886639Z` before/after.

## Execution and results

Read-only preflight at 08:39:54 UTC confirmed all three canonical normalizers and native `sha256(bytea)` exist. Phase 1 RPC `resolve_accession_preview_clients_v1(jsonb)` is absent; this fixture does not require it.

Equivalent replay command from the source workspace:

```bash
set -o pipefail
rtk proxy git show 2fd0d5c752e1b1e1003914b50d0443655ff6ee96:tests/accession-preview-canonicalization.sql |
  rtk proxy ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
    'cd /opt/lims-lite && sudo -n docker exec -i lims-postgres psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -At'
```

Actual execution used the same committed bytes through SSH/Docker/psql stdin and appended a read-only post-rollback catalog check in that connection. At **08:40:24 UTC**, psql exited **0** after three `CREATE FUNCTION` commands in `pg_temp`, the vector `DO` block, and explicit `ROLLBACK`. All **10 SQL assertions PASS**:

- Exact golden canonical bytes and SHA-256 `090da05ce3b97394845d98b5d3fde180f150b3d452b5f067155466859a4e908e`.
- Unicode/control escaping and UTF-8 order: exactly 239 bytes, SHA-256 `6ef396284f59ca65aa652936439faffc4406111fb34f3fa99de59a8bbfc72b5d`.
- Client permutation independence, nested assay/sample sorting, compact serialization, identical-sample multiplicity, changed client/sample edges, and canonical name/leading-zero identity normalization.

Root reran `rtk npm exec -- vitest run src/lib/accession-preview/intent.test.ts` at **08:40:49 UTC**: **24/24 PASS**. These application vectors and the independently executed SQL vectors agree on the fixed canonical bytes/hashes.

At **08:40:52 UTC**, existing deployed `run_security_tests()` returned **36/36 PASS, 0 failed**. This is the current deployed baseline, not coverage of the unapplied migration 233.

## Cleanup and limits

Post-rollback catalog checks found **0 session fixture helpers and 0 public fixture helpers**. The combined canonical-normalizer definition fingerprint stayed `0883202bed86ac5af2ddbb4379baefc1` before/after. The fixture performs no business-table DML; all inputs are synthetic constants. No source workbook/payload was processed or retained.

**PASS applies to the retained Phase 2 SQL/application vectors on this PostgreSQL baseline.** Phase 1 migration 233 and its behavioral/security fixtures remain unapplied/unexecuted. Durable commitments, TTL, preview API, restart/owner isolation, atomic confirmation and capacity/end-to-end acceptance remain open under their owning phases/tasks. TASK-10 stays In Progress/OPEN.

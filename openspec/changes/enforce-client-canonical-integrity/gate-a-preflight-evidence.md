# Gate A Preflight Evidence

## Scope

This evidence covers Gate A baseline preflight only. Gate B legacy-path
retirement, obsolete RPC removal, compatibility entry-point deletion, and
observation-window decisions are out of scope.

## Source And Database

- Source repository: `/root/lims-lite`
- Approved deployment checkout: `/opt/lims-lite`
- Source branch: `feat/enforce-client-canonical-integrity`
- Source commit: `ee4474165c774a511a669f18913a25e19d7fb6e3`
- Home-server checkout: `ee4474165c774a511a669f18913a25e19d7fb6e3`
- Database: `postgres` in Docker container `lims-postgres`
- Database timestamp: `2026-08-29 08:50:31.893132+00`
- Migration 230 SHA-256: `2cd5448f6be5ee19825f31b4d23e956f9ecd611bea3c2f378f1e1e9b1bbbcbcb`
- Migration 231: applied from the committed forward-only branch
- Migration 230 source file: unchanged and not reapplied

## Command

```bash
ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite && \
   sudo -n docker exec -i lims-postgres psql -U postgres -d postgres \
   -v ON_ERROR_STOP=1 < tests/client-canonical-integrity-preflight.sql"
```

## Non-PII Aggregates

| Check | Result |
| --- | ---: |
| `public.clients` rows | 64 |
| `public.samples` rows | 98 |
| `public.results` rows | 1526 |
| Canonical projection drift | 0 |
| Trusted typed-identity duplicate groups | 0 |
| Unresolved candidate pairs | 0 |
| Client RLS policies | 4 expected policies |
| Authenticated table `UPDATE` | denied |
| Authenticated table `DELETE` | denied |
| Authenticated table `TRUNCATE` | denied |
| Authenticated writable profile columns | 5 expected columns |
| Registered security tests | all passed |

## Catalog And Contract Assertions

- `clients_unique_identity` is absent.
- `clients_unique_trusted_government_identity` exists with the trusted,
  non-null identity predicate and covers active and inactive rows.
- `idx_clients_normalized_phone` and `idx_clients_normalized_name_dob` remain
  non-unique candidate indexes.
- `sync_samples_client_name` is enabled and uses
  `public.sync_client_name_snapshot()`.
- Resolver v2, lifecycle RPC, adjudication helper, cutover security test, and
  `run_security_tests()` signatures are present.
- Client RLS policy names and role boundaries match the post-230 contract.
- Resolver/lifecycle audit and fixed `search_path` metadata passed baseline
  checks.

## Caller Adoption

- `npm run test:run -- src/app/actions/clients.characterization.test.ts
  src/app/api/client-actions/client-resolution-shadow-handlers.test.ts
  tests/client-resolution-api-boundaries.test.ts
  tests/client-canonical-integrity-gate-migration.test.ts`: 33/33 tests passed.
- Static boundary checks prove `clients.ts` contains no direct `.upsert()` and
  no `onConflict: 'name,date_of_birth'`.
- `upsertClient()` and the compatibility shadow handler delegate to
  `resolveOrCreateClientV2`; the compatibility entry point remains present for
  observation.

## Result

**PASS.** The read-only Gate A preflight returned exit status `0` with
`gate-a-preflight passed` before migration 231. The preflight evidence was
captured at commit `ee4474165c774a511a669f18913a25e19d7fb6e3`; migration 231
was then committed and applied only through the approved Docker/psql path.

## Post-Apply Evidence

- Migration file: `231_enforce_client_canonical_integrity.sql`
- Apply commit: `478ed8310da7b9692213348a24fa097e9dca8508`
- Apply target: home-server Docker container `lims-postgres`, database
  `postgres`
- Apply result: exit status `0`, committed transaction
- Post-apply timestamp: `2026-08-29 09:03:33.260763+00`
- Post-apply aggregates: 64 clients, 98 samples, 1526 results
- `clients_canonical_projection_check`: present
- `clients_unique_identity`: absent
- `clients_unique_trusted_government_identity`: present
- `test_client_canonical_integrity_security()`: present and passed
- `run_security_tests()`: all registered tests passed
- Client RLS/ACL and fixed `search_path` checks: passed

## Rollback-Only Runtime Evidence

- `tests/client-canonical-integrity-gate.test.sql`: passed on the enforced
  database and ended with `ROLLBACK`.
- Coverage includes trusted identity conflict, normalized phone and
  name/date-of-birth conflicts, lifecycle audit success, `P1116` audit-failure
  rollback, and unchanged sample/result history.
- `tests/client-resolution-security.test.sql`: passed and ended with
  `ROLLBACK`.
- `tests/client-lifecycle-rpc.test.sql`: passed and ended with `ROLLBACK`.
- `tests/client-resolution-caller-cutover-concurrency.test.sql`: passed on
  `lims_phase6_rehearsal_20260823`; the two-session loser returned a stable
  conflict and did not mutate sample/result data.
- `tests/client-canonical-integrity-concurrency.test.sql`: passed on
  `lims_phase6_rehearsal_20260823`; two concurrent resolver calls for one
  trusted identity produced one created client, one matched result, one
  `CLIENT_CREATED_V2` audit event, and no duplicate client.

Migration 230 remains byte-for-byte unchanged with SHA-256
`2cd5448f6be5ee19825f31b4d23e956f9ecd611bea3c2f378f1e1e9b1bbbcbcb`. Gate B
legacy-path retirement remains intentionally open and was not implemented.

## Source Quality Gates

- Focused Vitest: 4 files, 33/33 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors; existing repository warnings remain.
- `npm run check:no-explicit-any`: passed.
- React Doctor: 97/100, 0 errors; repository-wide warnings remain outside this
  change.
- `openspec validate --all --strict`: 46 passed, 0 failed.
- Read-only auth health check: passed.

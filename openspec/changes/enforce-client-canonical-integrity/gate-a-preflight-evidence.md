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
- Migration 231 availability: unused in source and approved deployment checkout
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
`gate-a-preflight passed`. Migration 231 may proceed after this evidence is
committed and pushed. No migration was applied during preflight.

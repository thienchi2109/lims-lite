# Phase 1 Production Baseline

Observed through the approved SSH and Docker PostgreSQL path on
2026-08-22 at 02:18:25 UTC. The SQL transaction reported
`transaction_read_only = on`.

## Runtime

- PostgreSQL: `15.1 (Ubuntu 15.1-1.pgdg20.04+1)`
- `und-x-icu`: provider `i`, stored and actual ICU version `153.14`
- Database: `postgres`
- Home-server checkout before Phase 1 sync: `29b5cc48ca041a01d1c98190a617492b0e126ae6`
- Home-server branch: `main`, clean against its then-fetched `origin/main`
- Source `main` used for the Phase 1 branch:
  `ba15e09fe7bcd7d1f1efb795fe0eb4de938fa787`

## Characterization Evidence

The focused pre-migration suites lock the existing raw name/date-of-birth and
phone lookups, placeholder-phone rejection, legacy upsert overwrite/conflict
behavior, confidentiality filtering, role authorization, localized Vietnamese
errors, identity-QR classification, scanner behavior, and accession form
contracts:

- `src/app/actions/clients.characterization.test.ts`
- `src/app/api/client-actions/role-guard.client-characterization.test.ts`
- `src/app/actions/clients.confidentiality.test.ts`
- `src/lib/scanner/classify-scanner-payload.test.ts`
- `src/components/__tests__/qr-scanner.test.tsx`
- `src/components/__tests__/sample-accession-form.test.tsx`

Audit characterization is also locked by the read-only aggregate below, the
exact `audit_clients_changes` trigger baseline, and the rollback-only SQL suite
that verifies INSERT/UPDATE/DELETE audit actors after migration.

## Client Aggregate

| Metric | Count |
| --- | ---: |
| Clients | 63 |
| Valid 12-digit CCCD | 20 |
| Valid 9-digit CMND | 1 |
| Missing or untrusted government identity | 42 |
| `BACKFILL-*` identity | 25 |
| Placeholder phone `0000000000` | 27 |
| Missing or untrusted canonical phone | 27 |
| Normalized name and DOB collision groups / rows | 0 / 0 |
| Real normalized-phone collision groups / rows | 0 / 0 |
| Trusted typed identity collision groups / rows | 0 / 0 |
| Raw identity collision groups / rows | 2 / 5 |

The aggregate intentionally does not reveal collision values, client IDs,
names, dates of birth, phone numbers, or source rows.

## Audit Aggregate

| Metric | Count |
| --- | ---: |
| Client audit rows | 152 |
| Audited client UUIDs, including deleted rows | 66 |
| Insert / update / delete audit rows | 66 / 83 / 3 |
| Audit rows without `changed_by` | 115 |
| Current clients without any audit evidence | 0 |

The historical null-actor count is a pre-existing compliance risk. Phase 1
must preserve the audit trigger and must not rewrite historical audit rows.

## Sample Links

| Metric | Count |
| --- | ---: |
| Samples | 97 |
| Samples linked to clients | 97 |
| Distinct linked clients | 62 |
| Orphaned client links | 0 |
| Stale client-name snapshots | 0 |

## Schema Baseline

The `clients` table had 12 columns:
`id`, `id_card_num`, `name`, `date_of_birth`, `gender`, `phone`, `address`,
`health_insurance_num`, `expiry_date`, `created_at`, `updated_at`, and
`search_vector`.

Existing constraints included `clients_gender_check`,
`clients_phone_format_check`, `clients_pkey`, and
`clients_unique_identity`. Existing triggers were
`audit_clients_changes`, `clients_search_update`, and
`update_clients_updated_at`.

The four existing client policies were captured with their exact command,
permissiveness, roles, `USING`, and `WITH CHECK` expressions. The table ACL was
`postgres=arwdDxt`, `authenticated=arwdDxt`, `anon=r`, and `service_role=r`,
all granted by `postgres`. The broad authenticated ACL is pre-existing; Phase 1
preserves it and verifies effective RLS behavior rather than changing access.

The Phase 1 normalization functions, projection trigger function, and
normalized candidate indexes were absent. `run_security_tests()` was present.

## Operational Gap

The database does not expose the expected
`supabase_migrations.schema_migrations` relation. Migration provenance for this
phase therefore relies on the immutable committed SQL file, the pushed commit,
the home-server checkout commit used for apply, catalog verification, and the
captured `psql` apply output.

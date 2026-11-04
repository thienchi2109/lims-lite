# TASK-10 home-server DB gate — 2026-11-04

Status at 11:06 UTC: **PASS for the authorized DB gate**. Migrations 233 and 234 committed; corrected client-resolution and original commitment fixtures passed with rollback verified. Security remained **36/36 PASS** after each migration and at the final check. TASK-10 remains OPEN/In Progress. No application deployment, restart, configuration provisioning or Phase 4 release occurred.

## Authorization and provenance

The user authorized applying committed migrations 233 then 234, security tests after each, and retained rollback-only SQL fixtures. Root reviewed the read-only preflight and released this exact bounded sequence before the first write. Execution used SSH to `khoa-xn-cdc@100.93.19.42`, working directory `/opt/lims-lite`, and `sudo -n docker exec -i lims-postgres psql`; no local database or Supabase CLI/MCP was used.

Initial source commit: `715bd8fef8e50f09eaa15997b2ef229504adb14b`. All four artifact bytes matched `git show` before execution:

| Artifact | SHA-256 |
| --- | --- |
| `supabase/migrations/233_add_accession_preview_client_resolution.sql` | `fc895bc7c2ea1976b80f145263a3e8dd7d672fe443f29650905473c2741254dc` |
| `supabase/migrations/234_add_accession_preview_commitment.sql` | `a4bb16cb004da4799c3084734a02f3eb3fbbb5904311c5ee0661ac5ff0a9ff53` |
| Original `tests/accession-preview-clients.sql` | `cbfa75123888ea9775c691f9b6c7227aff84634cb92ff45f81d9dcc7078ae935` |
| Corrected `tests/accession-preview-clients.sql`, commit `d24e8e0526c139e517b079b7f7eb42ed0e0582fb` | `28f171fab870e6b9f716e1c23629b0958a649dd1d1ca6b55d72487f87e0c3b1a` |
| `tests/accession-preview-commitment.sql` | `d7ac5ffbe2464ef12520b0a119dc374a4ad4fec5fe2f9c70072a7b3af0fa250e` |

Home checkout stayed clean at `c7c68067dbc16102c22ef156ee0b7468204d340b`. Root approved streaming immutable committed blobs through stdin to preserve that checkout. Both applied migrations are now immutable; no migration SQL was edited.

## Baseline and transaction safety

- PostgreSQL `15.1 (Ubuntu 15.1-1.pgdg20.04+1)`; server/client encoding `UTF8`. Initial `run_security_tests()` returned **36/36 PASS**. No preview routines/tables existed.
- `lims-postgres`: container `16b48329c4ca10d6cac542e5f59aec3a3fc278160705908ac6a90a12494448fe`, started `2026-08-17T01:12:37.410886639Z`.
- `public.schema_migrations(version bigint, inserted_at timestamp)` contained 21 platform timestamp versions, range `20210706140551`–`20241106103258`, and no versions 200–240. `public.migrations(id,name,hash,executed_at)` contained 19 legacy storage entries. Neither tracks numbered repository migrations; no ledger entries were invented. Provenance is the commit, artifact hashes and resulting object definitions.
- 191 eligible non-confidential assay/sample pairs existed. Fixture identifiers, usernames/emails and `PREVIEW233-RESTRICTED` were absent. `samples.sample_quality` is Boolean; analyst receiver and published compatibility triggers were inspected.
- Fixture 233 inserts synthetic auth/users/clients/adjudication/sample/result rows and temporarily updates one existing assay's confidentiality. Existing audit, search, timestamp and compatibility triggers stay enabled. All these writes are transactional and bounded by explicit `BEGIN`/`ROLLBACK`; the assay import-code sequence trigger only runs on INSERT and is not invoked by that UPDATE.
- Fixture 234 inserts synthetic auth/users/preview/audit rows. Its seal path takes SHARE table locks on seven client/catalog tables; bounded fixture execution does not certify production contention. Its explicit rollback removed all synthetic preview state and audit rows.
- Migration sessions prefix `SET client_encoding='UTF8'; SET lock_timeout='3s'; SET statement_timeout='30s';`, then pass the unchanged SQL blob including its own `BEGIN`/`COMMIT`. Fixtures retain their `3s` lock and `30s` statement timeouts. `psql -X -v ON_ERROR_STOP=1` exits on error; closing the session rolls back the open fixture transaction.

Equivalent historical execution commands (shell `pipefail` required; **do not rerun applied migrations**):

```bash
set -o pipefail
{ printf '%s\n' "SET client_encoding='UTF8'; SET lock_timeout='3s'; SET statement_timeout='30s';";
  rtk proxy git show 715bd8fef8e50f09eaa15997b2ef229504adb14b:supabase/migrations/233_add_accession_preview_client_resolution.sql;
} | rtk proxy ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  'cd /opt/lims-lite && sudo -n docker exec -i lims-postgres psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -P pager=off'

rtk proxy git show 715bd8fef8e50f09eaa15997b2ef229504adb14b:tests/accession-preview-clients.sql |
  rtk proxy ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
    'cd /opt/lims-lite && sudo -n docker exec -i lims-postgres psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -P pager=off'

# Corrected fixture retry; migration 233 was not rerun.
rtk proxy git show d24e8e0526c139e517b079b7f7eb42ed0e0582fb:tests/accession-preview-clients.sql |
  rtk proxy ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
    'cd /opt/lims-lite && sudo -n docker exec -i lims-postgres psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -P pager=off'

# Only after corrected fixture 233 and cleanup passed.
{ printf '%s\n' "SET client_encoding='UTF8'; SET lock_timeout='3s'; SET statement_timeout='30s';";
  rtk proxy git show 715bd8fef8e50f09eaa15997b2ef229504adb14b:supabase/migrations/234_add_accession_preview_commitment.sql;
} | rtk proxy ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  'cd /opt/lims-lite && sudo -n docker exec -i lims-postgres psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -P pager=off'

{ printf '%s\n' "SET client_encoding='UTF8';";
  rtk proxy git show 715bd8fef8e50f09eaa15997b2ef229504adb14b:tests/accession-preview-commitment.sql;
} | rtk proxy ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  'cd /opt/lims-lite && sudo -n docker exec -i lims-postgres psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -P pager=off'
```

Actual execution loaded `git show` bytes, checked SHA-256 and supplied them to the same SSH/Docker/psql command through subprocess stdin. Read-only SQL was used for security, catalog and cleanup verification.

The independent security query after each committed migration was:

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SELECT count(*) FILTER (WHERE passed) AS passed,
       count(*) AS total, count(*) FILTER (WHERE NOT passed) AS failed
FROM public.run_security_tests();
COMMIT;
```

## Migration 233 and retained RED

- **11:00:49–11:00:50 UTC:** migration 233 exited **0**, explicit **COMMIT**. Its internal security verification completed.
- **11:01:01–11:01:02 UTC:** independent post-commit `run_security_tests()` returned **36/36 PASS, 0 failed**; `test_accession_preview_client_resolution_security()` returned true. The new check is composed into existing security coverage; the suite row count remains 36.
- Both new routines are owned by `postgres`, `SECURITY DEFINER`, `STABLE`, fixed `search_path=public, pg_temp`, with EXECUTE only for `postgres` and `authenticated`. Definition MD5: RPC `15adc21ad5552f6ce60bdf6dd69ba7e6`; security helper `5ca41c0210b45529357eb8466c74d4ba`.
- **11:01:23–11:01:26 UTC:** original committed fixture exited **3**: `permission denied for function normalize_client_name_v1`, inline DO line 88. It had switched to SQL role `authenticated`, then directly called private normalizers in its parity assertion. The preceding SECURITY DEFINER preview RPC returned; the assertion exceeded its own role permissions. No full behavioral PASS is claimed.
- Root assigned and independently reviewed a fixture-only correction: compute canonical expected name/phone as `postgres` before switching to `authenticated`, then compare stored expected values under that role. No helper grant was widened. Root committed it as `d24e8e0526c139e517b079b7f7eb42ed0e0582fb` and released the exact committed retry; root subsequently confirmed push success. Migration 233 was not rerun.
- **11:02:33 UTC:** `rtk npm exec -- vitest run tests/accession-preview-clients-migration.test.ts` — **3/3 PASS**; `git diff --check` passed. These are source checks, not a behavioral SQL GREEN.

## Verified rollback after RED

At **11:01:59–11:02:07 UTC**, a fresh read-only session exited 0:

| Count | Before | After failed fixture |
| --- | ---: | ---: |
| `auth.users` | 32 | 32 |
| `public.users` | 32 | 32 |
| `public.clients` | 64 | 64 |
| `public.samples` | 99 | 99 |
| `public.results` | 1527 | 1527 |
| `public.audit_logs` | 9460 | 9460 |

Synthetic auth/users/clients/samples/results/adjudications/audit rows: **0** in each category. Fixture helpers across namespaces: **0**. Assay confidentiality/timestamp MD5 returned to `4e1da891404d16d35b0770eec1f21ead`. Existing canonical/v2/adjudication definition MD5 stayed `40d735a13a1e4ed94eac7ceb47816001`; platform ledger MD5 stayed `f216984561ff8963a9f3df402a7feff7`; legacy storage ledger MD5 stayed `3528a84fa2a101bc936aff167e221298`. Authenticated EXECUTE on the name/phone normalizers remained false/false.

Security after RED: **36/36 PASS**, migration 233 security true, migration 234 tables absent. Home checkout and named database container ID/start time remained unchanged. No further mutation occurred until root reviewed the correction and explicitly released its committed retry.

## GREEN and migration 234

- **11:04:35–11:04:36 UTC:** corrected client-resolution fixture exited **0**, completed its DO block and explicit **ROLLBACK**. It passed **22 assertion invocations**, **five denied-role cases** and **six malformed-input cases**. Normalizer parity, canonical/v2 reuse and confirmed-distinct semantics, non-disclosure, duplicate/conflict grouping, validation, no business/audit writes by the read-only bridge and security were exercised. These are 20 assertion call sites; the three-row loop contributes two additional invocations.
- Its same-session cleanup found **0 helpers**, all six counts restored, **0 synthetic audit rows** and the original assay fingerprint. Security again returned **36/36 PASS**. Only then was migration 234 attempted.
- **11:04:53–11:04:55 UTC:** unchanged committed migration 234 exited **0**, explicit **COMMIT**; its internal security verification completed.
- **11:05:09–11:05:10 UTC:** independent post-commit security returned **36/36 PASS, 0 failed**, both preview security helpers true.
- **11:05:30–11:05:32 UTC:** original committed commitment fixture exited **0**, completed its DO block and explicit **ROLLBACK**. **35 assertion invocations PASS** from 33 call sites, including the manager/inactive and two client-drift loop expansions. Coverage includes forged browser role denial, service-context/current-analyst checks, owner isolation, write-once source, token/generation fences, partial graph rollback, client/catalog authority drift, DB-owned 30-minute deadline, early-expiry denial, past-deadline terminal handling, immutable seal/bindings, ready/terminal RLS, rejected-source metadata, expired preparation lease, safe audit and no business writes.
- Same-session cleanup: **0 helpers**, **0 preview batches**, **0 bindings**, **0 synthetic audit rows**, all six baseline counts unchanged.

## Final security, definitions and cleanup

At **11:06:10–11:06:11 UTC**, a fresh read-only session exited **0**. Security was **36/36 PASS, 0 failed**, and both new security helpers returned true. All six counts in the table above remained identical. Synthetic auth/users/clients/samples/results/adjudication/audit categories each contained **0 rows**; preview tables each contained **0 rows**; fixture helpers across namespaces were **0**. Assay, existing canonical/v2/adjudication and both ledger fingerprints remained identical to the baseline above. Both migration artifact SHA-256 values remained unchanged.

Both preview tables are owned by `postgres` with RLS enabled. Policies grant authenticated SELECT only to the active analyst owner; bindings additionally require `preview_ready` and `clock_timestamp() < expires_at`. Batch SELECT is restricted to approved columns; authenticated `lease_token` SELECT is false. Direct service-role SELECT/INSERT/UPDATE/DELETE on either table is false. Four lifecycle RPCs grant EXECUTE only to `postgres`/`service_role`; actor/mutation helpers grant it only to `postgres`; security helpers grant it to `postgres`/`authenticated`. All nine new routines are owned by `postgres`, SECURITY DEFINER, fixed `search_path=public, pg_temp`; **0 PUBLIC function ACL entries** exist. Private name/phone normalizer EXECUTE remains false for authenticated.

Catalog definition fingerprints:

| Definition | MD5 |
| --- | --- |
| `authorize_accession_preview_actor(uuid)` | `ff12a5a1c6bdca9f629f0e5b954b7c95` |
| `guard_accession_preview_mutation()` | `2c29c0a15f7186cae071d99b4575828a` |
| `start_accession_preview(uuid,uuid,integer,text)` | `64dcf217189fec28759d6adb9170cd52` |
| `heartbeat_accession_preview(uuid,uuid,uuid,bigint,text,bigint)` | `66bea231329e58e2e02b96ad068f13c2` |
| `finish_accession_preview(uuid,uuid,uuid,bigint,text,text)` | `c8cd244fb78c624570ad8bd9de2af822` |
| `seal_accession_preview(uuid,uuid,uuid,bigint,jsonb,jsonb,jsonb,text,jsonb)` | `5e5c98224dd09a60a560be4e5859a234` |
| `test_accession_preview_commitment_security()` | `1c9212004c907032e59b553039b1e092` |
| Nine preview routine definitions, ordered by regprocedure | `8baeab8c3a013af4027162360b5f9ee2` |
| Both preview policy definitions, ordered by table/policy | `e566160bbcf3a30118a95d767d09e2fd` |

Routine fingerprints use `md5(pg_get_functiondef(oid))`; the combined routine fingerprint uses newline-separated `regprocedure || ':' || definition`; the policy fingerprint uses newline-separated `tablename || ':' || policyname || ':' || qual` from `pg_policies`. MD5 here is a catalog comparison fingerprint, while immutable source provenance uses SHA-256.

The final home checkout was still clean at `c7c68067dbc16102c22ef156ee0b7468204d340b`; the named database container ID/start time were unchanged. No app image/container, PostgREST restart, configuration, key/policy provisioning or checkout sync occurred.

Root independently repeated a fresh SSH/Docker/psql read-only verification at approximately **11:07 UTC**, exit **0**, explicit **ROLLBACK**: security **36/36**, both preview security helpers true, preview tables empty, synthetic auth/users/clients/samples/results/audit empty, six counts unchanged, RPC 233 definition MD5 matched, private normalizers and lease token remained hidden, direct service table mutation denied, four exact lifecycle RPC grants/owners/search paths correct, and two RLS tables/two SELECT policies. The temporary replay artifact is `/tmp/lims-lite-task10-root-db-verify-2026-11-04.sql`; durable claims and fingerprints are recorded above. All DB mutations stopped after fixture 234's rollback.

## Remaining gates

Exact database-clock equality, concurrent heartbeat/recovery races, restart survival, authenticated application behavior, retention/full TTL acceptance, contention/capacity, TASK-11 atomic confirmation and TASK-12 runners remain open. No key ring or measured runtime policy was provisioned. TASK-10 remains OPEN/In Progress; Phase 4 remains unreleased; TASK-8 deferred gates remain deferred.

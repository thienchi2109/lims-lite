# Phase 4 runtime evidence — 2026-11-02 UTC

Status: **DEFERRED by user — 2026-11-03**. Source/review, SQL, deployed anonymous-denial and
synthetic runtime gates **PASS**; authenticated download and final exit review
remain unverified, with user verification deferred until later.
User authorized Phase 4 operations
in this session; root reviewed the concrete commands before runtime mutation.
All Docker/PostgreSQL operations below ran through BatchMode SSH on
`khoa-xn-cdc@100.93.19.42`, checkout `/opt/lims-lite`, with `sudo -n`.
No production containers ran in the source workspace.

## Reviewed source and rollback baseline

- Reviewed/pushed source: `9d9f193ebebfe2aee58b0a44fa7b7cde9d57e037`
  (`main`), including runtime-only Compose signing variables and bounded SQL
  fixture timeouts. Existing migration/Compose source checks: **12/12 PASS**.
- Home-server checkout was clean on `feat/enforce-client-canonical-integrity`,
  `478ed8310da7b9692213348a24fa097e9dca8508`. After fetch with the existing
  deploy key, ancestry and zero commits absent from target main were verified;
  switched to existing `main` and fast-forwarded, without reset. Old branch
  remains available.
- Original running app image:
  `sha256:577b29cea46c86b8c5c4ad6386c53d0b8ef00d1877a2ad77abeb735a185d66fc`,
  preserved as `lims-lite-app:task8-rollback-478ed8310da7`.
- Read-only public baseline: auth health **200**; template endpoint **404**.
  Snapshot RPC absent; catalog published revision **3**; internal catalog tables
  retain RLS and no authenticated/anonymous direct DML grants.

## Migration and SQL — PASS

Migration 232 applied once at **2026-11-02T09:32:29Z**, committed source file
`supabase/migrations/232_add_accession_template_snapshot.sql`, SHA-256
`74550b34c8bd99d6e8c7abf9edc2b468fdf0198b13ea7ee5108158c3bf80fbfe`:

```sh
cd /opt/lims-lite
sudo -n docker exec -i \
  -e PGOPTIONS='-c lock_timeout=5000 -c statement_timeout=60000' \
  lims-postgres psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 \
  < supabase/migrations/232_add_accession_template_snapshot.sql
```

Baseline/result assertions and **COMMIT PASS**. RPC is `SECURITY DEFINER`,
`STABLE`, pinned `search_path=public, pg_temp`; authenticated EXECUTE true,
anon/service_role false. Migration is now immutable; SQL fixes require a new
forward-only migration. Public migration ledgers belong to Supabase/Storage
and are not asserted as this repository's numbered-migration ledger.

At **2026-11-02T09:33:30Z**:

- `tests/accession-template-snapshot.test.sql` through the same Docker psql
  path, `ON_ERROR_STOP`, lock timeout **3s**, statement timeout **30s**:
  **PASS notice**, explicit **ROLLBACK**. Covers real analyst authority,
  manager/doctor/missing/deleted/anonymous/service-role denial, direct table
  denial, observed revision/code/UUID/generation/labels/methods/pairs, read-only
  business/audit counts, reversible generation/type/revision/empty-pair drift.
- `SELECT * FROM public.run_security_tests();` **36/36 PASS**. Root independently
  reran the aggregate and metadata checks: **36/36, all true**.
- Synthetic auth/profile/audit remaining rows: **0/0/0**; published revision
  remains **3**. No triggers/RLS disabled. Trigger bodies were inspected for
  external effects; audit writes roll back. PostgreSQL identity/sequence gaps
  remain possible after rolled-back audit inserts.
- `NOTIFY pgrst, 'reload schema';` succeeded; PostgREST was not restarted.
- Resulting `md5(pg_get_functiondef(...))`:
  `834c78b978cb629ea59a600f5d2c302a`.

An ancillary residue query initially referenced nonexistent `audit_logs.user_id`
after the fixture/security checks had passed. It was corrected to `changed_by`
and `record_id`, returning zero. No schema repair was required.

The existing fixture does **not** seed the complete removed/not-assignable/
stale-review/duplicate/orphan matrix or concurrent publication sessions. This
evidence does not claim those broader runtime proofs.

## Signing configuration and rollout

Signing config revision **`task8-v1`** was generated on the home server using
32 random bytes encoded as hex, appended to existing root-owned `.env` mode
**0600**, without outputting key material. `.dockerignore` excludes `.env`,
`.env.local`, `.env*.local`, and `.git`; signing keys are runtime variables,
never `NEXT_PUBLIC_*` or build arguments. No live key was removed for tests.

App-only `sudo -n docker compose -p lims-lite build app` completed **exit 0**;
compile, TypeScript, and **39/39** generated pages passed. Home-server build
log/exit marker: `/tmp/lims-task8-build-9d9f193.{log,exit}`.

```sh
sudo -n docker compose -p lims-lite up -d --no-deps --force-recreate app
# After app readiness, refresh nginx's app DNS mapping:
sudo -n docker compose -p lims-lite up -d --no-deps --force-recreate nginx
```

- New app image:
  `sha256:cfbce35a146782c2174a72b6c1325507dcc22e3bb388268f54fac3835ba70f38`.
- App started **2026-11-02T09:39:45.977735676Z**, **healthy**, UID **1001**,
  Node **v20.20.2**. Runtime signing ID and key shape verified without secrets.
- Nginx refreshed **2026-11-02T09:40:16.222818453Z**. No database, Storage,
  Tunnel, or unrelated service was recreated; no dependencies were changed.
- Actual app-internal and public-proxy `GET /api/accession/template`:
  **401**, JSON, **`Cache-Control: private, no-store`**. Public `/`,
  `/coa/access`, `/auth/v1/health`: **200/200/200**. This proves deployed
  authentication denial and error-response caching only.
- Final **09:41:39Z** inventory: all **23** other running services started
  before this Phase 4; app log error/failure lines **0**. Home checkout remains
  clean `main` at the reviewed SHA.

Compose emitted existing-volume ownership warnings for postgres/storage;
`--no-deps` kept those services running. No volume ownership/configuration was
changed. Original app image and old feature ref remain available for rollback;
no rollback was required. SQL changes remain additive and forward-only.

## Synthetic runtime key/restart/workbook checks — PASS

A secret-free verification harness was compiled from the reviewed source using
already installed TypeScript and Next's bundled webpack, with existing
`zod`/`xlsx`; `server-only` is a no-op only in this isolated harness. No package
was added. Source self-check **exit 0** is separate from the home-server run.

Retained workspace artifacts (synthetic signing fixtures only, no workbook):

| Artifact | SHA-256 |
| --- | --- |
| `/tmp/lims-task8-runtime-harness.cjs` | `607a8f2f4ec08b78295af56a4a8ebe7b1d29c9b345e0fb2375a708f225957c94` |
| `/tmp/lims-task8-runtime-bundle.cjs` | `4d4baa70b05373796a5b6f6975ad68c83e298e10f41ef206702de6b51f71852d` |
| `/tmp/lims-task8-runtime-stdin.cjs` | `2b5d4c49de29b578c69dad9eaaae3386ed1defb080b7eb84833be42c3e885ba3` |

At **2026-11-02 09:40 UTC**, ran against the new production app's actual Node
runtime with no workbook file or live configuration mutation:

```sh
rtk proxy ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  'sudo -n docker exec -i lims-app node' \
  < /tmp/lims-task8-runtime-stdin.cjs
```

**exit 0**: missing config/unknown active key/retired key fail closed; valid
metadata authenticates after independent fresh child-process restart with a
stripped environment; eight visible sheets, empty business rows, literal
business headers, string cells without formulas, XLSX round-trip binding with
lossless revision all pass. All catalogs/secrets in this check are synthetic.
The harness does not call HTTP, DB or Storage, or persist workbook bytes.

Root independently verified all three artifact SHA-256 hashes and reran the
stdin harness in the deployed app: **exit 0**, same synthetic summary. Root
also rechecked public auth health **200**, template **401/private, no-store**,
`/analyst/accession` **307 to /login**, app image, UID/Node/config ID (one key),
and clean home-server checkout. These are independent reruns of the stated
gates, not authenticated-download proof.

## Proof boundaries

No safe existing analyst credentials/session or browser automation session was
found in inspected home-server paths. Authentication and OTP were not bypassed.
Authenticated app/proxy XLSX download, successful-response `private, no-store`,
deployed no-retention, and user-visible success remain **INCOMPLETE** pending
the real authenticated check. Whole-importer DB/HTTP/end-to-end capacity,
atomicity and recovery remain TASK-7 after TASK-9–13.

OpenSpec tasks **4.1/4.2/4.3/4.5** complete; **4.4/4.6** remain open, overall
**17/19**. TASK-8 remains In Progress; TASK-9 was not promoted. Remaining gate:
use a legitimate analyst session with required OTP through the real app/proxy,
download the binary, inspect the actual workbook and signed/current authority,
verify success-response `private, no-store`, and verify no retained workbook or
business/Storage writes. Do not substitute forged cookies, service-role auth,
or the synthetic harness for that gate.

## User deferral — 2026-11-03

The user explicitly deferred the two remaining TASK-8 items and will perform
the manual verification later. Tasks **4.4/4.6** remain unchecked: the user
owns the authenticated download/no-retention check; final exit review awaits
that result. Do not continue requesting analyst credentials or a session.
This decision records **DEFERRED**, not PASS or completed acceptance: progress
remains **17/19**, TASK-8/#136 stays **In Progress/OPEN**. Existing runtime
evidence is unchanged; TASK-9 has not started.

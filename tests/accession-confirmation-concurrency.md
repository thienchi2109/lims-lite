# TASK-11 Phase 2 concurrency scenarios — NOT RUN

DISPOSABLE home-server database only, named `task11_disposable_*`, with migration
235 then recovery 238 and a published eligible pair. Historical 236 failed during
function compilation and rolled back; 238 supersedes 236/237 without editing them.
Do not execute 236/237 before or after 238. Provisioning that database is a
separately authorized operation. Run three postgres psql sessions A/B/C through
the approved home-server SSH/Docker path. Never use production `postgres` DB,
commit these transactions, disable guards/RLS/audit, or install production test hooks.
Use synthetic fixture data only. All setup is uncommitted and ends with ROLLBACK.

The SQL fixture separately tests actual catalog/method/client/confidentiality
drift rejection in rollback subtransactions. These sessions test real writer
contention and unchanged authority after writer rollback; they do not prove
committed drift, absence of every deadlock, Phase 3 atomic business success or
succeeded receipt lookup.

## B: prepare private uncommitted payload before starting A

From the checkout root in psql, run this once per scenario:

```sql
\set ON_ERROR_STOP on
\set confirmation_concurrency 1
\i tests/accession-confirmation-validation.sql
SET LOCAL application_name='task11-validator-B';
SET LOCAL lock_timeout='90s';
SET LOCAL statement_timeout='120s';
SELECT pg_backend_pid() AS validator_pid;
SELECT args->>'batch' AS batch_id, args->'snapshot'->>'revisionNumber' AS revision
FROM task11_confirmation_args;
```

The fixture's setup mode seeds its own preparing→ready batch/bindings through
existing guards, without the seal function's catalog/client locks. Only B reads
its uncommitted temporary `task11_confirmation_args`. No other session needs to
see B's actor, batch or payload. Keep B open; do not validate yet.

## A: one real writer per run

Run this common setup, followed by exactly one scenario below. A owns a separate
uncommitted actor, so it never depends on B's invisible actor:

```sql
BEGIN;
SET LOCAL application_name='task11-writer-A';
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF current_database() !~ '^task11_disposable_' THEN RAISE EXCEPTION 'disposable DB required'; END IF;
END; $$;
INSERT INTO auth.users(id,email)
VALUES('95610000-0000-4000-8000-000000000001','task11-writer@lims.local');
INSERT INTO public.users(id,username,full_name,role,email)
VALUES('95610000-0000-4000-8000-000000000001','task11_writer','Synthetic writer','manager','task11-writer@lims.local');
SELECT set_config('request.jwt.claims','{"sub":"95610000-0000-4000-8000-000000000001","role":"authenticated"}',true),
 set_config('request.jwt.claim.sub','95610000-0000-4000-8000-000000000001',true),
 set_config('request.jwt.claim.role','authenticated',true);
```

Creator 223: actual API, same absent identity as B. Its sorted canonical advisory
keys and clients RowExclusive lock remain held until A rolls back:

```sql
SELECT outcome,client_id,created FROM public.resolve_or_create_client_v2(
 'cccd','956000000001','Synthetic Confirmation236 Absent','2001-02-03'::DATE,
 'Nam','0398765432',NULL,NULL,NULL) \gset writer_
SELECT :'writer_outcome'='matched' AND :'writer_created'::BOOLEAN AS creator_created;
-- Require creator_created=true; otherwise abort this scenario and ROLLBACK.
```

Lifecycle 216: run the creator block first, then the current manager API. It
takes clients ShareRowExclusive before the client row lock:

```sql
SELECT public.deactivate_client_v1(:'writer_client_id'::UUID,
 (SELECT updated_at FROM public.clients WHERE id=:'writer_client_id'::UUID),
 'Synthetic TASK-11 lifecycle contention');
SELECT deleted_at IS NOT NULL AS lifecycle_inactive FROM public.clients
WHERE id=:'writer_client_id'::UUID;
-- Require lifecycle_inactive=true.
```

Catalog publisher: the current API is
`publish_assay_sample_type_catalog_revision(uuid,timestamptz,text)` (migration
208:1246); it takes advisory 208110, assay SHARE, sample-types SHARE, revision
FOR UPDATE, then changes revision rows. This bounded scenario takes its actual
revision write mode directly, avoiding unrelated clone/review prerequisites:

```sql
LOCK TABLE public.assay_definitions IN SHARE MODE;
LOCK TABLE public.sample_types IN SHARE MODE;
LOCK TABLE public.assay_sample_type_catalog_revisions IN ROW EXCLUSIVE MODE;
SELECT id FROM public.assay_sample_type_catalog_revisions WHERE status='published' FOR UPDATE;
```

This tests the relevant catalog lock intersection, not the publisher API's full
lock lifecycle. A separately authorized real publisher/single-accession rehearsal
remains INCOMPLETE. Current single-accession signatures are
`accession_and_assign_tests_v2(uuid,text,timestamptz,jsonb,uuid,boolean,bigint)`
and `create_sample_atomic_v2(uuid,text,timestamptz,uuid,uuid,boolean,bigint)`
(migration 211:397/312); `p_tests` uses `assayId` and optional `methodId`.

Confidential relationship writers: instead of creator/lifecycle/catalog, take
one mode per fresh run. These are exact DML conflict modes; actual relationship
and method mutations are covered in the rollback-only behavioral fixture:

```sql
LOCK TABLE public.samples IN ROW EXCLUSIVE MODE;
-- Repeat fresh run with results, then assay_definitions, in place of samples.
```

## B: invoke the validator while A holds its lock

```sql
SAVEPOINT task11_call;
SELECT public.validate_accession_confirmation_locked(
 (args->>'actor')::UUID,(args->>'batch')::UUID,TRUE,args->'workbook',args->'snapshot',
 args->'clients',args->'expected',args->>'canonical',args->>'bindings',args->'metadata') AS accepted_at
FROM task11_confirmation_args \gset
```

This must wait. Before releasing A, C checks the actual waiter and held modes:

```sql
SELECT a.application_name,a.pid,a.wait_event_type,a.wait_event,pg_blocking_pids(a.pid)
FROM pg_stat_activity a WHERE a.application_name IN ('task11-validator-B','task11-writer-A');
SELECT a.application_name,l.locktype,l.relation::REGCLASS,l.mode,l.granted
FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
WHERE a.application_name IN ('task11-validator-B','task11-writer-A')
ORDER BY a.application_name,l.locktype,l.relation,l.granted;
```

Require B's blocking PID array to include A, an ungranted relation lock at the
expected table/mode, and **no ungranted advisory lock for B** during creator
contention. Save only this PII-free evidence. A then runs `ROLLBACK;`.
B must complete successfully against its original not_found plan, without any
business/provenance mutation:

```sql
SELECT :'accepted_at'::TIMESTAMPTZ < b.expires_at AS accepted_before_expiry,
 b.state='preview_ready' AND b.finished_at IS NULL AS batch_unchanged,
 NOT EXISTS(SELECT 1 FROM public.accession_import_receipts r WHERE r.batch_id=b.id) AS no_receipt,
 NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id_card_num='956000000001') AS no_client
FROM public.accession_preview_batches b JOIN task11_confirmation_args t ON b.id=(t.args->>'batch')::UUID;
-- Require all four booleans TRUE. Business/audit count equality is asserted separately in the behavioral fixture.
ROLLBACK;
```

## Waiting across TTL and accepting before TTL

For the waiting case, in B after setup but before A starts, seed a second valid
immutable fixture with five seconds remaining and replace only its batch UUID:

```sql
UPDATE task11_confirmation_args SET args=jsonb_set(args,'{batch}',to_jsonb(
 pg_temp.seed_confirmation((args->>'actor')::UUID,args->'metadata',args->>'bindings',
 clock_timestamp()-INTERVAL '29 minutes 55 seconds')));
SELECT expires_at FROM public.accession_preview_batches b JOIN task11_confirmation_args t
ON b.id=(t.args->>'batch')::UUID;
```

A holds results RowExclusive before B's validator call. C confirms B waits on
results. After the printed expires_at passes, A rolls back. Require B to raise
`ACCESSION_CONFIRMATION_EXPIRED`; use `ROLLBACK TO SAVEPOINT task11_call;` then
assert batch still preview_ready, finished_at NULL, and no receipt; `ROLLBACK;`.
Equality (`now >= expires_at`) is source-checked; this does not deterministically
hit the exact microsecond and does not use a production clock failpoint.

For accepted-before-deadline, use a fresh near-expiry B setup and validate before
expiry while A is idle. Keep B's transaction open beyond the printed deadline;
the returned accepted_at must remain before expires_at. Run A's results lock
after B accepts and use C to confirm A waits on B; then B rolls back and A
unblocks. Phase 3 must separately prove fixed receipt/sample timestamps and
commit after the deadline. Phase 3 succeeded receipt/audit/atomicity cases remain
DEFERRED; Phase 2 persists no receipt time or official IDs.

Always finish A and B with `ROLLBACK;`, including after errors; C verifies both
application_name sessions are idle without an open transaction. Do not drop or
delete the disposable DB here; its lifecycle is separately authorized.

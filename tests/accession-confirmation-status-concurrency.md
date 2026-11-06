# Status lock/concurrency fixture — NOT RUN

Run only in a separately authorized home-server `task11_disposable_*` database with exact migrations 235→238→239→240. Never run in production. Authorization must cover synthetic actor/batch lifecycle and fault injection. Use the established actor/seed preparation in [atomic concurrency](accession-confirmation-atomic-concurrency.md) and [validation concurrency](accession-confirmation-concurrency.md); keep their disposable guard and cleanup rules. The single-session [status fixture](accession-confirmation-status.sql) rolls back all data and cannot by itself establish two-session behavior.

Two sessions must see a previously committed isolated owner/batch; uncommitted setup in Session A is invisible to Session B and cannot prove processing. Supply `actor_id` and `batch_id` psql variables from the explicitly approved disposable setup, never guess a live batch. Use request JWT role `service_role`, not an authenticated browser impersonation. Runtime polling/time budgets remain TASK-7 measurements, not fixed production settings in this fixture.

Session A locks an isolated preview_ready batch without changing its immutable deadline:

```sql
BEGIN;
DO $$ BEGIN
  IF current_database() !~ '^task11_disposable_' THEN RAISE EXCEPTION 'disposable DB required'; END IF;
END; $$;
SELECT id FROM public.accession_preview_batches
WHERE id=:'batch_id'::UUID AND owner_id=:'actor_id'::UUID FOR UPDATE;
-- Leave transaction open. For TTL test, the approved seed must already have a near deadline.
```

Session B performs only authorized status reads:

```sql
BEGIN;
DO $$ BEGIN
  IF current_database() !~ '^task11_disposable_' THEN RAISE EXCEPTION 'disposable DB required'; END IF;
END; $$;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT public.get_accession_import_status(:'actor_id'::UUID,:'batch_id'::UUID);
ROLLBACK;
```

Assert exact `{state: processing, batchId}` without entity IDs, receipt or expiry, including after the deadline passes. Repeat as wrong owner/manager/withdrawn-role actor while the lock remains held: require SQLSTATE42501, never processing. Test confidential committed bindings before the lock: a restricted analyst must receive the same denial without existence disclosure.

Then `ROLLBACK` Session A; repeat Session B and assert the actual committed preview_ready or DB-clock expired view. Snapshot batch and audit before/after to prove lookup did not write either. Repeat with a committed nonexistent batch ID: require42501, never processing.

For actual confirmation interleaving, use the existing atomic runbook's controlled precommit pause and confirm call, not this artificial lock as proof of accepted business work. During accepted work, require processing even across TTL; release and COMMIT Session A, then require the identical durable receipt in Session B without source. Inject disconnect before commit and after commit separately; reconcile batch/receipt/business/audit counts, never infer failure from HTTP timeout. Capture the exact observed revisions/results; these cases remain NOT RUN until executed under explicit authorization. Physical purge/worker races are Phase3/TASK7, not certified by this Phase1 fixture.

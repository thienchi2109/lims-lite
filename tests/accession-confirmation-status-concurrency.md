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

## Phase 2: accepted confirmation, lost response and linked-retry races — NOT RUN

Requires source migration **241** in addition to 240. Run the rollback-only
[linked retry fixture](accession-preview-retry.sql) separately for actual terminal
failed/rejected/expired, logical expiry, ready replacement, same-owner and parent
immutability assertions. Its single transaction proves neither commit visibility
nor concurrency. All scenarios below need fresh disposable setup S from the atomic
runbook; preserve the same actor and batch across sessions.

For an accepted confirmation pause, use the atomic runbook's transaction-local
`task11_pause_import` trigger and fixture-only advisory key 237990. Session B holds
that key while Session A calls the real atomic RPC. A separate observer must first
confirm A is waiting at that advisory lock **after** the business INSERT, rather
than a client/catalog/parent lock before acceptance. Do not add a production hook.

While A is paused, run this in B's existing transaction (which holds the advisory
key). Supply the approved psql actor/batch variables; never use a live batch:

```sql
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT set_config('test.retry_actor',:'actor_id',true);
SELECT set_config('test.retry_batch',:'batch_id',true);
DO $$
DECLARE v_actor UUID:=current_setting('test.retry_actor')::UUID;
    v_batch UUID:=current_setting('test.retry_batch')::UUID;
    v_before BIGINT; v_denied BOOLEAN:=FALSE; v_status JSONB;
BEGIN
    IF current_database() !~ '^task11_disposable_' THEN RAISE EXCEPTION 'disposable DB required'; END IF;
    v_status:=public.get_accession_import_status(v_actor,v_batch);
    IF v_status IS DISTINCT FROM jsonb_build_object('state','processing','batchId',v_batch) THEN
        RAISE EXCEPTION 'accepted work must expose processing only, no official IDs';
    END IF;
    IF EXISTS(SELECT 1 FROM public.accession_import_receipts WHERE batch_id=v_batch)
       OR EXISTS(SELECT 1 FROM public.accession_import_mappings WHERE batch_id=v_batch) THEN
        RAISE EXCEPTION 'uncommitted receipt or official mappings leaked';
    END IF;
    SELECT count(*) INTO v_before FROM public.accession_preview_batches WHERE retry_of=v_batch;
    BEGIN
        PERFORM public.start_accession_preview(v_actor,v_batch,60000,'synthetic-race-only');
    EXCEPTION WHEN SQLSTATE '55000' THEN v_denied:=TRUE; END;
    IF NOT v_denied OR (SELECT count(*) FROM public.accession_preview_batches WHERE retry_of=v_batch)<>v_before THEN
        RAISE EXCEPTION 'busy parent must not spawn a linked child';
    END IF;
END;
$$;
```

Repeat that read after the accepted batch's deadline passes: processing must remain
exact and retry must still allocate nothing. B then `ROLLBACK`s to release the
fixture pause; A completes successfully and `COMMIT`s. Discard A's returned response
to model a lost response; a subsequent file-free status call must return the one
durable receipt. In a new authorized C transaction, set actor/batch/service claims
as above and run:

```sql
DO $$
DECLARE v_actor UUID:=current_setting('test.retry_actor')::UUID;
    v_batch UUID:=current_setting('test.retry_batch')::UUID;
    v_status JSONB; v_count BIGINT; v_denied BOOLEAN:=FALSE;
BEGIN
    IF current_database() !~ '^task11_disposable_' THEN RAISE EXCEPTION 'disposable DB required'; END IF;
    v_status:=public.get_accession_import_status(v_actor,v_batch);
    IF v_status->>'state' IS DISTINCT FROM 'succeeded'
       OR v_status->'receipt'->>'batch_id' IS DISTINCT FROM v_batch::TEXT
       OR v_status->'receipt'->>'owner_id' IS DISTINCT FROM v_actor::TEXT
       OR (SELECT count(*) FROM public.accession_import_receipts WHERE batch_id=v_batch)<>1
       OR v_status IS DISTINCT FROM public.get_accession_import_status(v_actor,v_batch) THEN
        RAISE EXCEPTION 'lost response must reconcile to one stable durable receipt';
    END IF;
    SELECT count(*) INTO v_count FROM public.accession_preview_batches WHERE retry_of=v_batch;
    BEGIN
        PERFORM public.start_accession_preview(v_actor,v_batch,60000,'synthetic-race-only');
    EXCEPTION WHEN SQLSTATE '55000' THEN v_denied:=TRUE; END;
    IF NOT v_denied OR (SELECT count(*) FROM public.accession_preview_batches WHERE retry_of=v_batch)<>v_count THEN
        RAISE EXCEPTION 'committed success cannot produce a replacement attempt';
    END IF;
END;
$$;
ROLLBACK;
```

Use a separate fresh scenario for rollback before commit: let the paused RPC finish,
then `ROLLBACK` A instead of committing. C must see unlocked preview_ready, zero
receipts/mappings/business/audit additions relative to setup, and unchanged source
and commitment. Without the file, status works but confirmation performs no POST.
Explicitly selecting the identical original file permits a fresh GET then one POST;
explicit replacement permits a linked preview without altering the parent.

For the opposite lock direction, A calls `start_accession_preview` on unlocked
preview_ready and leaves its transaction open. B attempts confirmation: it must not
overtake A's parent lock while A's child is uncommitted. Roll A back and verify its
child and child audit disappear, parent source/commitment/state remain unchanged,
then allow B to finish. This establishes the status lock survives through INSERT.

Retain a separate authenticated HTTP fault-injection gate: interrupt the response
channel after dispatch while the RPC is paused, once before server commit and once
after observed commit. Browser cancellation must not cancel accepted DB work. Use
the SQL observer to determine commit/rollback and receipt/business/audit counts;
HTTP abort/error alone proves neither. Also reject wrong-owner/manager/withdrawn or
confidentiality-restricted retry callers while the parent is busy. Record exact
results and cleanup of synthetic rows/fixture trigger in the authorized disposable
environment. No Phase 3 recovery/purge execution is covered here.

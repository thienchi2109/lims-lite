# TASK-11 atomic races — SOURCE ONLY / NOT RUN

These same-batch and cross-batch scenarios retain concrete lock and outcome assertions.

Only a separately authorized home-server `task11_disposable_*` database with
migration 235 then recovery 238 and a published eligible catalog pair may run these
commands. No commands below ran in the source workspace. Original workbook,
descriptor and HMAC trust are application tests; the SQL handoff is synthetic.
Historical 236 failed during function compilation and rolled back; 238 supersedes
236/237 unchanged. Do not execute 236/237 before or after 238. A target already
containing any 236/237 helpers is unsupported by 238 and must fail its guard.
Start each scenario in a fresh disposable DB. Use postgres psql sessions S/A/B/C
through the approved home-server SSH/Docker path. No production database commands
are provided. Explicit setup/business COMMITs below persist **synthetic** actor,
sealed metadata/bindings and success history in that disposable DB; they require
the later runtime authorization. Never persist a full workbook/normalized payload.

## Shared setup S

```sql
\set ON_ERROR_STOP on
\set confirmation_concurrency 1
\i tests/accession-confirmation-validation.sql
SELECT args->>'batch' AS first_batch FROM task11_confirmation_args;
SELECT pg_temp.seed_confirmation((args->>'actor')::UUID,args->'metadata',args->>'bindings') AS second_batch
FROM task11_confirmation_args;
-- Copy only these two UUIDs to A/B. The temp payload is ON COMMIT DROP.
COMMIT;
```

This commits only synthetic users, sealed batch metadata/bindings and their safe
lifecycle audit. It calls no business confirmation. Both batches were sealed
while the same client was absent. The fixed fixture UUIDs/emails must not already
exist; setup failure is INCOMPLETE, never a reason to weaken validation.

## Reconstruct ephemeral handoff separately in A and B

Run in both sessions **before either confirms**:

```sql
\set ON_ERROR_STOP on
\set confirmation_concurrency 1
\set confirmation_shared_actors 1
\i tests/accession-confirmation-validation.sql
SET LOCAL lock_timeout='90s';
SET LOCAL statement_timeout='120s';
```

The fixture asserts the exact synthetic actor IDs/usernames/current roles, then
reconstructs its constant ephemeral workbook/snapshot/expected plan. Its unused
private batch is rolled back at the end. The full handoff stays in a session-local
temporary table, never in a committed public table or a payload file.

In A set `application_name='task11-atomic-A'`, in B use `task11-atomic-B`:

```sql
SET LOCAL application_name='task11-atomic-A';
UPDATE task11_confirmation_args SET args=jsonb_set(args,'{batch}',to_jsonb('PASTE_SHARED_BATCH_UUID'::TEXT));
CREATE FUNCTION pg_temp.confirm_atomic() RETURNS JSONB LANGUAGE sql AS $$
 SELECT public.confirm_accession_import((args->>'actor')::UUID,(args->>'batch')::UUID,TRUE,
  args->'workbook',args->'snapshot',args->'clients',args->'expected',args->>'canonical',args->>'bindings',args->'metadata',NULL)
 FROM task11_confirmation_args;
$$;
```

Replace the UUID literal explicitly with S's printed UUID for the scenario; no
other payload value changes. The original snapshot/binding/intent remains fixed.

## Same-batch race

Point A and B at `first_batch`. A runs `SELECT pg_temp.confirm_atomic();`, requires
`state=succeeded`, and keeps the transaction open. B then runs the same call and
must wait on the owned batch row. C captures the actual waiter/blocker:

```sql
SELECT application_name,pid,wait_event_type,wait_event,pg_blocking_pids(pid)
FROM pg_stat_activity WHERE application_name IN ('task11-atomic-A','task11-atomic-B');
SELECT a.application_name,l.locktype,l.relation::REGCLASS,l.mode,l.granted
FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
WHERE a.application_name IN ('task11-atomic-A','task11-atomic-B')
ORDER BY a.application_name,l.locktype,l.relation,l.granted;
```

Require B's blocking PID array to contain A. A runs `COMMIT;`. B must now return
the identical safe receipt, with no repeated entity/success audit. B verifies:

```sql
SELECT count(*)=1 AS one_receipt FROM public.accession_import_receipts;
SELECT count(*)=3 AS three_mappings FROM public.accession_import_mappings;
SELECT count(*)=1 AS one_success_audit FROM public.audit_logs
WHERE table_name='accession_preview_batches' AND new_values->>'state'='succeeded';
SELECT r.confirmation_received_at= s.received_at AND r.owner_id=s.received_by AS common_time_actor
FROM public.accession_import_receipts r JOIN public.accession_import_mappings m ON m.batch_id=r.batch_id AND m.kind='sample'
JOIN public.samples s ON s.id=m.sample_id;
ROLLBACK;
```

All booleans must be TRUE. Verify the three entity INSERT audit links/actor with
the exact success assertions in `accession-confirmation-atomic.sql`. A committed
once; B's unused private setup batch and changes were rolled back.

## Cross-batch race and client-creation drift

Fresh DB/setup. A uses `first_batch`; B uses `second_batch`. A confirms and holds
the transaction. B confirms while A holds clients/samples/results exclusion; C
requires B blocked by A on an expected table mode. After A `COMMIT;`, B must
return exactly `{state:failed,batchId:<second_batch>,reasonCode:ALREADY_IMPORTED}`.
It must not return AUTHORITY_CHANGED because the winner created the formerly
absent client, and it must disclose no winning receipt or identifiers. B checks:

```sql
SELECT b.state='failed' AND b.reason_code='ALREADY_IMPORTED' AS safe_loser,
 NOT EXISTS(SELECT 1 FROM public.accession_import_receipts r WHERE r.batch_id=b.id) AS no_loser_claim,
 NOT EXISTS(SELECT 1 FROM public.accession_import_mappings m WHERE m.batch_id=b.id) AS no_loser_mapping
FROM public.accession_preview_batches b JOIN task11_confirmation_args t ON b.id=(t.args->>'batch')::UUID;
SELECT count(*)=1 AS one_global_success FROM public.accession_import_receipts;
ROLLBACK;
```

Require all TRUE. A separate nonconcurrent fixture covers controlled adapter
preparation failure after this client-creation drift: it also returns only
ALREADY_IMPORTED. To cover actor independence, seed the second shared batch for
the fixture's other active synthetic actor, and set B's `args.actor` to that same
owner before calls; do not change the canonical intent or source graph.

## External writers and lock-time TTL

Reuse the concrete creator/lifecycle/catalog/relationship modes, exact writer
signatures and pg_locks assertions in `accession-confirmation-concurrency.md`.
Replace its private validator SELECT with `SELECT pg_temp.confirm_atomic();`.
Its direct publisher mode is a lock-intersection scenario; the full real
publisher/single-accession deadlock rehearsal remains INCOMPLETE.

The counter/single-accession inversion has this concrete retained scenario. Use
a fresh rollback-only setup from the Phase 2 external-writer runbook; B targets
its private batch and uses the atomic call above. In A run its synthetic actor
setup and creator block, then:

```sql
UPDATE public.users SET role='analyst' WHERE id='95610000-0000-4000-8000-000000000001';
SELECT public.generate_next_sample_id(); -- holds the date's counter row, no sample yet
```

Now B calls atomic confirmation. C must show B blocked by A on
sample_id_sequences ShareRowExclusive, with **no granted samples
ShareRowExclusive** lock for B. While B waits, A invokes the exact current 212
single-accession writer using its own uncommitted synthetic client:

```sql
WITH snapshot AS (SELECT public.get_accession_template_snapshot() AS value),
pair AS (SELECT value->'pairs'->0 AS value,snapshot.value->>'revisionNumber' AS revision FROM snapshot)
SELECT public.accession_and_assign_tests_v2(:'writer_client_id'::UUID,'Synthetic Confirmation236 Absent',clock_timestamp(),
 jsonb_build_array(jsonb_build_object('assayId',pair.value->>'assayDefinitionId','methodId',NULL)),
 (pair.value->>'sampleTypeId')::UUID,TRUE,pair.revision::BIGINT) FROM pair;
ROLLBACK;
```

A must finish its sample/result INSERT without waiting on B's sample lock; after
A rolls back, B must succeed against the original absent-client intent. B then
ROLLBACKs. A timeout/deadlock is a FAIL/INCOMPLETE runtime finding, never a passing
source claim. Repeat with B acquiring the counter exclusion first: A's generator
must wait before sample INSERT, then proceed after B rolls back. The added
counter-table lock globally serializes generators; capacity remains unmeasured.

For lock-time expiry, fresh setup S seeds `first_batch` with five seconds left:

```sql
-- Use this S seed instead of the original first batch; print its UUID, then COMMIT as above.
SELECT pg_temp.seed_confirmation((args->>'actor')::UUID,args->'metadata',args->>'bindings',
 clock_timestamp()-INTERVAL '29 minutes 55 seconds') AS first_batch FROM task11_confirmation_args;
```

A reconstructs handoff and targets that shared batch. B is now an external writer:
`BEGIN; SET LOCAL application_name='task11-atomic-B'; LOCK TABLE public.results IN ROW EXCLUSIVE MODE;`.
A calls confirmation before stored expires_at, C proves A waits on results, and
B releases with `ROLLBACK;` after expires_at. Require A result `expired/EXPIRED`,
no receipt/mappings/business rows for this attempt and exactly one safe expired
lifecycle audit. End A with `ROLLBACK;`. Exact equality is source-predicate
coverage; no production clock failpoint exists.

## Accepted before expiry, finishing afterward

Fresh near-expiry setup S. A reconstructs handoff and targets the shared batch.
Before calling, install this transaction-local test trigger in A:

```sql
CREATE FUNCTION pg_temp.pause_import() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM pg_advisory_xact_lock(237990); RETURN NEW; END;
$$;
CREATE TRIGGER task11_pause_import AFTER INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION pg_temp.pause_import();
```

B first runs `BEGIN; SELECT pg_advisory_xact_lock(237990);`. A then confirms.
C must show A blocked on the **fixture-only** advisory key after locked acceptance,
with a pending receipt and business INSERT still uncommitted (invisible to C).
Wait until the shared batch's expires_at passes, then B `ROLLBACK;`. A must succeed
and `COMMIT;`; C asserts receipt `confirmation_received_at < expires_at`, all sample
received_at values equal it, and batch finished_at >= expires_at. The test trigger
is created only inside A's disposable transaction; remove it afterward with
`DROP TRIGGER task11_pause_import ON public.clients;` in the disposable DB, then
close A so its pg_temp function cannot outlive the scenario. This is not a
production failpoint or a claim that runtime testing has occurred.

## Cleanup and evidence limits

ROLLBACK every open/error/loser/writer transaction. C checks `pg_stat_activity`
for these application names and requires no idle-in-transaction session. Success
and shared setup were explicitly committed in this disposable DB; never DELETE
immutable receipts/mappings or disable their guards to clean up. Retiring that
disposable database requires the separately authorized home-server disposal
operation. Record PII-free counts/states/lock modes/actor UUID comparisons only.
These commands do not establish browser delivery, runtime configuration,
capacity, retention, HTTP recovery or any Phase 4 acceptance until actually run.

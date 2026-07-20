# Phase 1 Live Baseline

Captured on July 20, 2026 through read-only SSH queries against the home-server
PostgreSQL container. No Supabase MCP or Supabase CLI access was used.

The baseline queries performed no mutation. The separate RED SQL contract was
executed through the same SSH boundary in a rollback-only transaction and left
no persistent data or schema changes.

## Source State

- Source workspace baseline: `eb3652f` on `main` before creating
  `feat/sample-quality-phase-1`.
- Home-server checkout: clean `main` at
  `b14a3b5f5fb311911e3502967875851a5d075722`.
- Latest numbered migration in both checkouts:
  `188_restore_coa_wall_clock_checker_composition.sql`.
- Next forward-only migration number: `189`.
- Existing numbered migrations are treated as immutable.

The live database has `public.schema_migrations`, not
`supabase_migrations.schema_migrations`. Its rows track upstream Supabase schema
versions rather than this repository's numbered migration sequence, so the next
application migration number is derived from the committed source sequence.

## Samples Table

- `public.samples` has 80 rows.
- `sample_quality` does not exist.
- Existing rows must remain `NULL` after the compatibility migration.
- No default or backfill is permitted.
- The baseline identity snapshot is all rows with
  `created_at <= 2026-07-20 05:22:46.703401+00`.
- The sorted baseline ID digest is
  `md5(string_agg(id::text, ',' ORDER BY id::text)) =
  f5fafc11baa361036083bcb4cfc7030a`.
- Schema regression coverage uses the timestamp, row count, and digest together
  so later rows cannot hide a backfill of any baseline sample.

## Accession RPCs

Current live signatures:

- `public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text)`
- `public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text)`

Both functions:

- Are owned by `postgres`.
- Use `SECURITY DEFINER`.
- Pin `search_path=public, extensions`.
- Reject callers whose resolved role is not `analyst`.
- Do not reference `sample_quality`.
- Grant `EXECUTE` only to `authenticated` and `postgres`.
- Do not grant `EXECUTE` to `PUBLIC` or `anon`.

## Samples Triggers

The live table has six non-internal triggers:

- `audit_samples_trigger` calling `trigger_audit_log`
- `samples_enforce_analyst_receiver` calling
  `enforce_analyst_sample_receiver`
- `samples_search_update` calling `update_search_vector_samples`
- `sync_samples_client_name` calling `sync_client_name_snapshot`
- `track_status_transitions` calling `track_sample_status_transitions`
- `update_samples_updated_at` calling `update_updated_at_column`

`trigger_audit_log()` serializes both `NEW` and `OLD` rows with `to_jsonb`, so a
new column is included automatically. The SQL regression test still verifies
the stored INSERT audit payload.

## Samples RLS

Current policies:

- `Analysts and managers can update samples`
- `Analysts can insert own samples`
- `Authenticated users can read samples`
- `Managers can delete samples`

The INSERT policy is scoped to `authenticated` and requires the caller role to
be `analyst` with `received_by = auth.uid()`. No Phase 1 evidence requires an
RLS policy change.

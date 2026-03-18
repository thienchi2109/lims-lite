# Worker 1 Spec Reviewer Prompt

You are reviewing Task 1 for spec compliance.

## What Was Requested

Task 1 owns only:
- `supabase/migrations/119_clear_rejection_on_resubmit.sql`

Required outcomes:
1. Re-submitting a previously rejected sample clears `rejection_reason`, `rejected_at`, and `rejected_by`.
2. The same re-submission still sets the sample back to `review`.
3. The migration backfills stale rejection metadata for existing `review` and `completed` rows only.
4. The migration includes a self-verification block that fails loudly if those stale rows remain after backfill.
5. The change preserves rejection history through `audit_logs`; it must not preserve history by leaving stale rejection fields on the live sample row.
6. No unrelated TypeScript or UI behavior should be added in this task.

## What Implementer Claims They Built

`IMPLEMENTER_REPORT`

## Critical Review Instructions

Do not trust the report. Read the migration file directly and compare it to the requested outcomes line by line.

Verify specifically:
- the RPC update really nulls all three rejection fields on the re-submit path
- the backfill really targets both `review` and `completed`
- the backfill does not accidentally touch other statuses
- the verification block is present and actually enforces the invariant
- the migration does not smuggle in unrelated behavior

## Report Format

- `✅ Spec compliant` if everything matches after code inspection
- `❌ Issues found:` with precise file references and the missing/extra behavior

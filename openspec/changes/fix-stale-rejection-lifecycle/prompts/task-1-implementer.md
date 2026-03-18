# Worker 1 Implementer Prompt

You are implementing Task 1: database migration and backfill for OpenSpec change `fix-stale-rejection-lifecycle`.

## Task Description

Own this write scope only:
- `supabase/migrations/119_clear_rejection_on_resubmit.sql`

You are not alone in the codebase. Do not revert unrelated edits, and do not expand your write scope without asking first.

Deliver exactly this work:
1. Create migration `119_clear_rejection_on_resubmit.sql`.
2. Update `submit_sample_for_review` so a successful re-submission clears `rejection_reason`, `rejected_at`, and `rejected_by` while setting `status = 'review'`.
3. Add one-time backfill SQL that clears stale rejection metadata on existing `review` and `completed` samples only.
4. Add migration-level regression protection for both statuses, using a self-verification block that fails loudly if stale rejection metadata remains after the backfill.
5. Preserve audit-trail integrity by relying on `audit_logs` for historical rejection events instead of keeping stale rejection data on the live sample row.

## Context

- Root bug: a sample can be rejected, re-submitted, then completed while old rejection metadata remains on the `samples` row.
- The migration updates behavior introduced by `supabase/migrations/118_analyst_esignature_submissions.sql`.
- Search indexing already derives from sample row updates; do not invent a second reindex mechanism unless existing repo patterns require it.
- No policy or RLS change is intended in this task.

## Acceptance Criteria

- Re-submission path clears all three rejection fields before the sample re-enters `review`.
- Backfill targets only `review` and `completed` rows with stale rejection metadata.
- The migration contains an explicit verification block that makes silent partial success unlikely.
- The migration does not change discard, approval, or UI behavior.

## Before You Begin

If you are unsure how to satisfy the regression-coverage requirement within the migration write scope, ask before adding new files or a new harness.

## Your Job

1. Implement only the task above.
2. Verify the migration logic as far as the environment allows.
3. Commit your work.
4. Self-review for safety, scope discipline, and correctness.
5. Report back.

## Report Format

- What you changed
- How you verified it
- Files changed
- Self-review findings
- Open questions or risks

# Fix Sample Rejection Data Lifecycle Bugs

Three confirmed bugs in the sample approval/rejection workflow cause stale rejection data to appear on completed samples, allow approval without proper status guard, and block discard after rejection.

> [!IMPORTANT]
> OpenSpec change proposal created at `openspec/changes/fix-stale-rejection-lifecycle/`.

## Proposed Changes

### Bug 1 (High): `approveResults()` missing sample status guard

#### [MODIFY] [results.ts](file:///e:/lims-lite/src/app/actions/results.ts)

**A) Add `review`-only guard** after line 248:

```diff
 const sampleIds = [...new Set(results.map((r: any) => r.sample_id))]
 if (sampleIds.length > 1) {
     return { error: 'All results must belong to the same sample' }
 }
+
+// Guard: only approve results for samples in review status
+const { data: sampleData } = await supabase
+    .from('samples')
+    .select('status')
+    .eq('id', sampleIds[0])
+    .single()
+
+if (!sampleData || sampleData.status !== 'review') {
+    return { error: 'Can only approve results for samples under review' }
+}
```

**B) Clear rejection fields when setting `completed`** (line 299-304):

```diff
 const newStatus = count === 0 ? 'completed' : 'review'

 await supabase
     .from('samples')
-    .update({ status: newStatus })
+    .update({
+        status: newStatus,
+        ...(newStatus === 'completed' ? {
+            rejection_reason: null,
+            rejected_at: null,
+            rejected_by: null,
+        } : {}),
+    })
     .eq('id', sampleIds[0])
```

**C) Clear rejection fields in `cancelApproval()`** (line 398-401):

```diff
 await supabase
     .from('samples')
-    .update({ status: 'in_progress' })
+    .update({
+        status: 'in_progress',
+        rejection_reason: null,
+        rejected_at: null,
+        rejected_by: null,
+    })
     .eq('id', sampleIds[0])
```

---

### Bug 2 (Medium): Stale rejection fields not cleared on re-submit

#### [NEW] [119_clear_rejection_on_resubmit.sql](file:///e:/lims-lite/supabase/migrations/119_clear_rejection_on_resubmit.sql)

Replace RPC Phase 5 to also clear rejection fields:

```sql
UPDATE public.samples
SET status = 'review',
    updated_at = NOW(),
    rejection_reason = NULL,
    rejected_at = NULL,
    rejected_by = NULL
WHERE id = p_sample_id;
```

**Backfill** (both `completed` and `review` samples):

```sql
UPDATE public.samples
SET rejection_reason = NULL, rejected_at = NULL, rejected_by = NULL
WHERE status IN ('completed', 'review')
  AND (
      rejection_reason IS NOT NULL
      OR rejected_at IS NOT NULL
      OR rejected_by IS NOT NULL
  );
```

#### [MODIFY] [sample-detail-panel.tsx](file:///e:/lims-lite/src/components/sample-detail-panel.tsx)

UI defense-in-depth at line 138:

```diff
-{sample.rejection_reason && (
+{sample.rejection_reason && ['in_progress', 'discarded'].includes(sample.status) && (
```

---

### Bug 3 (Low): `in_progress` not discardable

#### [MODIFY] [sample-approvals.ts](file:///e:/lims-lite/src/app/actions/sample-approvals.ts)

Lines 231-233:

```diff
-const discardableStatuses = ['received', 'assigned', 'review']
+const discardableStatuses = ['received', 'assigned', 'in_progress', 'review']
```

#### [MODIFY] [sample-list-table.tsx](file:///e:/lims-lite/src/components/sample-list-table.tsx)

Expose discard for managers on `in_progress` samples in the unified samples workspace:

```diff
-const canDiscard = permissions?.canDiscard &&
-    ['received', 'assigned'].includes(status)
+const canDiscard = permissions?.canDiscard &&
+    ['received', 'assigned', 'in_progress'].includes(status)
```

---

## Verification Plan

### TypeScript
```bash
npm run typecheck
```

### Post-Migration (when Docker available)
```powershell
Get-Content supabase\migrations\119_clear_rejection_on_resubmit.sql | docker exec -i lims-postgres psql -U postgres -d postgres
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT COUNT(*) FROM samples WHERE status IN ('completed','review') AND rejection_reason IS NOT NULL;"
```

### Manual Test
1. Reject → Re-submit → Approve → verify no banner on completed sample
2. Existing stale `review`/`completed` samples after backfill → no rejection banner, no stale search hit
3. Reject → Discard from `in_progress` in manager samples workspace → should succeed
4. Try approve on `in_progress` sample → should be blocked

## Dispatch Plan

This section is a task-assignment plan for a later `subagent-driven-development` execution pass. Do not dispatch sub-agents from this document immediately; use it as the source of truth for future task ownership, review order, and verification.

### Task 1: Database migration and backfill

**Owner**
- Worker 1

**Write scope**
- `supabase/migrations/119_clear_rejection_on_resubmit.sql`

**Goal**
- Update `submit_sample_for_review` to clear rejection fields on re-submit
- Backfill stale rejection fields for `review` and `completed` samples
- Add self-verification SQL proving no stale rejection metadata remains in those statuses after migration

**Verification**
- Migration file parses cleanly
- Self-verification block fails loudly if stale rows remain

### Task 2: Results approval/cancel backend guard

**Owner**
- Worker 2

**Write scope**
- `src/app/actions/results.ts`
- `src/app/actions/*.test.ts`

**Goal**
- Add `review`-only guard to `approveResults()`
- Clear rejection fields when `approveResults()` sets `completed`
- Clear rejection fields in `cancelApproval()` as defense-in-depth
- Add regression tests for blocked approval on non-review samples

**Verification**
- Targeted tests fail before change and pass after
- No existing approval/QC tests regress

### Task 3: Discard flow exposure and banner guard

**Owner**
- Worker 3

**Write scope**
- `src/app/actions/sample-approvals.ts`
- `src/app/actions/*.test.ts`
- `src/components/sample-detail-panel.tsx`
- `src/components/sample-list-table.tsx`
- `src/components/__tests__/*.test.tsx`

**Goal**
- Add `in_progress` to backend discardable statuses
- Hide rejection banner except for `in_progress` and `discarded`
- Expose discard action for `in_progress` samples in manager samples workspace
- Preserve review-page discard behavior as-is

**Verification**
- Action tests cover `discardSample()` status-gate acceptance and rejection paths
- Component tests cover banner visibility by status
- Manager samples workspace test covers discard visibility on `in_progress`

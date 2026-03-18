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
  AND rejection_reason IS NOT NULL;
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
2. Reject → Discard from `in_progress` → should succeed
3. Try approve on `in_progress` sample → should be blocked

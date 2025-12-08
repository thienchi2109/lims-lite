# Sample `updated_at` Timestamp Bug Fix

**Date:** December 8, 2025  
**Status:** ✅ Completed  
**Migration:** `037_update_sample_timestamp_on_result_change.sql`

## Problem

When analysts entered or updated test results in the results entry grid, the `samples.updated_at` timestamp was **not** being updated. This caused several UX issues:

1. **Invisible Activity:** Sample list showed outdated timestamps, making it appear as if no recent work had been done
2. **Sort Order Confusion:** Samples with recently updated results didn't appear at the top when sorted by "Last Updated"
3. **Misleading Information:** Managers couldn't easily see which samples had recent activity
4. **Audit Trail Gaps:** While audit logs tracked result changes, the sample record itself didn't reflect this activity

### Root Cause

The `samples` table's `updated_at` timestamp was only updated when the sample record itself was modified (e.g., status change, client info update). Changes to **related** records in the `results` table did not trigger an update to the parent sample's timestamp.

## Solution

### Phase 1: Database Trigger (Required)

Created a PostgreSQL trigger that automatically updates `samples.updated_at` whenever:
- A result is inserted (new test added)
- A result value or status is updated
- A result is deleted

**Migration:** `supabase/migrations/037_update_sample_timestamp_on_result_change.sql`

```sql
-- Trigger function
CREATE OR REPLACE FUNCTION update_sample_timestamp_on_result_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the parent sample's updated_at timestamp
    UPDATE public.samples
    SET updated_at = NOW()
    WHERE id = COALESCE(NEW.sample_id, OLD.sample_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to results table
CREATE TRIGGER update_sample_on_result_change
    AFTER INSERT OR UPDATE OR DELETE ON public.results
    FOR EACH ROW
    EXECUTE FUNCTION update_sample_timestamp_on_result_change();
```

**Security Impact:** Low
- SECURITY DEFINER allows the trigger to update samples even when RLS would normally prevent it
- This is safe because the trigger only updates timestamps, not critical data
- The change is logged in audit_logs via existing audit triggers

### Phase 2: Activity Feed Component (Optional Enhancement)

Created `src/components/sample-activity-feed.tsx` - a React component that displays a timeline of all changes to a sample and its related results.

**Features:**
- Real-time activity feed with 30-second auto-refresh
- Intelligent activity categorization (test added, result updated, status changed, etc.)
- Visual icons and color coding for different activity types
- Before/after change details for updates
- Vietnamese localization for all messages
- Relative timestamps (e.g., "2 phút trước")

**Usage Example:**
```tsx
import { SampleActivityFeed } from '@/components/sample-activity-feed'

<SampleActivityFeed sampleId={sample.id} />
```

## Verification

### 1. Trigger Installation
```bash
# Apply migration
Get-Content supabase\migrations\037_update_sample_timestamp_on_result_change.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# Verify trigger exists
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'results' AND trigger_name = 'update_sample_on_result_change';"
```

### 2. TypeScript Validation
```bash
npm run typecheck
# Should pass with no errors
```

### 3. Functional Testing

**Test Case 1: New Result Entry**
1. Open a sample in the results entry grid
2. Enter a new test result value
3. Save the result
4. ✅ Verify `samples.updated_at` is updated to current time
5. ✅ Verify sample appears at top of list when sorted by "Last Updated"

**Test Case 2: Result Update**
1. Open an existing result
2. Modify the result value
3. Save the change
4. ✅ Verify `samples.updated_at` reflects the modification time
5. ✅ Verify audit logs capture both result change AND sample timestamp update

**Test Case 3: Result Approval**
1. Manager approves a result
2. ✅ Verify `samples.updated_at` is updated
3. ✅ Verify sample moves to top of approval queue

## Database Query for Testing

```sql
-- Check sample timestamps before and after result changes
SELECT 
    s.sample_id,
    s.client_name,
    s.updated_at as sample_updated,
    r.id as result_id,
    r.value,
    r.updated_at as result_updated
FROM samples s
LEFT JOIN results r ON r.sample_id = s.id
WHERE s.sample_id = 'YOUR_SAMPLE_ID'
ORDER BY r.updated_at DESC;

-- View recent sample updates
SELECT 
    s.sample_id,
    s.updated_at,
    COUNT(r.id) as result_count
FROM samples s
LEFT JOIN results r ON r.sample_id = s.id
WHERE s.updated_at > NOW() - INTERVAL '1 hour'
GROUP BY s.id, s.sample_id, s.updated_at
ORDER BY s.updated_at DESC;
```

## Files Changed

### Created
- `supabase/migrations/037_update_sample_timestamp_on_result_change.sql` - Database trigger
- `src/components/sample-activity-feed.tsx` - Activity feed component
- `docs/fixes/20251208_sample_updated_at_bug_fix.md` - This documentation

## Impact

### Positive
- ✅ Sample list now shows accurate last activity time
- ✅ Improved visibility into sample workflow progress
- ✅ Better UX for analysts and managers
- ✅ Maintains proper audit trail
- ✅ No application code changes required (database-level fix)
- ✅ Optional activity feed provides detailed change history

### Considerations
- Trigger adds minimal overhead (single UPDATE per result change)
- Trigger uses SECURITY DEFINER to bypass RLS (safe for timestamp updates)
- Activity feed component requires `audit_logs` table access
- Activity feed auto-refreshes every 30 seconds (configurable)

## Related Issues

This fix addresses the root cause and provides comprehensive activity tracking. The activity feed component is optional but recommended for maximum visibility.

## Rollback Plan

If needed, the trigger can be removed:

```sql
-- Remove trigger
DROP TRIGGER IF EXISTS update_sample_on_result_change ON public.results;

-- Remove function
DROP FUNCTION IF EXISTS update_sample_timestamp_on_result_change();
```

**Note:** This will not affect existing data, only future result changes.

## Next Steps

### Recommended
1. Deploy migration to production
2. Monitor trigger performance
3. Consider adding activity feed to sample detail pages
4. Update user documentation to highlight real-time activity tracking

### Optional Enhancements
- Add activity feed to dashboard for system-wide activity view
- Add filtering/search to activity feed
- Export activity feed to PDF for compliance reports
- Add notifications for specific activity types

# Test Assignment Enhancement - Auto-Focus Feature

## Date
2025-12-05  

## Overview
Enhanced the test assignment feature to automatically display newly assigned samples at the top of the list and refocus on them after successful assignment.

## Changes Implemented

### 1. Backend - Already Existing
- ✅ `updated_at` column exists in the database (automatically updated via trigger)
- ✅ When `assignTests` is called, Supabase automatically updates `updated_at` timestamp

### 2. Frontend - Test Assignment Module
**File:** `src/components/test-assignment-module.tsx`

#### Added Feature:
- New optional prop `onRefocus?: (sampleId: string) => void`
- Callback is triggered after successful test assignment
- Passes the sampleId back to parent component for navigation

**Code Changes:**
```typescript
interface TestAssignmentModuleProps {
    sampleId: string
    onClose: () => void
    onSuccess: () => void
    onRefocus?: (sampleId: string) => void // New prop
}

// In handleConfirm after successful assignment:
if (onRefocus) {
    onRefocus(sampleId)
}
```

### 3. Frontend - Assigned Tests Panel
**File:** `src/components/assigned-tests-panel.tsx`

#### New Features:
1. **useRouter Hook**: Added from `next/navigation`
2. **handleRefocus Function**: Navigates with updated sort parameters
3. **URL Navigation**: Updates URL with:
   - `sortBy=updated_at`
   - `sortOrder=desc`
   - `sampleId={targetSampleId}`

### 4. Frontend - Sample List Table & Filters
**Files:** `src/components/sample-list-table.tsx`, `src/components/sample-filters.tsx`

#### New Features:
- **New Column**: Added "Ngày cập nhật" (`updated_at`) to the sample grid
- **Sorting**: Added sort support for `updated_at` in both the table header and filter dropdown
- **Visual Feedback**: Users can now see exactly when a sample was last modified

### 5. Backend - Sample Actions
**File:** `src/app/actions/samples.ts`

#### Logic Update:
- **Always Update**: The `assignTests` action now *always* performs an update on the sample record.
- **Status Change**: If status is 'received', it changes to 'assigned'.
- **Timestamp Update**: If status is already 'assigned', it explicitly updates `updated_at` to ensure the sample moves to the top of the list.

**Code Implementation:**
```typescript
import { useRouter } from 'next/navigation'

export function AssignedTestsPanel({ sampleId }: AssignedTestsPanelProps) {
    const router = useRouter()
    
    const handleRefocus = (targetSampleId: string) => {
        // Navigate to the samples page with updated_at sorting and the sample selected
        // This will make the newly assigned sample appear at the top of the list
        const params = new URLSearchParams({
            sortBy: 'updated_at',
            sortOrder: 'desc',
            sampleId: targetSampleId,
        })
        router.push(`?${params.toString()}`)
        router.refresh()
    }
    
    // Pass to TestAssignmentModule
    <TestAssignmentModule
        sampleId={sampleId}
        onClose={() => setShowAssignmentDialog(false)}
        onSuccess={() => { fetchTests() }}
        onRefocus={handleRefocus}  // New prop
    />
}
```

## User Experience Flow

### Before Enhancement:
1. User assigns tests to a sample
2. Dialog closes
3. **Sample stays in same position** in the list
4. User must manually search for the sample to verify

### After Enhancement:
1. User assigns tests to a sample
2. Dialog closes
3. **Sample jumps to the top** of the list (sorted by `updated_at DESC`)
4. **Sample is automatically selected** (right panel shows details)
5. User immediately sees the sample with newly assigned tests

## Technical Details

### Sorting Logic:
- **Default Sort**: Still uses `created_at DESC` (newest samples first)
- **After Assignment**: Automatically switches to `updated_at DESC`
- **Benefit**: Recently modified samples appear first

### URL Parameters:
```
Before: /analyst/samples?page=1&pageSize=10&sortBy=created_at&sortOrder=desc&sample Id=abc-123

After:  /analyst/samples?sortBy=updated_at&sortOrder=desc&sampleId=abc-123
```

### Database Trigger:
The `updated_at` column is automatically maintained by a database trigger:
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_samples_updated_at 
    BEFORE UPDATE ON public.samples
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

## Benefits

1. **Improved UX**: Users can immediately verify their action
2. **Time Saving**: No need to scroll or search for the updated sample
3. **Visual Feedback**: Clear indication that the assignment was successful
4. **Natural Workflow**: Sample appears at top = recently modified
5. **Maintains Context**: User stays focused on the sample they just modified

## Edge Cases Handled

1. **Multiple Rapid Assignments**: Each assignment updates `updated_at`, so most recent modification appears first
2. **Page Refresh**: URL parameters ensure state is preserved
3. **Navigation**: Router.refresh() ensures data is fresh from server
4. **Sorting Preferences**: User can still manually change sort order if desired

## Testing Checklist

- ✅ Assign tests to a sample with status "Đã nhận"
- ✅ Verify sample appears at top of list
- ✅ Verify sample is automatically selected
- ✅ Verify right panel shows updated test assignments
- ✅ Assign more tests to a sample with status "Đã chỉ định"
- ✅ Verify sample moves to top again
- ✅ Check URL updates correctly
- ✅ Test browser back button works correctly

## Files Modified

1. `src/components/test-assignment-module.tsx` - Added onRefocus prop
2. `src/components/assigned-tests-panel.tsx` - Added handleRefocus and navigation logic

## Performance Considerations

- **Minimal Impact**: Only one additional URL update and page refresh
- **Server-side Sorting**: Leverages existing database indexes on `updated_at`
- **No Extra Queries**: Uses existing data fetching logic

## Future Enhancements (Optional)

1. **Visual Animation**: Add a subtle highlight or fade effect when sample moves to top
2. **Toast Notification**: Show toast with "Sample updated and moved to top"
3. **Preference Storage**: Remember user's preferred sort order
4. **Smart Sorting**: Auto-switch to `updated_at` only for specific actions

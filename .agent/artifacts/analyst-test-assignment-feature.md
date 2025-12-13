# Analyst Test Assignment Feature

## Overview
Enabled analysts to assign tests to samples with status-based restrictions, while maintaining existing manager permissions.

## Implementation Date
2025-12-05

## Changes Made

### 1. Backend Permission Updates
**File:** `src/app/actions/samples.ts`

#### Modified Function: `assignTests`
- **Previous:** Only managers could assign tests at any time
- **Updated:** 
  - **Managers:** Can assign tests at any sample status (unrestricted)
  - **Analysts:** Can assign tests ONLY when sample status is:
    - `'received'` (Đã nhận) - First-time assignment
    - `'assigned'` (Đã chỉ định) - Adding more tests

#### Key Changes:
```typescript
// Role check now allows both analyst and manager
if (!userData || !['analyst', 'manager'].includes(userData.role)) {
    return { error: 'Không có quyền chỉ định xét nghiệm' }
}

// Analyst-specific status restrictions
if (userData.role === 'analyst') {
    const { data: sampleData } = await supabase
        .from('samples')
        .select('status')
        .eq('id', validatedData.sampleId)
        .single()
    
    if (!['received', 'assigned'].includes(sampleData.status)) {
        return { 
            error: 'Chỉ có thể chỉ định xét nghiệm khi mẫu ở trạng thái "Đã nhận" hoặc "Đã chỉ định"' 
        }
    }
}
```

#### Additional Improvement:
- Updated sample status transition logic
- Only update status from `'received'` to `'assigned'` (don't force status change if already assigned or beyond)

### 2. Frontend UI Updates
**File:** `src/components/assigned-tests-panel.tsx`

#### New Features:
1. **Status-Based Button Control:**
   - Added `canAssignTests()` function to check if assignment is allowed
   - Button is disabled when sample status is not `'received'` or `'assigned'`

2. **Helpful Tooltip:**
   - Displays explanation when button is disabled
   - Shows: "Chỉ có thể chỉ định xét nghiệm khi mẫu ở trạng thái 'Đã nhận' hoặc 'Đã chỉ định'"
   - Uses shadcn/ui Tooltip component for professional UX

3. **Visual Feedback:**
   - Disabled button has reduced opacity (50%)
   - Tooltip appears on hover to guide users

#### Code Added:
```typescript
// Check if test assignment is allowed
const canAssignTests = useCallback(() => {
    if (!sampleStatus) return false
    return ['received', 'assigned'].includes(sampleStatus)
}, [sampleStatus])

// Tooltip message
const getAssignmentTooltip = useCallback(() => {
    if (!sampleStatus) return 'Đang tải thông tin mẫu...'
    if (!canAssignTests()) {
        return 'Chỉ có thể chỉ định xét nghiệm khi mẫu ở trạng thái "Đã nhận" hoặc "Đã chỉ định"'
    }
    return 'Chỉ định thêm xét nghiệm'
}, [sampleStatus, canAssignTests])
```

### 3. Component Addition
**File:** `src/components/ui/tooltip.tsx`
- Added via `npx shadcn@latest add tooltip`
- Provides consistent tooltip styling across the application

## Status Mapping

| Status Code | Vietnamese Label | Analyst Can Assign? | Manager Can Assign? |
|-------------|------------------|---------------------|---------------------|
| `received` | Đã nhận | ✅ Yes | ✅ Yes |
| `assigned` | Đã chỉ định | ✅ Yes | ✅ Yes |
| `in_progress` | Đang thực hiện | ❌ No | ✅ Yes |
| `review` | Chờ duyệt | ❌ No | ✅ Yes |
| `completed` | Hoàn thành | ❌ No | ✅ Yes |

## User Experience Flow

### For Analysts:
1. Navigate to Samples page (`/analyst/samples`)
2. Select a sample from the list
3. Right panel shows "Chỉ định xét nghiệm" section
4. "Chỉ định" button behavior:
   - **Enabled** (when status is 'received' or 'assigned'):
     - Click to open test assignment dialog
     - Select tests and confirm
     - Tests are assigned successfully
   - **Disabled** (when status is 'in_progress', 'review', or 'completed'):
     - Button shows reduced opacity
     - Hover shows tooltip explaining the restriction
     - Cannot click the button

### For Managers:
- No change in functionality
- Can assign tests at any status (unrestricted)
- Same UI but button is always enabled

## Security Considerations

1. **Backend Enforcement:** Role and status checks happen on the server side, preventing bypass
2. **RLS Policies:** Existing Row Level Security policies remain in effect
3. **Audit Trail:** All test assignments are logged through existing audit mechanisms
4. **Input Validation:** Zod schema validation ensures data integrity

## Testing Recommendations

1. **Analyst User:**
   - ✅ Can assign tests when sample status is 'received'
   - ✅ Can assign tests when sample status is 'assigned'
   - ❌ Cannot assign tests when status is 'in_progress', 'review', or 'completed'
   - ✅ Sees helpful tooltip on disabled button

2. **Manager User:**
   - ✅ Can assign tests at any status (no restrictions)
   - ✅ Button always enabled

3. **Error Handling:**
   - ✅ Shows Vietnamese error message if backend restriction triggered
   - ✅ Toast notification on success/failure

## Files Modified

1. `src/app/actions/samples.ts` - Backend permission logic
2. `src/components/assigned-tests-panel.tsx` - Frontend UI and button control
3. `src/components/ui/tooltip.tsx` - New tooltip component (added)

## Deployment Notes

- ✅ Type checking passed
- ✅ No breaking changes to existing functionality
- ✅ Backward compatible with existing manager workflows
- ✅ All error messages are in Vietnamese per project requirements

# Business Logic Fix: Manager Discard Workflow

**Date**: 2025-12-08
**Issue**: Manager cannot reject/discard samples via quick action button in sample grid
**Root Cause**: Business logic mismatch between UI, permissions, and server actions

## Problem Analysis

### Original Incorrect Implementation
The commit `cc2e377` ("feat(approval): implement manager rejection/discard workflow") created:
- ✅ `RejectSampleDialog` - works for `review` status (approvals page)
- ✅ `DiscardSampleDialog` - works for `review` status (approvals page)
- ❌ Sample grid button using `canReject` permission for `received`/`assigned` status
- ❌ Button wired to `RejectSampleDialog` which only works for `review` status

### Business Logic Clarification

| Action | Location | Applicable Status | Result Status | Purpose |
|--------|----------|------------------|---------------|---------|
| **Reject** | Approvals page | `review` | `in_progress` | Send back for revision |
| **Discard** | Approvals page | `review` | `discarded` | Mark as unusable (permanent) |
| **Discard** | Sample grid | `received`, `assigned` | `discarded` | Soft delete early-stage samples |

## Changes Made

### 1. Server Action (`src/app/actions/samples.ts`)
**File**: `discardSample()` function (lines 741-756)

**Change**: Extended validation to allow discarding samples in early stages
```typescript
// BEFORE:
if (sample.status !== 'review') {
    return { error: 'Can only discard samples with status "review"' }
}

// AFTER:
const discardableStatuses = ['received', 'assigned', 'review']
if (!discardableStatuses.includes(sample.status)) {
    return { error: `Cannot discard samples with status "${sample.status}". Only received, assigned, or review samples can be discarded.` }
}
```

### 2. Sample Grid Component (`src/components/sample-list-table.tsx`)

**Changes**:
- Renamed permission: `canReject` → `canDiscard`
- Updated imports: `RejectSampleDialog` → `DiscardSampleDialog`
- Changed icon: `XCircle` → `Trash2`
- Updated button title: "Từ chối" → "Loại bỏ mẫu"
- Wired dialog correctly to `DiscardSampleDialog`
- Updated state variable names for clarity

**Interface Update**:
```typescript
permissions?: {
    canDiscard: boolean  // ← Changed from canReject/canIgnore
    canEdit: boolean
    canViewResults: boolean
    canEnterResults: boolean
}
```

**Button Logic**:
```typescript
const canDiscard = permissions?.canDiscard &&
    ['received', 'assigned'].includes(status)

{canDiscard && (
    <Button onClick={() => {
        setSelectedSampleForDiscard(row.original.id)
        setDiscardDialogOpen(true)
    }}>
        <Trash2 />
    </Button>
)}
```

**Editable Cell Fix** (line 167):
Fixed critical bug in client_name editable cell logic:
```typescript
// BEFORE (Wrong - used AND instead of OR):
disabled={!permissions?.canEdit && row.original.status !== 'received'}

// AFTER (Correct - only 'received' samples are editable):
disabled={!permissions?.canEdit || row.original.status !== 'received'}
```

This ensures:
- ✅ Only samples with status `'received'` can be edited
- ✅ `'discarded'` samples are always read-only (included in !== 'received')
- ✅ All other statuses (`'assigned'`, `'in_progress'`, `'review'`, `'completed'`) are read-only

### 3. Page Component (`src/app/samples/page.tsx`)

**Change**: Updated permissions object
```typescript
const permissions = {
    canDiscard: role === 'manager',  // ← Changed
    canEdit: true,
    canViewResults: true,
    canEnterResults: role === 'analyst',
}
```

### 4. Client Components

**Updated Files**:
- `src/components/samples-page-client.tsx` - Interface updated
- `src/components/sample-bottom-row.tsx` - Interface updated
- Added `'discarded'` to `validStatuses` array for server-side filtering

### 5. Status Badge (`src/components/sample-status-badge.tsx`)

**Status**: Already implemented (lines 42-46)
```typescript
discarded: {
    label: 'Loại bỏ',
    className: 'bg-red-50 text-red-700 border-red-200 ...'
}
```

### 6. Status Filter (`src/components/sample-filters.tsx`)

**Change**: Added 'discarded' to filter options
```typescript
const statusOptions = [
    // ... other statuses
    { value: 'discarded', label: 'Loại bỏ', color: 'bg-red-500' },
]
```

## Verification

✅ Type check passed successfully
✅ Server action accepts `received`, `assigned`, and `review` statuses
✅ Sample grid uses correct dialog and permissions
✅ Status badge displays with red color
✅ Status filter includes 'discarded' option
✅ Permissions properly renamed throughout codebase

## Testing Checklist

### Manager Role
- [ ] Can see Discard button (trash icon) on samples with status `received`
- [ ] Can see Discard button on samples with status `assigned`
- [ ] Cannot see Discard button on samples with other statuses
- [ ] Clicking Discard opens `DiscardSampleDialog` 
- [ ] Entering reason and confirming changes status to `discarded`
- [ ] Discarded samples show red badge "Loại bỏ"
- [ ] Can filter by "Loại bỏ" status in status dropdown
- [ ] Approvals page: Can Reject (review → in_progress) or Discard (review → discarded)
- [ ] **Editable Cell**: Can edit "Tên khách hàng" ONLY for `received` samples
- [ ] **Editable Cell**: Cannot edit "Tên khách hàng" for `discarded` samples
- [ ] **Editable Cell**: Cannot edit "Tên khách hàng" for other statuses (`assigned`, `in_progress`, `review`, `completed`)

### Analyst Role
- [ ] Cannot see Discard button at all (permission denied)
- [ ] Can view samples with `discarded` status (read-only)
- [ ] **Editable Cell**: Can edit "Tên khách hàng" ONLY for `received` samples
- [ ] **Editable Cell**: Cannot edit "Tên khách hàng" for `discarded` samples

## Database Impact

No migration needed - `discarded` status and related columns already exist from commit `cc2e377`:
- Migration `033_add_discarded_status.sql` - Added status value
- Migration `034_add_rejection_columns.sql` - Added tracking columns
- Sample columns: `rejection_reason`, `rejected_at`, `rejected_by`

## Compliance Notes

✅ **21 CFR Part 11 Compliant**:
- Discard action is audited (tracked via `rejected_at`, `rejected_by`)
- Reason is mandatory (`rejection_reason`)
- Status change is permanent (cannot undo discard)
- All changes logged in `audit_logs` via database triggers

# E-Signature Notice in Approval Dialog

**Date:** 2025-12-25
**Feature:** Add e-signature notice to manager approval confirmation dialog

## Overview

Add a prominent notice in the approval confirmation dialog to inform managers that their electronic signature will be applied directly to the Certificate of Analysis (CoA) when they approve review samples.

## Design Decisions

### 1. Placement
**Selected:** Above the note field, between description and textarea

**Rationale:**
- Natural reading flow after main description
- Visible before form interaction
- Doesn't clutter header but remains prominent

### 2. Visual Style
**Selected:** Info style (blue) - Calm, informative background with info icon (ℹ️)

**Rationale:**
- Professional and informative tone
- Not overly alarming
- Clear visual distinction from other content

### 3. Display Logic
**Selected:** Show with signature validation

**Behavior:**
- When approve dialog opens, check if manager has active signature
- **If signature exists:** Show blue info notice with message
- **If no signature:** Show warning alert and guide to upload signature
  - Block approval OR warn strongly (TBD during implementation)

**Rationale:**
- Ensures compliance - can't approve without valid signature
- Clear feedback if signature missing
- Prevents approval flow failures during CoA generation

## Vietnamese Message

**Info notice (signature exists):**
```
"Sau khi duyệt mẫu này, chữ ký điện tử của bạn sẽ được ký trực tiếp vào Phiếu kết quả Xét nghiệm của mẫu này!"
```

**Warning notice (no signature):**
```
"Bạn chưa có chữ ký điện tử! Vui lòng tải lên chữ ký trước khi phê duyệt kết quả."
```

## Implementation Approach

### 1. Component Changes

**File:** `src/components/approval-dialog.tsx`

**Changes:**
1. Add signature validation check when dialog opens
2. Use `getActiveSignature()` server action to check signature status
3. Add conditional info/warning alert component
4. Display appropriate message based on signature status

### 2. UI Components

**Info Alert (signature exists):**
- Blue background (`bg-blue-50 border-blue-200`)
- Info icon (lucide-react `Info`)
- Vietnamese message
- Positioned above textarea field

**Warning Alert (no signature):**
- Amber/yellow background (`bg-amber-50 border-amber-200`)
- Alert triangle icon (lucide-react `AlertTriangle`)
- Vietnamese warning message
- Link/button to navigate to signature upload
- Optional: Disable approval button when no signature

### 3. Server Action Integration

**Import:** `getActiveSignature` from `@/app/actions/signatures`

**Usage:**
```typescript
const [hasSignature, setHasSignature] = useState<boolean | null>(null)

useEffect(() => {
  async function checkSignature() {
    const result = await getActiveSignature()
    setHasSignature(result.success)
  }
  if (open && mode === 'approve') {
    checkSignature()
  }
}, [open, mode])
```

### 4. Conditional Rendering

```tsx
{mode === 'approve' && hasSignature !== null && (
  <div className="space-y-2">
    {hasSignature ? (
      <Alert variant="info">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Sau khi duyệt mẫu này, chữ ký điện tử của bạn sẽ được ký trực tiếp vào Phiếu kết quả Xét nghiệm của mẫu này!
        </AlertDescription>
      </Alert>
    ) : (
      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Bạn chưa có chữ ký điện tử! Vui lòng tải lên chữ ký trước khi phê duyệt kết quả.
        </AlertDescription>
      </Alert>
    )}
  </div>
)}
```

## Testing Checklist

- [ ] Manager with active signature sees blue info notice
- [ ] Manager without signature sees amber warning
- [ ] Notice only appears in "approve" mode (not "cancel")
- [ ] Vietnamese message displays correctly
- [ ] Visual styling matches design (blue info box)
- [ ] Notice positioned correctly above note field
- [ ] Approval flow works normally with signature
- [ ] Appropriate handling when no signature (warn/block)

## Future Enhancements

- Add direct link to signature upload page in warning alert
- Show signature preview thumbnail in info notice
- Cache signature check result to avoid repeated API calls
- Add signature validity date/status information

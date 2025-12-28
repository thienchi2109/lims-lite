# CoA Generation Tour Design

**Date:** 2025-12-28
**Status:** Approved

## Overview

Add a separate walkthrough tour for CoA (Certificate of Analysis) generation. The tour teaches both Analyst and Manager roles how to generate and view CoA for completed samples.

## Design Decisions

1. **Separate tour** - Not extending existing tours because CoA is only available when `sampleStatus === 'completed'`, which is a different workflow stage than results entry or approval.

2. **Single tour for both roles** - Analyst and Manager use the same `AssignedTestsToolbar` component with identical CoA buttons. One tour serves both.

3. **Conditional help button** - The existing `WalkthroughTrigger` in toolbar switches between "results" tour (when editable) and "coa" tour (when completed).

4. **Action-focused** - 2 steps only, focusing on the generate and view actions.

## Tour Definition

**Tour ID:** `coa`
**Target pages:** `/samples` (Analyst), `/manager/approvals?tab=completed` (Manager)
**Target users:** Analyst, Manager
**Steps:** 2

| Step | Element ID | Title | Description |
|------|------------|-------|-------------|
| 1 | `#tour-coa-generate` | Tạo giấy chứng nhận | Bấm để tạo CoA cho mẫu đã hoàn thành. Nếu tạo thất bại, bấm "Tạo lại CoA" để thử lại. |
| 2 | `#tour-coa-view` | Xem phiếu kết quả | Sau khi tạo thành công, bấm để mở phiếu kết quả xét nghiệm. Một cửa sổ trình duyệt mới hiện ra, bạn có thể nhấn Ctrl+P để in kết quả này hoặc lưu dưới dạng PDF. Sau đó có thể gửi cho khách hàng và lưu trữ nội bộ. |

**Database column:** `tour_coa_completed_at`

## Files to Create

### `src/components/walkthrough/tours/coa-tour.ts`

```typescript
import type { DriveStep } from 'driver.js'

export const coaTourSteps: DriveStep[] = [
    {
        element: '#tour-coa-generate',
        popover: {
            title: 'Tạo giấy chứng nhận',
            description: 'Bấm để tạo CoA cho mẫu đã hoàn thành. Nếu tạo thất bại, bấm "Tạo lại CoA" để thử lại.',
            side: 'bottom',
            align: 'center',
        },
    },
    {
        element: '#tour-coa-view',
        popover: {
            title: 'Xem phiếu kết quả',
            description: 'Sau khi tạo thành công, bấm để mở phiếu kết quả xét nghiệm. Một cửa sổ trình duyệt mới hiện ra, bạn có thể nhấn Ctrl+P để in kết quả này hoặc lưu dưới dạng PDF. Sau đó có thể gửi cho khách hàng và lưu trữ nội bộ.',
            side: 'bottom',
            align: 'center',
        },
    },
]
```

### `supabase/migrations/101_add_coa_tour_column.sql`

```sql
-- Migration: Add CoA tour tracking column
-- Purpose: Track completion of CoA generation walkthrough per user

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tour_coa_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN users.tour_coa_completed_at IS
  'Timestamp when user completed the CoA generation walkthrough';
```

## Files to Modify

### `src/components/walkthrough/use-walkthrough.ts`

Add `'coa'` to the `TourId` type union:

```typescript
export type TourId = 'accession' | 'results' | 'approval' | 'coa'
```

### `src/components/walkthrough/walkthrough-provider.tsx`

1. Import coa tour:
```typescript
import { coaTourSteps } from './tours/coa-tour'
```

2. Add case to `getTourSteps()`:
```typescript
case 'coa':
    return coaTourSteps
```

### `src/components/assigned-tests-toolbar.tsx`

1. Add tour element IDs to CoA buttons:
```typescript
// On "Tạo CoA" / "Tạo lại CoA" button (around line 77)
id="tour-coa-generate"

// On "Xem phiếu KQ" button (around line 95)
id="tour-coa-view"
```

2. Change WalkthroughTrigger to be conditional:
```typescript
// Replace line 58:
<WalkthroughTrigger tourId="results" />

// With:
<WalkthroughTrigger tourId={sampleStatus === 'completed' ? 'coa' : 'results'} />
```

## Implementation Order

1. Database migration (add column)
2. Tour definition file (coa-tour.ts)
3. Type update (use-walkthrough.ts)
4. Provider update (walkthrough-provider.tsx)
5. Component update (assigned-tests-toolbar.tsx)
6. Test end-to-end

## Testing Checklist

- [ ] Analyst: Open `/samples`, select completed sample → `[? Hướng dẫn]` triggers CoA tour
- [ ] Analyst: Select in-progress sample → trigger shows Results tour instead
- [ ] Manager: Open `/manager/approvals?tab=completed`, select sample → CoA tour works
- [ ] Tour completion saves to `tour_coa_completed_at`
- [ ] PostgREST restart after migration (schema cache refresh)

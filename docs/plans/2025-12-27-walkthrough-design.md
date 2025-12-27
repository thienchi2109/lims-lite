# Interactive Walkthrough Design for CDC-LIMS

**Date:** 2025-12-27
**Status:** Approved
**Library:** Driver.js (~5KB, React 19 compatible)

## Overview

Implement interactive walkthroughs using Driver.js to onboard users for three key workflows:
- Sample Accession (Analyst)
- Results Submission (Analyst)
- Manager Approval (Manager)

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Trigger | First login + Help button | Auto-show for new users, repeat access via help |
| Tracking | Database per workflow | Audit trail, cross-device persistence, compliance-friendly |
| Help button | Contextual in page header | Least intrusive, near user focus |
| Tour length | 5-6 steps | Thorough training over completion rate |
| Visual style | Spotlight + interaction | "Learn by doing" approach |
| Progress | Dots + step counter | Maximum clarity ("Bước 2/5 ●●○○○") |

## Data Model

### Database Schema

```sql
-- Add to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  tour_accession_completed_at TIMESTAMPTZ,
  tour_results_completed_at TIMESTAMPTZ,
  tour_approval_completed_at TIMESTAMPTZ;
```

### TypeScript Types

```typescript
type TourId = 'accession' | 'results' | 'approval'

interface TourStatus {
  accession: Date | null
  results: Date | null
  approval: Date | null
}

// Server actions
async function getTourStatus(userId: string): Promise<TourStatus>
async function markTourCompleted(userId: string, tourId: TourId): Promise<void>
```

## Component Architecture

### File Structure

```
src/
├── components/
│   └── walkthrough/
│       ├── walkthrough-provider.tsx    # Context + Driver.js instance
│       ├── walkthrough-trigger.tsx     # Help button for page headers
│       ├── use-walkthrough.ts          # Hook for tour control
│       └── tours/
│           ├── accession-tour.ts       # 6 step definitions
│           ├── results-tour.ts         # 5 step definitions
│           └── approval-tour.ts        # 6 step definitions
├── lib/
│   └── walkthrough/
│       └── driver-config.ts            # Shared Driver.js styling
└── app/
    └── actions/
        └── walkthrough.ts              # Server actions
```

### Provider Pattern

```tsx
// Wrap in root layout
<WalkthroughProvider>
  {children}
</WalkthroughProvider>
```

The provider:
- Initializes Driver.js once (avoids re-creating on navigation)
- Fetches tour status on mount via server action
- Exposes `startTour(tourId)` and `tourStatus` via context
- Handles completion callbacks → updates database

### Page Integration

```tsx
// In page header (e.g., sample-accession-form.tsx)
<PageHeader
  title="Nhập mẫu mới"
  helpTour="accession"  // ← Adds help button + auto-start logic
/>
```

## Tour Definitions

### 1. Sample Accession Tour (6 steps)

**Tour ID:** `accession`
**Page:** `/analyst/accession`
**Target Users:** Analysts

| Step | Element Target | Title | Description |
|------|----------------|-------|-------------|
| 1 | QR Scanner card | Quét mã khách hàng | Bấm vào đây để quét mã QR của khách hàng. Bạn cũng có thể tìm kiếm thủ công ở bước tiếp theo. |
| 2 | Client selector input | Chọn khách hàng | Tìm kiếm hoặc chọn khách hàng từ danh sách. Nếu chưa có, bấm "Thêm mới" để tạo. |
| 3 | Sample type dropdown | Loại mẫu | Chọn loại mẫu xét nghiệm (Máu, Nước tiểu, v.v.). Mặc định là "Máu". |
| 4 | Received time input | Thời gian nhận mẫu | Ghi nhận thời điểm nhận mẫu. Hệ thống tự động điền giờ hiện tại. |
| 5 | Test assignment grid | Chỉ định xét nghiệm | Chọn các xét nghiệm cần thực hiện. Dùng checkbox hoặc tìm kiếm theo tên. |
| 6 | Save button | Lưu mẫu | Bấm để lưu mẫu và chỉ định xét nghiệm. Mẫu sẽ xuất hiện trong danh sách chờ nhập kết quả. |

### 2. Results Submission Tour (5 steps)

**Tour ID:** `results`
**Page:** `/analyst/results/[sampleId]`
**Target Users:** Analysts

| Step | Element Target | Title | Description |
|------|----------------|-------|-------------|
| 1 | Sample info header | Thông tin mẫu | Đây là thông tin mẫu đang xử lý: mã mẫu, khách hàng, loại mẫu và trạng thái hiện tại. |
| 2 | Results table | Bảng kết quả | Danh sách các xét nghiệm được chỉ định. Mỗi dòng là một xét nghiệm cần nhập kết quả. |
| 3 | Result cell (first editable) | Nhập kết quả | Bấm vào ô kết quả để nhập giá trị. Dùng Tab hoặc Enter để chuyển sang ô tiếp theo. |
| 4 | Batch save toolbar | Lưu thay đổi | Thanh công cụ hiển thị số thay đổi chưa lưu. Bấm "Lưu" để lưu tất cả hoặc "Hủy" để bỏ. |
| 5 | Submit for review button | Gửi duyệt | Khi đã nhập đủ kết quả, bấm "Gửi duyệt" để chuyển cho quản lý phê duyệt. Không thể chỉnh sửa sau khi gửi. |

**Conditional Logic:**
- If sample has no pending results → skip step 4
- If sample already submitted → show read-only tour variant (steps 1-2 only)

### 3. Manager Approval Tour (6 steps)

**Tour ID:** `approval`
**Page:** `/manager/approvals`
**Target Users:** Managers

| Step | Element Target | Title | Description |
|------|----------------|-------|-------------|
| 1 | Approval tabs | Danh sách chờ duyệt | Tab "Chờ duyệt KQ" hiển thị các mẫu cần phê duyệt. Con số đỏ cho biết số lượng đang chờ. |
| 2 | Approval queue table | Chọn mẫu | Bấm vào một dòng để xem chi tiết mẫu và kết quả xét nghiệm bên dưới. |
| 3 | Sample details panel | Chi tiết mẫu | Thông tin khách hàng, loại mẫu, thời gian nhận và lịch sử xử lý. |
| 4 | Results review section | Xem kết quả | Kiểm tra các kết quả do analyst nhập. Giá trị ngoài khoảng tham chiếu được đánh dấu. |
| 5 | Approve button | Phê duyệt | Bấm để phê duyệt các kết quả đã chọn. Yêu cầu chữ ký điện tử theo 21 CFR Part 11. |
| 6 | Reject/Discard buttons | Từ chối hoặc loại bỏ | "Từ chối mẫu" trả về cho analyst sửa. "Loại bỏ mẫu" hủy vĩnh viễn (cần ghi lý do). |

## Styling & Configuration

### Driver.js Theme

```typescript
// lib/walkthrough/driver-config.ts
export const driverConfig = {
  showProgress: true,
  animate: true,
  overlayColor: 'rgba(0, 0, 0, 0.6)',
  stagePadding: 8,
  stageRadius: 8,
  allowClose: true,
  allowKeyboardControl: true,

  // Vietnamese button labels
  nextBtnText: 'Tiếp theo',
  prevBtnText: 'Quay lại',
  doneBtnText: 'Hoàn tất',

  // Progress format
  progressText: '{{current}}/{{total}}',

  // Popover styling
  popoverClass: 'lims-tour-popover',
}
```

### CSS Customization

```css
/* globals.css - matches LIMS design system */
.lims-tour-popover {
  --driver-popover-bg: white;
  --driver-popover-border-radius: 12px;
  --driver-popover-padding: 16px;
}

.lims-tour-popover .driver-popover-title {
  @apply text-lg font-semibold text-slate-900;
}

.lims-tour-popover .driver-popover-description {
  @apply text-sm text-slate-600 mt-2;
}

.lims-tour-popover .driver-popover-next-btn {
  @apply bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-medium;
}

.lims-tour-popover .driver-popover-prev-btn {
  @apply bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md text-sm font-medium;
}

.lims-tour-popover .driver-popover-close-btn {
  @apply text-slate-400 hover:text-slate-600;
}

.lims-tour-popover .driver-popover-progress-text {
  @apply text-xs text-slate-500;
}
```

### Progress Dots Component

```tsx
function TourProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-500">Bước {current}/{total}</span>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              i < current ? "bg-emerald-500" : "bg-slate-300"
            )}
          />
        ))}
      </div>
    </div>
  )
}
```

## Implementation Plan

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/walkthrough/walkthrough-provider.tsx` | Context provider, Driver.js init, tour state |
| `src/components/walkthrough/walkthrough-trigger.tsx` | Help button (?) component for page headers |
| `src/components/walkthrough/use-walkthrough.ts` | Hook: `startTour()`, `tourStatus` |
| `src/components/walkthrough/tours/accession-tour.ts` | 6 step definitions |
| `src/components/walkthrough/tours/results-tour.ts` | 5 step definitions |
| `src/components/walkthrough/tours/approval-tour.ts` | 6 step definitions |
| `src/lib/walkthrough/driver-config.ts` | Shared styling + Vietnamese labels |
| `src/app/actions/walkthrough.ts` | Server actions: get/update tour status |

### Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/xxx_tour_tracking.sql` | Add 3 columns to profiles |
| `src/app/(dashboard)/layout.tsx` | Wrap with `<WalkthroughProvider>` |
| `src/components/sample-accession-form.tsx` | Add tour trigger + element IDs |
| `src/components/assigned-tests-panel.tsx` | Add tour trigger + element IDs |
| `src/app/(dashboard)/manager/approvals/page.tsx` | Add tour trigger + element IDs |

### Dependencies

```bash
npm install driver.js
```

### Implementation Order

1. Database migration (tour tracking columns)
2. Install Driver.js + create config
3. Create walkthrough provider + hook
4. Create server actions for tour status
5. Define tour steps (all 3 tours)
6. Add element IDs to existing components
7. Create walkthrough trigger component
8. Integrate triggers into page headers
9. Test each workflow end-to-end

## Research References

Based on thesis research "Evaluating Strategies for User Onboarding in Web Applications":
- Interactive Walkthroughs achieved **52.43% completion** and **94.85% satisfaction**
- Tours should be **3-4 steps max** for optimal completion (we chose 5-6 for thoroughness)
- **Progress indicators** improve completion by 12%
- **User-initiated tours** have 123% higher completion than auto-launched
- **Spotlight + interaction** ("learn by doing") is most effective for procedural training

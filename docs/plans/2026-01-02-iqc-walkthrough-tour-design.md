# IQC Walkthrough Tour Design

**Date:** 2026-01-02
**Status:** Approved
**Scope:** Add Driver.js walkthrough tours for IQC pages (Analyst + Manager)

---

## Overview

Add two new walkthrough tours to guide users through the Internal Quality Control (IQC) functionality:

1. **Analyst IQC Tour** (`iqc-analyst`) - Daily QC entry workflow
2. **Manager IQC Tour** (`iqc-manager`) - QC setup and violation management

## Tour Summary

| Tour ID | Target Page | User Role | Steps | Focus |
|---------|-------------|-----------|-------|-------|
| `iqc-analyst` | `/analyst/qc-entry` | Analyst | 7 | Full entry workflow with Westgard feedback |
| `iqc-manager` | `/manager/quality-control` | Manager | 7 | Overview + key actions (not all 6 tabs) |

---

## Database Migration

Add two columns to the `users` table:

```sql
-- Migration: add_iqc_tour_columns.sql
ALTER TABLE users
ADD COLUMN tour_iqc_analyst_completed_at TIMESTAMPTZ,
ADD COLUMN tour_iqc_manager_completed_at TIMESTAMPTZ;
```

---

## Type Updates

### File: `src/components/walkthrough/use-walkthrough.ts`

```typescript
export type TourId =
  | 'accession'
  | 'results'
  | 'approval'
  | 'coa'
  | 'iqc-analyst'
  | 'iqc-manager'

export interface TourStatus {
  accession: Date | null
  results: Date | null
  approval: Date | null
  coa: Date | null
  'iqc-analyst': Date | null
  'iqc-manager': Date | null
}
```

---

## Analyst IQC Tour Steps

**File:** `src/components/walkthrough/tours/iqc-analyst-tour.ts`

| # | Element ID | Title | Description |
|---|------------|-------|-------------|
| 1 | `#tour-iqc-header` | Trang nhập QC | Giới thiệu trang kiểm soát chất lượng nội bộ |
| 2 | `#tour-iqc-specialty-tabs` | Chọn nhóm kỹ thuật xét nghiệm | Chọn tab để xem các xét nghiệm QC tương ứng. Số trong ngoặc là số xét nghiệm cần chạy QC |
| 3 | `#tour-iqc-assay-card` | Thẻ xét nghiệm | Mỗi thẻ hiển thị: tên XN, vật liệu QC, Mean/SD, trạng thái phiên hiện tại |
| 4 | `#tour-iqc-status-badge` | Trạng thái QC | Badge hiển thị trạng thái: Chờ QC, Đạt, Cảnh báo, hoặc Mất kiểm soát |
| 5 | `#tour-iqc-entry-button` | Nhập kết quả | Bấm để mở form nhập giá trị QC đo được |
| 6 | `#tour-iqc-westgard-feedback` | Đánh giá Westgard | Hệ thống tự động tính Z-score và kiểm tra quy tắc Westgard. Màu xanh = Đạt, vàng = Cảnh báo, đỏ = Vi phạm |
| 7 | `#tour-iqc-save-button` | Lưu kết quả | Bấm Lưu để ghi nhận. Nếu vi phạm, cần thông báo Quản lý xử lý trước khi tiếp tục xét nghiệm bệnh phẩm |

### Element IDs to Add

| Component | Element | ID |
|-----------|---------|-----|
| `qc-entry-page-client.tsx` | Header area | `#tour-iqc-header` |
| `qc-entry-page-client.tsx` | TabsList | `#tour-iqc-specialty-tabs` |
| `qc-assay-card.tsx` | Card wrapper | `#tour-iqc-assay-card` |
| `qc-assay-card.tsx` | Status Badge | `#tour-iqc-status-badge` |
| `qc-assay-card.tsx` | Entry Button | `#tour-iqc-entry-button` |
| `qc-entry-form.tsx` | Westgard Alert | `#tour-iqc-westgard-feedback` |
| `qc-entry-form.tsx` | Submit Button | `#tour-iqc-save-button` |

---

## Manager IQC Tour Steps

**File:** `src/components/walkthrough/tours/iqc-manager-tour.ts`

| # | Element ID | Title | Description |
|---|------------|-------|-------------|
| 1 | `#tour-iqc-mgr-header` | Quản lý QC | Trang thiết lập và giám sát kiểm soát chất lượng nội bộ theo quy tắc Westgard |
| 2 | `#tour-iqc-mgr-stats` | Thống kê tổng quan | Hiển thị số vật liệu, giới hạn đang hoạt động, phiên QC, và vi phạm chờ xử lý |
| 3 | `#tour-iqc-mgr-violations-alert` | Cảnh báo vi phạm | Khi có vi phạm Westgard, hệ thống sẽ chặn phê duyệt kết quả cho đến khi xử lý xong |
| 4 | `#tour-iqc-mgr-tabs` | Các tab quản lý | Tổng quan, Vật liệu, Giới hạn, Phiên QC, Vi phạm, và Phân tích |
| 5 | `#tour-iqc-mgr-establish-limits` | Thiết lập giới hạn | Bấm để tạo giới hạn kiểm soát mới (Mean, SD) cho một xét nghiệm với vật liệu QC cụ thể |
| 6 | `#tour-iqc-mgr-sessions` | Quản lý phiên | Bắt đầu/kết thúc phiên QC cho từng xét nghiệm. Analyst chỉ có thể nhập QC khi có phiên đang mở |
| 7 | `#tour-iqc-mgr-resolve` | Xử lý vi phạm | Khi vi phạm xảy ra, vào tab Vi phạm để ghi nhận hành động khắc phục và mở khóa phê duyệt |

### Element IDs to Add

| Component | Element | ID |
|-----------|---------|-----|
| `quality-control-page-client.tsx` | Header area | `#tour-iqc-mgr-header` |
| `qc-stats-cards.tsx` | Stats wrapper | `#tour-iqc-mgr-stats` |
| `quality-control-page-client.tsx` | Violations Card | `#tour-iqc-mgr-violations-alert` |
| `quality-control-page-client.tsx` | TabsList | `#tour-iqc-mgr-tabs` |
| `quality-control-page-client.tsx` | Establish Button | `#tour-iqc-mgr-establish-limits` |
| `quality-control-page-client.tsx` | Sessions Tab | `#tour-iqc-mgr-sessions` |
| `qc-violations-tab.tsx` | Resolve area | `#tour-iqc-mgr-resolve` |

---

## Files to Create

| File | Lines (est.) | Purpose |
|------|--------------|---------|
| `supabase/migrations/XXXXXX_add_iqc_tour_columns.sql` | ~10 | Database migration |
| `src/components/walkthrough/tours/iqc-analyst-tour.ts` | ~70 | Analyst tour steps |
| `src/components/walkthrough/tours/iqc-manager-tour.ts` | ~80 | Manager tour steps |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/walkthrough/use-walkthrough.ts` | Add tour IDs to types |
| `src/components/walkthrough/walkthrough-provider.tsx` | Import + register new tours |
| `src/app/actions/walkthrough.ts` | Add column mappings |
| `src/components/qc/qc-entry-page-client.tsx` | Add element IDs + WalkthroughTrigger |
| `src/components/qc/qc-assay-card.tsx` | Add element IDs |
| `src/components/qc/qc-entry-form.tsx` | Add element IDs |
| `src/components/qc/quality-control-page-client.tsx` | Add element IDs + WalkthroughTrigger |
| `src/components/qc/qc-stats-cards.tsx` | Add wrapper ID |

---

## Implementation Checklist

- [ ] Create database migration for tour columns
- [ ] Update `TourId` and `TourStatus` types
- [ ] Create `iqc-analyst-tour.ts` with 7 steps
- [ ] Create `iqc-manager-tour.ts` with 7 steps
- [ ] Register tours in `walkthrough-provider.tsx`
- [ ] Update column mappings in `walkthrough.ts` action
- [ ] Add element IDs to Analyst QC components
- [ ] Add element IDs to Manager QC components
- [ ] Add `WalkthroughTrigger` to Analyst QC page header
- [ ] Add `WalkthroughTrigger` to Manager QC page header
- [ ] Test both tours end-to-end
- [ ] Verify tour completion persists in database

---

## WalkthroughTrigger Placement (Consistency)

The "Hướng dẫn" button must follow existing patterns for consistency.

### Existing Patterns

| Page | Placement | Pattern |
|------|-----------|---------|
| Accession | Header right side, after title/description | `<WalkthroughTrigger tourId="accession" />` |
| Approvals | Header left side, after back button | `<WalkthroughTrigger tourId="approval" />` |
| Results | Toolbar, after status badges | `<WalkthroughTrigger tourId="results" />` |

### IQC Placement

**Analyst QC Entry (`qc-entry-page-client.tsx`):**
- Location: Header area, right side of title row (matching accession pattern)
- After: "Kiểm soát chất lượng nội bộ (IQC)" title
- Code:
```tsx
<div className="flex items-center gap-3">
    <Activity className="h-6 w-6 text-primary" />
    <h1 className="text-2xl font-bold tracking-tight">
        Kiểm soát chất lượng nội bộ (IQC)
    </h1>
    <WalkthroughTrigger tourId="iqc-analyst" />  {/* ADD HERE */}
</div>
```

**Manager QC Dashboard (`quality-control-page-client.tsx`):**
- Location: Header area, after title (before action buttons)
- After: "Quản lý Kiểm soát Chất lượng" title
- Code:
```tsx
<div className="flex items-center gap-3">
    <Activity className="h-6 w-6 text-primary" />
    <h1 className="text-2xl font-bold tracking-tight">
        Quản lý Kiểm soát Chất lượng
    </h1>
    <WalkthroughTrigger tourId="iqc-manager" />  {/* ADD HERE */}
</div>
```

### Button Behavior (from WalkthroughTrigger component)

- Shows sky-blue "Hướng dẫn" button with HelpCircle icon
- Pulses with `animate-pulse` if tour not yet completed
- Auto-shows tooltip for 5 seconds on first visit
- Tooltip says: "Bấm để xem hướng dẫn sử dụng trang này"

---

## Notes

- All files kept under 350 lines per project standards
- Vietnamese localization applied to all tour content
- Tours follow existing pattern from `accession-tour.ts`, `approval-tour.ts`
- Manager tour focuses on daily workflow (Overview + key actions), not all 6 tabs
- WalkthroughTrigger placement follows consistent header pattern

# Lab Specialty Filter Chips - Design Document

**Date:** 2025-12-21
**Feature:** Add lab specialty filter chips to Samples management page
**Beads Task:** lims-lite-sv9

## Overview

Add multiple-choice toggle chips to the Samples management page that filter samples by lab specialty (nhóm kỹ thuật) based on assigned tests. Server-side filtering with TanStack Query integration.

## User Requirements

- **Filter Scope:** Show samples with at least one assigned test matching ANY selected specialty (OR logic)
- **UI Placement:** Dedicated row below main filters (status, receiver, date)
- **Interaction:** Toggle chips - click to select/deselect, all specialties visible at once
- **Terminology:** Use "nhóm kỹ thuật" instead of "chuyên khoa"

## Architecture

### Data Flow

```
User clicks chip
  → URL param updates (specialtyIds=uuid1,uuid2)
  → TanStack Query detects URL change
  → Auto-refetches via useSamples hook
  → fetchSamples() applies server-side filter
  → Database JOIN query filters samples
  → Results displayed in SampleListTable
```

### Database Query Pattern

```sql
-- Filter samples by specialty (ANY match)
SELECT DISTINCT s.*
FROM samples s
INNER JOIN results r ON r.sample_id = s.id
INNER JOIN assay_definitions ad ON ad.id = r.assay_id
WHERE ad.specialty_id IN ('uuid1', 'uuid2', 'uuid3')
  AND s.deleted_at IS NULL
  AND ad.specialty_id IS NOT NULL
```

**Relationship Chain:** `samples → results → assay_definitions → lab_specialties`

### URL State Management

- **Parameter:** `specialtyIds` (comma-separated UUIDs)
- **Example:** `?specialtyIds=uuid1,uuid2,uuid3&status=in_progress`
- **Benefits:** Shareable URLs, browser back/forward support, bookmark-able filters

## UI Design

### Visual Layout

```
┌─────────────────────────────────────────────────────────┐
│ [Search] [Status] [Receiver] [Date] [Sort] [PageSize]  │ ← Existing filters
├─────────────────────────────────────────────────────────┤
│ Lọc theo nhóm kỹ thuật:                                 │ ← New section label
│ [CYTO - Tế bào học] [HEM - Huyết học] [BIO - Sinh hóa] │ ← Toggle chips
│ [IMM - Miễn dịch] [MIC - Vi sinh] [Đã chọn: 2] [Xóa]   │ ← Count + Clear
└─────────────────────────────────────────────────────────┘
```

### Chip States

**Unselected:**
- Style: `border-slate-200 bg-white text-slate-700 hover:bg-slate-50`
- Icon: None

**Selected:**
- Style: `bg-sky-500 text-white border-sky-500`
- Icon: Checkmark (✓)

### Interactive Elements

- **Chips:** Clickable buttons, keyboard accessible (Tab + Space/Enter)
- **Selected Count:** "Đã chọn: X nhóm kỹ thuật" (shown when > 0 selected)
- **Clear Button:** "Xóa lọc nhóm kỹ thuật" (removes all selections)
- **Empty State:** "Nhấp vào nhóm kỹ thuật để lọc mẫu" (when no filter active)

### Responsive Design

- **Desktop:** Horizontal row, chips wrap if needed
- **Mobile:** Horizontal scroll with fade indicators
- **Sorting:** By `display_order` (database field)

## Implementation

### Files to Modify/Create

1. **src/types/index.ts**
   - Add `specialtyIds` to `SampleListParamsSchema`

2. **src/lib/data/samples.ts**
   - Parse `specialtyIds` from comma-separated string
   - Add JOIN filter to query when `specialtyIds.length > 0`
   - Handle empty results gracefully

3. **src/components/lab-specialty-chips.tsx** (NEW)
   - Props: `specialties: LabSpecialty[]`, `selectedIds: string[]`
   - Parse/update URL params via `useRouter` + `useSearchParams`
   - Render toggle chips with proper styling
   - Show selected count and clear button

4. **src/components/samples-page-client.tsx**
   - Parse `specialtyIds` from URL params
   - Pass to `useSamples` hook
   - Render `<LabSpecialtyChips />` component

### Code Examples

**Type Definition:**
```typescript
export const SampleListParamsSchema = PaginationSchema.extend({
    status: SampleStatus.optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    receiverId: z.string().uuid().optional(),
    specialtyIds: z.string().optional(), // Comma-separated UUIDs
})
```

**Server-Side Filtering:**
```typescript
// Parse specialty IDs
const specialtyIds = validatedParams.specialtyIds
    ? validatedParams.specialtyIds.split(',').filter(id =>
        id.match(/^[0-9a-fA-F-]{36}$/)
      )
    : []

// Apply filter
if (specialtyIds.length > 0) {
    const { data: samplesWithSpecialty } = await supabase
        .from('results')
        .select('sample_id')
        .in('assay_id',
            supabase.from('assay_definitions')
                .select('id')
                .in('specialty_id', specialtyIds)
        )

    const sampleIds = [...new Set(samplesWithSpecialty?.map(r => r.sample_id))]

    if (sampleIds.length > 0) {
        query = query.in('id', sampleIds)
    } else {
        query = query.eq('id', '00000000-0000-0000-0000-000000000000')
    }
}
```

## Edge Cases

### 1. No Assigned Tests
- **Behavior:** Sample won't appear when specialty filter active
- **Rationale:** Can't determine specialty without tests

### 2. Tests Without Specialty
- **Behavior:** Ignore assays where `specialty_id IS NULL`
- **Impact:** Samples with only specialty-less tests excluded from specialty filters

### 3. Multiple Specialties Per Sample
- **Behavior:** Sample appears if ANY selected specialty matches (OR logic)
- **Example:** Sample has HEM + BIO tests → shows when HEM OR BIO selected

### 4. All Chips Selected
- **Behavior:** Shows all samples (equivalent to no filter)
- **No optimization:** Keep filter for clarity

### 5. Empty Results
- **UI:** Show existing empty state: "Không tìm thấy mẫu nào"
- **Action:** User can click clear button to reset

## Performance

### Database Optimization
- Use `DISTINCT` to avoid duplicates
- Leverage existing index on `assay_definitions.specialty_id`
- Subquery uses index scans (Postgres optimized)
- Limit: Max 50-100 specialty IDs (prevent query explosion)

### Client Performance
- No virtualization needed (~15 specialties max)
- Horizontal scroll with CSS (`overflow-x: auto`)
- No debounce needed (TanStack Query handles refetch throttling)

## Accessibility

- **Keyboard Navigation:** Tab through chips, Space/Enter to toggle
- **ARIA Labels:**
  - Chips: `aria-pressed="true"` when selected
  - Clear button: `aria-label="Xóa lọc nhóm kỹ thuật"`
- **Screen Reader:** Selected state announced automatically

## Testing Checklist

- [ ] Single specialty selection filters correctly
- [ ] Multiple specialty selection (OR logic works)
- [ ] Clear button removes all filters
- [ ] URL state persists on page refresh
- [ ] TanStack Query refetches on filter change
- [ ] Empty results show proper message
- [ ] Keyboard navigation works (Tab, Space, Enter)
- [ ] Screen reader announces selected state
- [ ] Mobile horizontal scroll works with fade indicators
- [ ] Specialty chips sorted by `display_order`

## Success Criteria

✅ Samples filtered server-side by lab specialty
✅ Multiple specialties selectable (OR logic)
✅ URL state persistence and sharing
✅ TanStack Query integration (auto-refetch)
✅ Vietnamese terminology ("nhóm kỹ thuật")
✅ Accessible keyboard navigation
✅ Responsive design (desktop + mobile)

## Related Tasks

- **Parent:** lims-lite-sv9 - Add lab specialty filter chips to Samples page
- **Children:**
  - lims-lite-sv9.1 - Update SampleListParamsSchema
  - lims-lite-sv9.2 - Implement server-side filtering
  - lims-lite-sv9.3 - Create LabSpecialtyChips component
  - lims-lite-sv9.4 - Integrate into SamplesPageClient
  - lims-lite-sv9.5 - End-to-end testing

# Collapsible Lab Specialty Filter - Design Document

**Date:** 2025-12-21
**Feature:** Collapsible specialty filter chips to save grid space
**Status:** Approved for implementation

## Problem Statement

The lab specialty filter chips component currently takes 80-120px of vertical space from the samples grid, even when users are not actively filtering. This reduces the visible grid area and requires more scrolling.

## Solution Overview

Implement a collapsible interface for the specialty filter chips that:
- Starts collapsed by default (compact single-row button)
- Shows badge with selected count when filters are active
- Expands to full chip interface on user click
- Saves 40-80px vertical space in default state

## Design Decisions

### Approach: Collapsible Filter (Option A)
**Why chosen:**
- Saves space when not in use (the common case)
- Keeps intuitive visual chip interface when expanded
- Least disruptive to existing layout
- Multi-select functionality preserved

**Alternatives considered:**
- Dropdown multi-select: Lost at-a-glance visibility
- Merge into SampleFilters: Made filters section too complex

### Collapsed State: Badge with Count (Option 1)
**Why chosen:**
- Minimal width, very clean
- Clear indication of active filters
- Consistent with existing filter patterns

**Format:** `[Icon] Lọc theo nhóm kỹ thuật (2 nhóm)`

## Architecture

### Component Structure
- Enhance existing `LabSpecialtyChips` component
- Add local state: `const [isExpanded, setIsExpanded] = useState(false)`
- No URL state changes (filter selections remain in URL as-is)
- Component starts collapsed by default

### State Management
- **UI State (local):** `isExpanded` - not persisted, defaults to false
- **Filter State (URL):** `specialtyIds` - existing behavior unchanged
- Filter selections persist across collapse/expand cycles

## UI Specification

### Collapsed Button
```tsx
<button onClick={() => setIsExpanded(!isExpanded)}>
  <ListFilter /> // Icon
  "Lọc theo nhóm kỹ thuật" // Label
  {selectedCount > 0 && <Badge>{selectedCount} nhóm</Badge>}
  <ChevronDown className={isExpanded && "rotate-180"} />
</button>
```

**Styling:**
- Height: ~40px
- Border: `border-slate-200`
- Background: `bg-white/50 hover:bg-slate-50`
- Badge color: `bg-sky-500 text-white` (matches selected chips)
- Chevron rotates 180deg when expanded

### Expanded Panel
- Full existing chip interface (header, chips, hint text)
- Wrapped in conditional render: `{isExpanded && <div>...</div>}`
- Smooth transitions: `transition-all duration-200 ease-in-out`
- Click chevron/header again to collapse

### Visual Transitions
- Chevron icon rotates smoothly
- Panel slides in/out with height animation
- Badge appears/disappears based on selection count

## Accessibility

- `aria-expanded={isExpanded}` on trigger button
- `aria-controls="specialty-filter-panel"` on trigger
- `id="specialty-filter-panel"` on expanded content
- Existing `aria-pressed` on individual chips preserved

## Integration

### Files Modified
1. **`src/components/lab-specialty-chips.tsx`**
   - Add `isExpanded` state
   - Add collapsed button UI
   - Wrap existing chips in conditional render
   - Import new icons: `ListFilter`, `ChevronDown`

### No Changes Needed
- `src/components/samples-page-client.tsx` - component usage stays the same
- URL parsing logic - unchanged
- Filter data flow - unchanged

## User Flow

1. Page loads → Filter collapsed, no badge
2. User clicks button → Panel expands
3. User selects 2 specialties → Selections apply immediately
4. User clicks chevron → Panel collapses
5. Badge shows "2 nhóm" → Active filter visible
6. User clicks button again → Panel expands to modify

## Visual Impact

| State | Height | Space Saved |
|-------|--------|-------------|
| Before (always expanded) | ~140-180px | - |
| After (collapsed, no selections) | ~40px | ~100-140px |
| After (collapsed, with selections) | ~40px | ~100-140px |
| After (expanded) | ~140-180px | 0px (same) |

**Net benefit:** 40-80px more vertical space for samples grid in default state.

## Responsive Behavior

- **Desktop:** Collapsed state keeps interface clean
- **Mobile:** Even more valuable on narrow viewports
- **Expanded wrapping:** Existing chip wrap behavior preserved

## Implementation Notes

- Self-contained component change (no breaking changes)
- Existing tests should pass without modification
- No database/API changes required
- Visual-only enhancement

## Success Criteria

- [ ] Filter starts collapsed by default
- [ ] Clicking button expands/collapses panel
- [ ] Badge shows correct count when filters active
- [ ] Chevron icon rotates smoothly
- [ ] All existing filter functionality works
- [ ] Accessibility attributes correct
- [ ] TypeScript passes
- [ ] Visual QA on desktop and mobile

## Future Enhancements (Not in Scope)

- Click-away to auto-collapse
- Remember expanded/collapsed state in localStorage
- Keyboard shortcuts (Ctrl+F to toggle)
- Animation polish (slide vs fade)

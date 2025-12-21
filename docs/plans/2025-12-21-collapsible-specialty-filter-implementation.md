# Collapsible Lab Specialty Filter - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the lab specialty filter chips collapsible to save 40-80px vertical space for the samples grid.

**Architecture:** Enhance existing `LabSpecialtyChips` component with local `isExpanded` state. Collapsed state shows compact button with badge count; expanded state shows full chip interface. No database or URL state changes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, lucide-react icons

---

## Task 1: Add isExpanded state and import new icons

**Files:**
- Modify: `src/components/lab-specialty-chips.tsx:1-10`

**Step 1: Add new icon imports**

Update the imports section (lines 1-8):

```typescript
'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, X, ListFilter, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { LabSpecialty } from '@/types'
```

**Changes:**
- Add `useState` to React imports (line 3)
- Add `ListFilter` and `ChevronDown` to lucide-react imports (line 5)

**Step 2: Add isExpanded state**

Add state declaration after the component function declaration (after line 23):

```typescript
export function LabSpecialtyChips({
    specialties,
    selectedIds = [],
}: LabSpecialtyChipsProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    const router = useRouter()
    const searchParams = useSearchParams()
    // ... rest of existing code
```

**Step 3: Run TypeScript validation**

Run: `npm run typecheck`

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/components/lab-specialty-chips.tsx
git commit -m "feat: Add isExpanded state and icons for collapsible filter"
```

---

## Task 2: Create collapsed button UI

**Files:**
- Modify: `src/components/lab-specialty-chips.tsx:65-122`

**Step 1: Replace return statement with conditional UI**

Replace the entire return statement (lines 65-122) with this new implementation:

```typescript
    const selectedCount = selectedIds.length

    return (
        <div className="flex flex-col gap-2">
            {/* Collapsed Button */}
            {!isExpanded && (
                <button
                    type="button"
                    onClick={() => setIsExpanded(true)}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/50 px-3 py-2 hover:bg-slate-50 transition-colors w-fit"
                    aria-expanded={false}
                    aria-controls="specialty-filter-panel"
                >
                    <ListFilter className="h-4 w-4 text-slate-600" aria-hidden="true" />
                    <span className="text-sm font-medium text-slate-700">
                        Lọc theo nhóm kỹ thuật
                    </span>
                    {selectedCount > 0 && (
                        <span className="bg-sky-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                            {selectedCount} nhóm
                        </span>
                    )}
                    <ChevronDown className="h-4 w-4 text-slate-500 transition-transform" aria-hidden="true" />
                </button>
            )}

            {/* Expanded Panel - Original UI */}
            {isExpanded && (
                <div
                    id="specialty-filter-panel"
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white/50 p-3 backdrop-blur-sm transition-all duration-200 ease-in-out"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">
                            Lọc theo nhóm kỹ thuật:
                        </span>
                        <div className="flex items-center gap-2">
                            {selectedCount > 0 && (
                                <span className="text-xs text-slate-500">
                                    Đã chọn: {selectedCount} nhóm
                                </span>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsExpanded(false)}
                                className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700"
                                aria-label="Thu gọn bộ lọc"
                            >
                                <ChevronDown className="mr-1 h-3 w-3 rotate-180 transition-transform" aria-hidden="true" />
                                Thu gọn
                            </Button>
                            {selectedCount > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearAll}
                                    className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700"
                                    aria-label="Xóa lọc nhóm kỹ thuật"
                                >
                                    <X className="mr-1 h-3 w-3" aria-hidden="true" />
                                    Xóa
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo nhóm kỹ thuật">
                        {sortedSpecialties.map((specialty) => {
                            const isSelected = selectedIds.includes(specialty.id)
                            return (
                                <button
                                    key={specialty.id}
                                    type="button"
                                    onClick={() => toggleSpecialty(specialty.id)}
                                    aria-pressed={isSelected}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
                                        'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1',
                                        isSelected
                                            ? 'border-sky-500 bg-sky-500 text-white hover:bg-sky-600'
                                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                    )}
                                >
                                    {isSelected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                                    <span>{specialty.code}</span>
                                    <span className="hidden sm:inline">- {specialty.name}</span>
                                </button>
                            )
                        })}
                    </div>

                    {selectedCount === 0 && (
                        <p className="text-xs text-slate-400">
                            Nhấp vào nhóm kỹ thuật để lọc mẫu
                        </p>
                    )}
                </div>
            )}
        </div>
    )
```

**Key changes:**
- Wrapped entire component in outer div
- Collapsed button shows when `!isExpanded`
- Expanded panel shows when `isExpanded`
- Collapsed button includes ListFilter icon, label, conditional badge, and ChevronDown
- Expanded panel has "Thu gọn" button to collapse
- Badge only appears when `selectedCount > 0`

**Step 2: Run TypeScript validation**

Run: `npm run typecheck`

Expected: No TypeScript errors

**Step 3: Test collapsed state in dev server**

Run: `npm run dev`

Navigate to: `http://localhost:3000/analyst/samples` or `/manager/samples`

Verify:
- ✅ Filter starts collapsed (compact button visible)
- ✅ Button shows "Lọc theo nhóm kỹ thuật" text
- ✅ ListFilter icon appears
- ✅ No badge when no selections
- ✅ Clicking button expands panel

**Step 4: Commit**

```bash
git add src/components/lab-specialty-chips.tsx
git commit -m "feat: Implement collapsed button UI with expand/collapse toggle"
```

---

## Task 3: Add chevron rotation animation

**Files:**
- Modify: `src/components/lab-specialty-chips.tsx:74`

**Step 1: Update collapsed button chevron**

Modify the ChevronDown in collapsed button (line 74) to rotate when expanded would be shown:

```typescript
<ChevronDown
    className={cn(
        "h-4 w-4 text-slate-500 transition-transform",
        isExpanded && "rotate-180"
    )}
    aria-hidden="true"
/>
```

**Note:** This is actually already handled by the conditional rendering, so the chevron in collapsed state never rotates. The rotation happens in the expanded panel's collapse button.

**Step 2: Verify chevron rotation in expanded panel**

The expanded panel's "Thu gọn" button already has `rotate-180` on its chevron (line 51 in new code).

**Step 3: Test animation in dev server**

Run: `npm run dev`

Verify:
- ✅ Collapsed button chevron points down
- ✅ Expanded panel collapse button chevron points up (rotated 180deg)
- ✅ Smooth transition when toggling

**Step 4: Run TypeScript validation**

Run: `npm run typecheck`

Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src/components/lab-specialty-chips.tsx
git commit -m "feat: Add chevron rotation animation for collapse state"
```

---

## Task 4: Test with specialty selections and badge

**Files:**
- Test: Manual testing in browser

**Step 1: Test badge appearance**

Run: `npm run dev`

Navigate to: `/analyst/samples` or `/manager/samples`

**Test scenario:**
1. Click collapsed button to expand
2. Select 2 specialties (e.g., HH, SH)
3. Click "Thu gọn" to collapse
4. Verify badge shows "2 nhóm"
5. Verify badge has sky-500 background
6. Click button again to expand
7. Verify selections persist

**Expected:**
- ✅ Badge appears only when `selectedCount > 0`
- ✅ Badge shows correct count
- ✅ Badge styling matches design (sky-500 background, white text)
- ✅ Selections persist through collapse/expand cycles

**Step 2: Test clear functionality**

With 2 specialties selected:
1. Expand panel
2. Click "Xóa" button
3. Verify all selections cleared
4. Verify badge disappears from collapsed button

**Expected:**
- ✅ Clear button removes all selections
- ✅ Badge disappears when count = 0
- ✅ URL params updated (page resets to 1)

**Step 3: Test URL state persistence**

With 2 specialties selected:
1. Copy URL from address bar
2. Open in new tab
3. Verify specialties are selected in expanded view
4. Collapse
5. Verify badge shows "2 nhóm"

**Expected:**
- ✅ Filter selections persist in URL
- ✅ Page loads with correct selections
- ✅ Badge reflects URL state

---

## Task 5: Verify accessibility and final testing

**Files:**
- Test: Manual accessibility testing

**Step 1: Verify ARIA attributes**

Inspect collapsed button in browser DevTools:

```html
<button
  type="button"
  aria-expanded="false"
  aria-controls="specialty-filter-panel"
>
```

Inspect expanded panel:

```html
<div id="specialty-filter-panel">
```

**Expected:**
- ✅ `aria-expanded="false"` on collapsed button
- ✅ `aria-controls="specialty-filter-panel"` on collapsed button
- ✅ `id="specialty-filter-panel"` on expanded panel
- ✅ `aria-hidden="true"` on all decorative icons
- ✅ `aria-pressed` on specialty chips (existing)

**Step 2: Test keyboard navigation**

Using keyboard only:
1. Tab to collapsed button
2. Press Enter to expand
3. Tab through specialty chips
4. Press Space to toggle selections
5. Tab to "Thu gọn" button
6. Press Enter to collapse

**Expected:**
- ✅ All interactive elements are keyboard accessible
- ✅ Focus indicators visible
- ✅ Enter/Space keys work for toggling

**Step 3: Test screen reader (if available)**

Using NVDA/JAWS/VoiceOver:
1. Navigate to collapsed button
2. Verify announces "Lọc theo nhóm kỹ thuật, button, collapsed"
3. Activate button
4. Verify announces expanded state
5. Navigate through chips
6. Verify announces pressed/not pressed states

**Expected:**
- ✅ Collapsed/expanded states announced
- ✅ Badge count announced
- ✅ Chip selection states announced

**Step 4: Run final TypeScript check**

Run: `npm run typecheck`

Expected: No TypeScript errors

**Step 5: Visual QA checklist**

Desktop (1920x1080):
- ✅ Collapsed button ~40px height
- ✅ Badge visible and properly styled
- ✅ Chevron rotation smooth
- ✅ Expanded panel matches original design
- ✅ Transitions smooth (200ms ease-in-out)

Mobile (375x667):
- ✅ Collapsed button fits on narrow screen
- ✅ Badge doesn't wrap or overlap
- ✅ Expanded chips wrap properly
- ✅ Touch targets ≥44px

**Step 6: Commit final changes**

```bash
git add src/components/lab-specialty-chips.tsx
git commit -m "test: Verify accessibility and visual QA for collapsible filter"
```

---

## Verification Checklist

Before marking complete, verify ALL items:

**Functionality:**
- [ ] Filter starts collapsed by default
- [ ] Clicking button expands panel
- [ ] Clicking "Thu gọn" collapses panel
- [ ] Badge shows correct count when selections active
- [ ] Badge disappears when count = 0
- [ ] Selections persist through collapse/expand
- [ ] "Xóa" button clears all selections
- [ ] URL state persists (refresh preserves selections)

**Visual:**
- [ ] Collapsed height ~40px (saves space)
- [ ] Badge styled correctly (sky-500, white text, rounded)
- [ ] Chevron rotation smooth
- [ ] Transitions smooth (no jank)
- [ ] Works on desktop and mobile

**Accessibility:**
- [ ] `aria-expanded` correct on button
- [ ] `aria-controls` links to panel
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Screen reader friendly

**Code Quality:**
- [ ] TypeScript passes
- [ ] No console errors
- [ ] Code follows existing patterns
- [ ] Commits are atomic and well-described

---

## Notes for Engineer

**Design rationale:**
- Collapsed by default saves 40-80px vertical space
- Badge provides at-a-glance filter status
- Smooth transitions improve UX perception
- Self-contained component (no breaking changes)

**If you encounter issues:**
- Badge not showing: Check `selectedCount > 0` condition
- Transitions janky: Verify `transition-all duration-200 ease-in-out` on panel
- Chevron not rotating: Check conditional className on ChevronDown
- TypeScript errors: Ensure useState imported from 'react'

**Testing edge cases:**
- No specialties available (specialties.length = 0)
- All specialties selected (badge shows full count)
- Rapid clicking (state transitions should be smooth)
- Long specialty names (should wrap or truncate)

**Reference files:**
- Design doc: `docs/plans/2025-12-21-collapsible-specialty-filter-design.md`
- Original component: `src/components/lab-specialty-chips.tsx` (before changes)
- Vietnamese dictionary: `docs/vietnamese_dictionary.md`

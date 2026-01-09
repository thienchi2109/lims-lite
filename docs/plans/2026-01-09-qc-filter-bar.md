# QC Filter Bar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace specialty pill filter with integrated filter bar containing search input, specialty dropdown, and status dropdown with server-side filtering.

**Architecture:** Client component (`QCFilterControls`) handles user interaction with debounced search and immediate dropdown updates. URL params drive server-side filtering in `fetchQCEntryData`. Hook (`useFilterParams`) encapsulates URL manipulation logic.

**Tech Stack:** Next.js App Router, Shadcn UI (Input, Select), React hooks, Zod validation

---

## Task 1: Update QCEntryParamsSchema

**Files:**
- Modify: `src/types/lab.ts:201-204`

**Step 1: Add search and status to schema**

Update `QCEntryParamsSchema` to include `search` and `status` fields:

```typescript
export const QCEntryParamsSchema = PaginationSchema.extend({
    specialty: z.string().uuid().optional(),
    id: z.string().uuid().optional(),
    search: z.string().max(100).optional(),
    status: z.enum(['pending', 'entered', 'approved']).optional(),
}).omit({ sortBy: true, sortOrder: true })
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no breaking changes, fields are optional)

**Step 3: Commit**

```bash
git add src/types/lab.ts
git commit -m "feat(qc): add search and status to QCEntryParamsSchema"
```

---

## Task 2: Update fetchQCEntryData with Search and Status Filters

**Files:**
- Modify: `src/lib/data/qc-entry.ts:85-137`

**Step 1: Add search filter**

After the specialty filter (line 122), add search filter:

```typescript
// Apply search filter (ILIKE on assay name)
if (validatedParams.search) {
    query = query.ilike('assay.name', `%${validatedParams.search}%`)
}
```

**Step 2: Add status filter logic**

The status is computed from `qc_sessions`, not stored in `qc_definitions`. We need to filter AFTER transforming the data. Update the return section to filter by status:

After `assayList.sort(...)` (around line 151), add:

```typescript
// Apply status filter (post-query since status is computed)
const filteredAssays = validatedParams.status
    ? assayList.filter((a) => a.status === validatedParams.status)
    : assayList
```

Then update the return to use `filteredAssays` and recalculate pagination:

```typescript
// Recalculate count for status filter (affects pagination display)
const filteredCount = validatedParams.status ? filteredAssays.length : (count || 0)

return {
    data: filteredAssays,
    qcResultsByDefinition,
    count: filteredCount,
    page: validatedParams.page,
    pageSize: validatedParams.pageSize,
    totalPages: Math.ceil(filteredCount / validatedParams.pageSize),
}
```

**Note:** Status filtering is post-query because status is derived from `qc_sessions` join. For MVP this is acceptable. Future optimization: add `status` column to `qc_definitions` or use RPC.

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/data/qc-entry.ts
git commit -m "feat(qc): add search and status filters to fetchQCEntryData"
```

---

## Task 3: Create useFilterParams Hook

**Files:**
- Create: `src/components/qc-entry/use-filter-params.ts`

**Step 1: Create the hook file**

```typescript
'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'

interface UseFilterParamsReturn {
    // Current values from URL
    search: string
    specialty: string | null
    status: string | null
    page: number
    // Local search state for debounce
    searchValue: string
    setSearchValue: (value: string) => void
    // Update functions
    updateParam: (key: string, value: string | null) => void
    // Loading state
    isPending: boolean
}

export function useFilterParams(): UseFilterParamsReturn {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    // Parse current URL params
    const search = searchParams.get('q') ?? ''
    const specialty = searchParams.get('specialty')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') ?? '1', 10)

    // Local state for instant UI feedback on search
    const [searchValue, setSearchValue] = useState(search)

    // Sync local state when URL changes (e.g., browser back)
    useEffect(() => {
        setSearchValue(search)
    }, [search])

    // Debounced URL update for search
    useEffect(() => {
        // Skip if search hasn't changed from URL
        if (searchValue === search) return

        const timer = setTimeout(() => {
            updateParam('q', searchValue || null)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchValue])

    // Generic param updater (resets page to 1)
    const updateParam = useCallback(
        (key: string, value: string | null) => {
            const params = new URLSearchParams(searchParams.toString())

            // Update the target param
            if (value === null || value === '' || value === 'all') {
                params.delete(key)
            } else {
                params.set(key, value)
            }

            // Reset page when filters change (except page itself)
            if (key !== 'page') {
                params.delete('page')
            }

            startTransition(() => {
                const query = params.toString()
                router.replace(query ? `${pathname}?${query}` : pathname)
            })
        },
        [searchParams, pathname, router]
    )

    return {
        search,
        specialty,
        status,
        page,
        searchValue,
        setSearchValue,
        updateParam,
        isPending,
    }
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/qc-entry/use-filter-params.ts
git commit -m "feat(qc): add useFilterParams hook for URL-based filtering"
```

---

## Task 4: Create QCFilterControls Client Component

**Files:**
- Create: `src/components/qc-entry/qc-filter-controls.tsx`

**Step 1: Create the client component**

```typescript
'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useFilterParams } from './use-filter-params'

// ============================================================================
// TYPES
// ============================================================================

interface SpecialtyOption {
    id: string
    name: string
    count: number
}

interface QCFilterControlsProps {
    specialties: SpecialtyOption[]
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_OPTIONS = [
    { value: 'all', label: 'Tất cả trạng thái' },
    { value: 'pending', label: 'Chờ nhập' },
    { value: 'entered', label: 'Đã nhập' },
    { value: 'approved', label: 'Đã duyệt' },
] as const

// ============================================================================
// COMPONENT
// ============================================================================

export function QCFilterControls({ specialties }: QCFilterControlsProps) {
    const {
        specialty,
        status,
        searchValue,
        setSearchValue,
        updateParam,
        isPending,
    } = useFilterParams()

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search input */}
            <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Tìm xét nghiệm..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="pl-9"
                    aria-label="Tìm kiếm xét nghiệm"
                />
            </div>

            {/* Specialty dropdown */}
            <Select
                value={specialty ?? 'all'}
                onValueChange={(value) => updateParam('specialty', value)}
            >
                <SelectTrigger className="w-full sm:w-48" aria-label="Lọc theo chuyên khoa">
                    <SelectValue placeholder="Tất cả chuyên khoa" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Tất cả chuyên khoa</SelectItem>
                    {specialties.map((spec) => (
                        <SelectItem key={spec.id} value={spec.id}>
                            {spec.name} ({spec.count})
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Status dropdown */}
            <Select
                value={status ?? 'all'}
                onValueChange={(value) => updateParam('status', value)}
            >
                <SelectTrigger className="w-full sm:w-40" aria-label="Lọc theo trạng thái">
                    <SelectValue placeholder="Tất cả trạng thái" />
                </SelectTrigger>
                <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Loading indicator (subtle) */}
            {isPending && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            )}
        </div>
    )
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/qc-entry/qc-filter-controls.tsx
git commit -m "feat(qc): add QCFilterControls client component"
```

---

## Task 5: Create QCFilterBar Server Component

**Files:**
- Create: `src/components/qc-entry/qc-filter-bar.tsx`

**Step 1: Create the server component wrapper**

```typescript
import { QCFilterControls } from './qc-filter-controls'
import type { SpecialtyWithQC } from './specialty-filter'

// ============================================================================
// TYPES
// ============================================================================

interface QCFilterBarProps {
    specialties: SpecialtyWithQC[]
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * QC Filter Bar - Server Component
 *
 * Integrated filter bar with search, specialty dropdown, and status dropdown.
 * Replaces the previous SpecialtyFilter pill-based component.
 *
 * All filtering is server-side via URL params.
 */
export function QCFilterBar({ specialties }: QCFilterBarProps) {
    // Transform to format expected by client component
    const specialtyOptions = specialties.map((s) => ({
        id: s.id,
        name: s.name,
        count: s.qc_count,
    }))

    return (
        <nav aria-label="Bộ lọc QC" className="mb-4">
            <QCFilterControls specialties={specialtyOptions} />
        </nav>
    )
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/qc-entry/qc-filter-bar.tsx
git commit -m "feat(qc): add QCFilterBar server component wrapper"
```

---

## Task 6: Update Page Component

**Files:**
- Modify: `src/app/(dashboard)/analyst/qc-entry/page.tsx`

**Step 1: Update imports**

Replace:
```typescript
import { SpecialtyFilter, type SpecialtyWithQC } from '@/components/qc-entry/specialty-filter'
```

With:
```typescript
import { QCFilterBar } from '@/components/qc-entry/qc-filter-bar'
import type { SpecialtyWithQC } from '@/components/qc-entry/specialty-filter'
```

**Step 2: Update SearchParams interface**

```typescript
interface SearchParams {
    specialty?: string
    id?: string
    page?: string
    q?: string        // NEW: search query
    status?: string   // NEW: status filter
}
```

**Step 3: Update fetchQCEntryData call**

Change:
```typescript
fetchQCEntryData({ page, pageSize, specialty: params.specialty }),
```

To:
```typescript
fetchQCEntryData({
    page,
    pageSize,
    specialty: params.specialty,
    search: params.q,
    status: params.status as 'pending' | 'entered' | 'approved' | undefined,
}),
```

**Step 4: Replace SpecialtyFilter with QCFilterBar**

Change:
```tsx
<SpecialtyFilter
    specialties={specialtiesWithCounts}
    activeSpecialty={params.specialty || null}
/>
```

To:
```tsx
<QCFilterBar specialties={specialtiesWithCounts} />
```

**Step 5: Run dev server and test**

Run: `npm run dev`
Test:
1. Type in search → results filter after 300ms
2. Select specialty → results filter immediately
3. Select status → results filter immediately
4. Filters combine correctly
5. Page resets to 1 when filters change

**Step 6: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS

**Step 7: Commit**

```bash
git add src/app/\(dashboard\)/analyst/qc-entry/page.tsx
git commit -m "feat(qc): integrate QCFilterBar into qc-entry page"
```

---

## Task 7: Update Empty State Message

**Files:**
- Modify: `src/components/qc-entry/qc-assay-table.tsx:69-75`

**Step 1: Update empty state to mention filters**

Change:
```tsx
if (assays.length === 0) {
    return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
            Không có xét nghiệm QC
        </div>
    )
}
```

To:
```tsx
if (assays.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <span>Không tìm thấy xét nghiệm phù hợp</span>
            <span className="text-sm">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</span>
        </div>
    )
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/qc-entry/qc-assay-table.tsx
git commit -m "feat(qc): improve empty state message for filtered results"
```

---

## Task 8: Delete Unused SpecialtyFilter Component

**Files:**
- Delete: `src/components/qc-entry/specialty-filter.tsx`

**Step 1: Check for other usages**

Run: `grep -r "specialty-filter" src/`
Expected: Only the page.tsx import (now removed) and possibly index exports

**Step 2: Remove from any barrel exports if present**

Check `src/components/qc-entry/index.ts` if it exists and remove export.

**Step 3: Delete the file**

```bash
rm src/components/qc-entry/specialty-filter.tsx
```

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no remaining references)

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(qc): remove unused SpecialtyFilter component"
```

---

## Task 9: Final Verification

**Step 1: Run full test suite**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: All PASS

**Step 2: Manual testing checklist**

- [ ] Search filters by assay name (debounced)
- [ ] Specialty dropdown shows counts
- [ ] Status dropdown filters correctly
- [ ] Filters can be combined
- [ ] Page resets when filters change
- [ ] Browser back/forward preserves filter state
- [ ] Empty state shows helpful message
- [ ] Responsive layout works on mobile

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(qc): address review feedback"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Update schema | `types/lab.ts` |
| 2 | Add filters to data layer | `lib/data/qc-entry.ts` |
| 3 | Create hook | `components/qc-entry/use-filter-params.ts` |
| 4 | Create client component | `components/qc-entry/qc-filter-controls.tsx` |
| 5 | Create server wrapper | `components/qc-entry/qc-filter-bar.tsx` |
| 6 | Update page | `app/(dashboard)/analyst/qc-entry/page.tsx` |
| 7 | Update empty state | `components/qc-entry/qc-assay-table.tsx` |
| 8 | Delete old component | `components/qc-entry/specialty-filter.tsx` |
| 9 | Final verification | - |

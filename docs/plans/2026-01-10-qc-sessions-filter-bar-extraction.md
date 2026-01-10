# QC Sessions Filter Bar Extraction Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract filter UI from `qc-sessions-table.tsx` (455 lines) into a self-contained `qc-sessions-filter-bar.tsx` component, bringing both files under the 350 line limit.

**Architecture:** Create a new `QCSessionsFilterBar` component that owns its filter UI and URL state management (using `sess_` prefix). The table component receives data via props and focuses on rendering/selection. Components communicate via URL changes, not callbacks.

**Tech Stack:** React 19, Next.js 16 (App Router), TypeScript, Shadcn UI components

---

## Task 1: Create QCSessionsFilterBar Component

**Files:**
- Create: `src/components/qc/qc-sessions-filter-bar.tsx`

**Step 1: Create the new filter bar file with imports and types**

```tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Filter, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { QCSessionFilters } from '@/types/qc'

// ============================================================================
// TYPES
// ============================================================================

interface FilterOption {
    id: string
    name: string
}

interface QCSessionsFilterBarProps {
    specialties: FilterOption[]
    assays: FilterOption[]
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SEARCH_DEBOUNCE_MS = 300

const STATUS_OPTIONS = [
    { value: 'all', label: 'Tất cả' },
    { value: 'pending', label: 'Chờ QC' },
    { value: 'pass', label: 'Đạt' },
    { value: 'warning', label: 'Cảnh báo' },
    { value: 'blocked', label: 'Bị chặn' },
    { value: 'resolved', label: 'Đã xử lý' },
]

const MODE_OPTIONS = [
    { value: 'all', label: 'Tất cả' },
    { value: 'daily', label: 'Hàng ngày' },
    { value: 'batch', label: 'Theo lô' },
    { value: 'shift', label: 'Theo ca' },
]

const ACTIVE_OPTIONS = [
    { value: 'all', label: 'Tất cả' },
    { value: 'active', label: 'Đang hoạt động' },
]
```

**Step 2: Add the FilterSelect sub-component**

```tsx
// ============================================================================
// FILTER SELECT SUB-COMPONENT
// ============================================================================

function FilterSelect({
    label,
    value,
    onChange,
    options,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    options: { value: string; label: string }[]
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs">{label}</Label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="h-9">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
```

**Step 3: Add the main component with URL parsing and state**

```tsx
// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function QCSessionsFilterBar({ specialties, assays }: QCSessionsFilterBarProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Parse filters from URL
    const getFiltersFromURL = useCallback((): QCSessionFilters => ({
        status: (searchParams.get('sess_status') as QCSessionFilters['status']) || undefined,
        session_mode: (searchParams.get('sess_mode') as QCSessionFilters['session_mode']) || undefined,
        assay_id: searchParams.get('sess_assay') || undefined,
        specialty_id: searchParams.get('sess_specialty') || undefined,
        active_only: searchParams.get('sess_active') === 'true',
        search: searchParams.get('sess_search') || undefined,
        page: parseInt(searchParams.get('sess_page') || '1', 10),
        page_size: parseInt(searchParams.get('sess_size') || '20', 10),
    }), [searchParams])

    const [filters, setFilters] = useState<QCSessionFilters>(getFiltersFromURL)
    const [searchInput, setSearchInput] = useState(filters.search || '')
    const [filtersOpen, setFiltersOpen] = useState(false)

    // Sync with URL when searchParams change (e.g., browser back/forward)
    useEffect(() => {
        const newFilters = getFiltersFromURL()
        setFilters(newFilters)
        setSearchInput(newFilters.search || '')
    }, [getFiltersFromURL])

    // Update URL when filters change
    const updateURL = useCallback((newFilters: QCSessionFilters) => {
        const params = new URLSearchParams(searchParams.toString())

        // Clear all sess_ params first
        Array.from(params.keys())
            .filter(key => key.startsWith('sess_'))
            .forEach(key => params.delete(key))

        // Set new sessions params
        if (newFilters.status) params.set('sess_status', newFilters.status)
        if (newFilters.session_mode) params.set('sess_mode', newFilters.session_mode)
        if (newFilters.assay_id) params.set('sess_assay', newFilters.assay_id)
        if (newFilters.specialty_id) params.set('sess_specialty', newFilters.specialty_id)
        if (newFilters.active_only) params.set('sess_active', 'true')
        if (newFilters.search) params.set('sess_search', newFilters.search)
        if (newFilters.page > 1) params.set('sess_page', newFilters.page.toString())
        if (newFilters.page_size !== 20) params.set('sess_size', newFilters.page_size.toString())

        const queryString = params.toString()
        router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
    }, [router, pathname, searchParams])

    // Handle filter change
    const handleFilterChange = useCallback((key: keyof QCSessionFilters, value: unknown) => {
        const newFilters = {
            ...filters,
            [key]: value === 'all' ? undefined : value,
            page: key === 'page' ? (value as number) : 1,
        }
        setFilters(newFilters)
        updateURL(newFilters)
    }, [filters, updateURL])

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput !== (filters.search || '')) {
                handleFilterChange('search', searchInput || undefined)
            }
        }, SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [searchInput]) // eslint-disable-line react-hooks/exhaustive-deps

    // Clear all filters
    const clearFilters = useCallback(() => {
        const defaultFilters: QCSessionFilters = { page: 1, page_size: 20 }
        setFilters(defaultFilters)
        setSearchInput('')
        updateURL(defaultFilters)
    }, [updateURL])

    const hasActiveFilters = useMemo(() =>
        !!(filters.status || filters.session_mode || filters.assay_id ||
           filters.specialty_id || filters.active_only || filters.search),
        [filters]
    )

    const activeFilterCount = useMemo(() =>
        [filters.status, filters.session_mode, filters.assay_id,
         filters.specialty_id, filters.active_only, filters.search].filter(Boolean).length,
        [filters]
    )
```

**Step 4: Add the render JSX**

```tsx
    return (
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1 max-w-sm">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Tìm theo tên xét nghiệm..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Filter className="h-4 w-4 mr-2" />
                            Bộ lọc
                            {hasActiveFilters && (
                                <Badge variant="secondary" className="ml-2">
                                    {activeFilterCount}
                                </Badge>
                            )}
                        </Button>
                    </CollapsibleTrigger>
                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            Xóa lọc
                        </Button>
                    )}
                </div>
            </div>

            <CollapsibleContent className="mt-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 border rounded-lg bg-muted/30">
                    <FilterSelect
                        label="Trạng thái"
                        value={filters.status || 'all'}
                        onChange={(v) => handleFilterChange('status', v)}
                        options={STATUS_OPTIONS}
                    />
                    <FilterSelect
                        label="Chế độ"
                        value={filters.session_mode || 'all'}
                        onChange={(v) => handleFilterChange('session_mode', v)}
                        options={MODE_OPTIONS}
                    />
                    <FilterSelect
                        label="Chuyên khoa"
                        value={filters.specialty_id || 'all'}
                        onChange={(v) => handleFilterChange('specialty_id', v)}
                        options={[
                            { value: 'all', label: 'Tất cả' },
                            ...specialties.map(s => ({ value: s.id, label: s.name })),
                        ]}
                    />
                    <FilterSelect
                        label="Xét nghiệm"
                        value={filters.assay_id || 'all'}
                        onChange={(v) => handleFilterChange('assay_id', v)}
                        options={[
                            { value: 'all', label: 'Tất cả' },
                            ...assays.map(a => ({ value: a.id, label: a.name })),
                        ]}
                    />
                    <FilterSelect
                        label="Hoạt động"
                        value={filters.active_only ? 'active' : 'all'}
                        onChange={(v) => handleFilterChange('active_only', v === 'active')}
                        options={ACTIVE_OPTIONS}
                    />
                </div>
            </CollapsibleContent>
        </Collapsible>
    )
}
```

**Step 5: Verify file compiles**

Run: `npx tsc --noEmit src/components/qc/qc-sessions-filter-bar.tsx`
Expected: No errors

**Step 6: Commit the new component**

```bash
git add src/components/qc/qc-sessions-filter-bar.tsx
git commit -m "feat(qc): add QCSessionsFilterBar component

Extract filter UI into self-contained component with URL state management.
Follows existing pattern from qc-materials-filter-bar.tsx.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Refactor QCSessionsTable to Use New Filter Bar

**Files:**
- Modify: `src/components/qc/qc-sessions-table.tsx`

**Step 1: Update imports - remove filter-related imports, add new component**

Remove these imports:
- `Filter, Search` from lucide-react
- `Input` from ui/input
- `Label` from ui/label
- `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from ui/select
- `Collapsible, CollapsibleContent, CollapsibleTrigger` from ui/collapsible

Add new import:
```tsx
import { QCSessionsFilterBar } from './qc-sessions-filter-bar'
```

Updated imports section should be:
```tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Activity, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTablePagination } from '@/components/ui/data-table-pagination'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { getQCSessionsPaginated } from '@/app/actions/qc-sessions'
import type { QCSessionFilters, QCSessionsResult } from '@/types/qc'
import { QCSessionsFilterBar } from './qc-sessions-filter-bar'
import { SessionRow } from './session-row'
import { StartSessionDialog } from './start-session-dialog'
import { BulkStartSessionDialog } from './bulk-start-dialog'
import { BulkEndSessionDialog } from './bulk-end-dialog'
```

**Step 2: Simplify the component - remove filter state management**

Remove these from the component:
- `useRouter` and `useSearchParams` imports from next/navigation
- `getInitialFilters` callback
- `filters` state (keep only what's needed for fetchData)
- `filtersOpen` state
- `searchInput` state
- `handleFilterChange` callback
- `updateURL` callback
- `clearFilters` function
- `hasActiveFilters` computed value
- The debounced search effect

Keep:
- `data` state
- `loading` state
- `selectedIds` state
- `fetchData` callback (for dialog refresh)
- Selection-related code

The simplified state section:
```tsx
export function QCSessionsTable({
    specialties,
    assays,
    initialData,
    initialFilters,
}: QCSessionsTableProps) {
    const [data, setData] = useState<QCSessionsResult | null>(initialData || null)
    const [loading, setLoading] = useState(!initialData)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Sync state with server-provided data when it changes
    useEffect(() => {
        if (initialData) {
            setData(initialData)
            setLoading(false)
            setSelectedIds(new Set()) // Clear selection on data change
        }
    }, [initialData])

    // Get active sessions for selection
    const activeSessions = useMemo(() =>
        (data?.data || []).filter(s => !s.ended_at),
        [data?.data]
    )

    const selectedSessions = useMemo(() =>
        activeSessions
            .filter(s => selectedIds.has(s.id))
            .map(s => ({ id: s.id, assay_name: s.assay_name })),
        [activeSessions, selectedIds]
    )

    // Fetch data (used by dialogs for refresh after mutations)
    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            // Parse current URL params for filters
            const params = new URLSearchParams(window.location.search)
            const filters: QCSessionFilters = {
                status: (params.get('sess_status') as QCSessionFilters['status']) || undefined,
                session_mode: (params.get('sess_mode') as QCSessionFilters['session_mode']) || undefined,
                assay_id: params.get('sess_assay') || undefined,
                specialty_id: params.get('sess_specialty') || undefined,
                active_only: params.get('sess_active') === 'true',
                search: params.get('sess_search') || undefined,
                page: parseInt(params.get('sess_page') || '1', 10),
                page_size: parseInt(params.get('sess_size') || '20', 10),
            }
            const result = await getQCSessionsPaginated(filters)
            if ('error' in result) {
                console.error('Error:', result.error)
                return
            }
            setData(result)
            setSelectedIds(new Set())
        } finally {
            setLoading(false)
        }
    }, [])

    const toggleSelectAll = () => {
        if (selectedIds.size === activeSessions.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(activeSessions.map(s => s.id)))
        }
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }
```

**Step 3: Update the JSX - replace inline filter UI with component**

Replace the entire Collapsible block (lines 240-337) with:
```tsx
    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                    <QCSessionsFilterBar
                        specialties={specialties}
                        assays={assays}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <StartSessionDialog
                        assays={assays}
                        onSuccess={fetchData}
                    />
                    <BulkStartSessionDialog
                        assays={assays}
                        onSuccess={fetchData}
                    />
                </div>
            </div>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                        Đã chọn {selectedIds.size} phiên
                    </span>
                    <BulkEndSessionDialog
                        sessions={selectedSessions}
                        onSuccess={fetchData}
                        onClear={() => setSelectedIds(new Set())}
                    />
                    <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                        Bỏ chọn
                    </Button>
                </div>
            )}

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10">
                                {activeSessions.length > 0 && (
                                    <Checkbox
                                        checked={selectedIds.size === activeSessions.length && activeSessions.length > 0}
                                        onCheckedChange={toggleSelectAll}
                                        aria-label="Chọn tất cả phiên đang hoạt động"
                                    />
                                )}
                            </TableHead>
                            <TableHead>Xét nghiệm</TableHead>
                            <TableHead>Chế độ</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead>Bắt đầu</TableHead>
                            <TableHead>Kết thúc</TableHead>
                            <TableHead className="text-center">Kết quả</TableHead>
                            <TableHead className="text-center">Vi phạm</TableHead>
                            <TableHead className="text-right">Thao tác</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-32 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                    <span className="text-muted-foreground">Đang tải...</span>
                                </TableCell>
                            </TableRow>
                        ) : data?.data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-32 text-center">
                                    <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                    <span className="text-muted-foreground">Không có phiên QC nào</span>
                                </TableCell>
                            </TableRow>
                        ) : (
                            data?.data.map((session) => (
                                <SessionRow
                                    key={session.id}
                                    session={session}
                                    isSelected={selectedIds.has(session.id)}
                                    onToggleSelect={toggleSelect}
                                    onSessionEnded={fetchData}
                                />
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {data && (
                <DataTablePagination
                    page={data.page}
                    pageSize={data.page_size}
                    total={data.total}
                    paramPrefix="sess_"
                />
            )}
        </div>
    )
}
```

**Step 4: Remove the FilterSelect component from bottom of file**

Delete lines 423-455 (the FilterSelect function) - it's now in the filter bar file.

**Step 5: Remove unused types section**

The `FilterOption` interface is no longer needed in this file (it's defined in filter bar).
Remove the TYPES section comment block and interface.

**Step 6: Verify file compiles and line count**

Run: `npx tsc --noEmit src/components/qc/qc-sessions-table.tsx`
Expected: No errors

Run: `wc -l src/components/qc/qc-sessions-table.tsx` (or PowerShell equivalent)
Expected: ~280 lines (under 350 limit)

**Step 7: Commit the refactored table**

```bash
git add src/components/qc/qc-sessions-table.tsx
git commit -m "refactor(qc): use QCSessionsFilterBar in sessions table

- Remove inline filter UI and state management
- Import and use extracted QCSessionsFilterBar component
- Simplify fetchData to parse filters from URL
- Reduce file from 455 to ~280 lines

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Verify Integration

**Step 1: Run type check on entire project**

Run: `npm run typecheck`
Expected: No errors

**Step 2: Run dev server and test manually**

Run: `npm run dev`

Test checklist:
- [ ] Navigate to QC sessions page
- [ ] Search input filters results
- [ ] Collapsible filter panel opens/closes
- [ ] Each filter dropdown works (status, mode, specialty, assay, active)
- [ ] Clear filters button resets all
- [ ] URL updates with sess_ prefix on filter change
- [ ] Pagination still works
- [ ] Selection checkboxes still work
- [ ] Bulk end session dialog still works
- [ ] Start session dialogs still work

**Step 3: Commit verification**

```bash
git add -A
git commit -m "test: verify QC sessions filter bar integration

Manual testing completed:
- Filter bar works correctly
- URL state management preserved
- Selection and bulk actions work
- Dialogs refresh data correctly

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Summary

| File | Before | After | Change |
|------|--------|-------|--------|
| `qc-sessions-table.tsx` | 455 lines | ~280 lines | -175 lines |
| `qc-sessions-filter-bar.tsx` | N/A | ~150 lines | New file |
| **Total** | 455 lines | ~430 lines | Both under 350 limit ✓ |

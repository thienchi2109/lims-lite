# Sample Filters Refactor Design

**Date:** 2025-12-28
**Status:** Approved
**Goal:** Refactor `sample-filters.tsx` from 604 lines to <350 lines per file, fixing bugs identified by Gemini

## Context

The current `src/components/sample-filters.tsx` is 604 lines - well above the 350-line project limit. Gemini's codebase analysis identified several bugs that should be fixed during refactoring.

### Bugs to Fix

| Bug | Description | Root Cause |
|-----|-------------|------------|
| Aggressive Reset | `handleReset` clears all query params including `pageSize`/`sortBy` | Reset doesn't distinguish filters from view preferences |
| Date Preset Logic | `setDateRange` only updates `fromDate`, leaving stale `toDate` | Incomplete date range updates |
| Search Debounce Interference | Changing filters while typing resets debounce timer | `useEffect` depends on entire `searchParamsString` |
| Prop-State Sync | Multiple `useEffect` hooks cause double-render cycles | 6 separate sync effects for props → state |

## Design Decisions

1. **Colocated folder structure** - Keep related files together in `src/components/sample-filters/`
2. **Balanced extraction** - 5 files: main, hook, 2 sub-components, constants
3. **Custom hook for state** - Single `useFilterParams` hook owns all URL ↔ state sync

## Folder Structure

```
src/components/sample-filters/
├── index.tsx              # Main component (~180 lines)
├── constants.ts           # Configuration (~35 lines)
├── use-filter-params.ts   # Custom hook (~90 lines)
├── FilterPopover.tsx      # Filter panel (~100 lines)
└── ActiveFilterBadges.tsx # Filter chips (~60 lines)
```

**Total: ~465 lines across 5 files, each file well under 350 lines**

## API Design

### useFilterParams Hook

```typescript
type FilterState = {
  search: string
  status: SampleStatus | 'all'
  fromDate: string
  toDate: string
  receiverId: string
  selectedSpecialtyIds: string[]
}

type FilterHandlers = {
  setSearch: (value: string) => void
  setStatus: (value: SampleStatus | 'all') => void
  setDateRange: (range: 'today' | 'yesterday' | 'week' | 'month') => void
  setFromDate: (value: string) => void
  setToDate: (value: string) => void
  setReceiver: (value: string) => void
  toggleSpecialty: (id: string) => void
  resetFilters: () => void  // Preserves pageSize & sortBy
}

type SortState = {
  sortBy: string
  sortOrder: 'asc' | 'desc'
  pageSize: number
  setSortValue: (value: string) => void
  setPageSize: (value: string) => void
}

export function useFilterParams(props: SampleFiltersProps): {
  filters: FilterState
  handlers: FilterHandlers
  sort: SortState
  activeFiltersCount: number
}
```

### FilterPopover Props

```typescript
type FilterPopoverProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void

  // Data
  specialties: LabSpecialty[]
  receiverOptions: Array<{ id: string; name: string }>

  // Filter state
  selectedSpecialtyIds: string[]
  status: SampleStatus | 'all'
  receiverId: string
  fromDate: string
  toDate: string

  // Handlers
  onToggleSpecialty: (id: string) => void
  onStatusChange: (value: SampleStatus | 'all') => void
  onReceiverChange: (value: string) => void
  onFromDateChange: (value: string) => void
  onToDateChange: (value: string) => void
  onDateRangePreset: (range: 'today' | 'yesterday' | 'week' | 'month') => void
  onReset: () => void

  activeFiltersCount: number
}
```

### ActiveFilterBadges Props

```typescript
type ActiveFilterBadgesProps = {
  // Data for display
  specialties: LabSpecialty[]
  selectedSpecialtyIds: string[]
  status: SampleStatus | 'all'
  receiverId: string
  receiverOptions: Array<{ id: string; name: string }>
  fromDate: string
  toDate: string

  // Handlers for removal
  onRemoveSpecialty: (id: string) => void
  onClearStatus: () => void
  onClearReceiver: () => void
  onClearDates: () => void
  onResetAll: () => void
}
```

## Bug Fixes

### 1. Aggressive Reset
**Location:** `use-filter-params.ts` → `resetFilters()`

```typescript
const resetFilters = () => {
  const params = new URLSearchParams(searchParamsString)
  // Only clear filter params
  params.delete('search')
  params.delete('status')
  params.delete('fromDate')
  params.delete('toDate')
  params.delete('receiverId')
  params.delete('specialtyIds')
  params.set('page', '1')
  // Preserve: pageSize, sortBy, sortOrder
  router.replace(params.toString() ? `${pathname}?${params}` : pathname)
}
```

### 2. Date Preset Logic
**Location:** `use-filter-params.ts` → `setDateRange()`

```typescript
const setDateRange = (range: 'today' | 'yesterday' | 'week' | 'month') => {
  const today = new Date()
  let from = new Date()
  let to = new Date()

  switch (range) {
    case 'today':
      // from and to are both today (already set)
      break
    case 'yesterday':
      from.setDate(today.getDate() - 1)
      to.setDate(today.getDate() - 1)
      break
    case 'week':
      from.setDate(today.getDate() - 7)
      // to stays as today
      break
    case 'month':
      from.setDate(1)
      // to stays as today
      break
  }

  const fromStr = from.toISOString().split('T')[0]
  const toStr = to.toISOString().split('T')[0]

  // Always set BOTH dates
  updateUrl({ fromDate: fromStr, toDate: toStr })
}
```

### 3. Search Debounce Interference
**Location:** `use-filter-params.ts`

```typescript
// Isolated debounce effect - only watches searchValue
const [searchValue, setSearchValue] = useState(initialSearch)

useEffect(() => {
  const timer = setTimeout(() => {
    const params = new URLSearchParams(window.location.search)
    const currentSearch = params.get('search') || ''

    if (currentSearch !== searchValue) {
      updateUrl({ search: searchValue || null })
    }
  }, 250)

  return () => clearTimeout(timer)
}, [searchValue]) // Only searchValue, not searchParamsString
```

### 4. Prop-State Sync
**Location:** `use-filter-params.ts`

```typescript
// Single derivation from URL - no sync effects needed
const filters = useMemo(() => {
  const params = new URLSearchParams(searchParamsString)
  return {
    search: params.get('search') || '',
    status: (params.get('status') as SampleStatus) || 'all',
    fromDate: params.get('fromDate') || '',
    toDate: params.get('toDate') || '',
    receiverId: params.get('receiverId') || '',
    selectedSpecialtyIds: params.get('specialtyIds')?.split(',').filter(Boolean) || [],
  }
}, [searchParamsString])

// Exception: search needs local state for debouncing
const [searchValue, setSearchValue] = useState(filters.search)

// Single sync effect for search only (when URL changes externally)
useEffect(() => {
  if (document.activeElement?.getAttribute('data-search-input') !== 'true') {
    setSearchValue(filters.search)
  }
}, [filters.search])
```

## Migration Steps

1. Create folder `src/components/sample-filters/`
2. Create `constants.ts` with extracted config
3. Create `use-filter-params.ts` with bug fixes
4. Create `FilterPopover.tsx` (extract from original lines 298-432)
5. Create `ActiveFilterBadges.tsx` (extract from original lines 467-571)
6. Create `index.tsx` composing everything
7. Update import in `samples-page-client.tsx`
8. Delete old `src/components/sample-filters.tsx`
9. Run typecheck & manual test

## Testing Checklist

- [ ] Search with debounce works correctly
- [ ] Changing filters doesn't interrupt search typing
- [ ] Date presets set both from and to dates
- [ ] Reset clears filters but preserves sort/pageSize
- [ ] Specialty tooltips show inside popover
- [ ] All filter badges display and remove correctly
- [ ] QR scanner still works
- [ ] URL params sync correctly on page refresh

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

type FilterDraft = {
    baseSearch: string
    filters: QCSessionFilters
    searchInput: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SEARCH_DEBOUNCE_MS = 300
const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 20

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

const VALID_SESSION_STATUSES = new Set<NonNullable<QCSessionFilters['status']>>([
    'pending',
    'pass',
    'warning',
    'blocked',
    'resolved',
])

const VALID_SESSION_MODES = new Set<NonNullable<QCSessionFilters['session_mode']>>([
    'daily',
    'batch',
    'shift',
])

function parseEnumParam<T extends string>(
    value: string | null,
    allowed: ReadonlySet<T>
): T | undefined {
    return value && allowed.has(value as T) ? (value as T) : undefined
}

function serializeSessionSearch(search: string): string {
    const params = new URLSearchParams(search)
    const sessionParams = new URLSearchParams()

    for (const [key, value] of params.entries()) {
        if (key.startsWith('sess_')) sessionParams.set(key, value)
    }

    return sessionParams.toString()
}

function parseQCSessionsFilters(params: URLSearchParams): QCSessionFilters {
    const page = Number.parseInt(params.get('sess_page') || String(DEFAULT_PAGE), 10)
    const pageSize = Number.parseInt(params.get('sess_size') || String(DEFAULT_PAGE_SIZE), 10)

    return {
        status: parseEnumParam(params.get('sess_status'), VALID_SESSION_STATUSES),
        session_mode: parseEnumParam(params.get('sess_mode'), VALID_SESSION_MODES),
        assay_id: params.get('sess_assay') || undefined,
        specialty_id: params.get('sess_specialty') || undefined,
        active_only: params.get('sess_active') === 'true',
        search: params.get('sess_search') || undefined,
        page: Number.isFinite(page) && page > 0 ? page : DEFAULT_PAGE,
        page_size: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE,
    }
}

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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function QCSessionsFilterBar({ specialties, assays }: QCSessionsFilterBarProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const currentSearch = searchParams.toString()
    const currentSessionSearch = useMemo(() => serializeSessionSearch(currentSearch), [currentSearch])

    const [filtersOpen, setFiltersOpen] = useState(false)
    const [filterDraft, setFilterDraft] = useState<FilterDraft | null>(null)

    const urlFilters = useMemo(
        () => parseQCSessionsFilters(new URLSearchParams(currentSessionSearch)),
        [currentSessionSearch]
    )

    const filters = filterDraft?.baseSearch === currentSessionSearch ? filterDraft.filters : urlFilters
    const searchInput = filterDraft?.baseSearch === currentSessionSearch
        ? filterDraft.searchInput
        : urlFilters.search || ''

    // Update URL when filters change
    const updateURL = useCallback((newFilters: QCSessionFilters) => {
        const params = new URLSearchParams(currentSearch)

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
        if (newFilters.page_size !== DEFAULT_PAGE_SIZE) params.set('sess_size', newFilters.page_size.toString())

        const queryString = params.toString()
        router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
    }, [router, pathname, currentSearch])

    // Handle filter change
    const handleFilterChange = useCallback((key: keyof QCSessionFilters, value: unknown) => {
        const newFilters: QCSessionFilters = {
            ...filters,
            [key]: value === 'all' ? undefined : value,
            page: key === 'page' ? (value as number) : 1,
        }
        newFilters.search = key === 'search' ? String(value ?? '') || undefined : searchInput || undefined

        setFilterDraft({
            baseSearch: currentSessionSearch,
            filters: newFilters,
            searchInput: key === 'search' ? String(value ?? '') : searchInput,
        })
        updateURL(newFilters)
    }, [currentSessionSearch, filters, searchInput, updateURL])

    const handleSearchInputChange = useCallback((value: string) => {
        setFilterDraft({
            baseSearch: currentSessionSearch,
            filters,
            searchInput: value,
        })
    }, [currentSessionSearch, filters])

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput !== (filters.search || '')) {
                handleFilterChange('search', searchInput || undefined)
            }
        }, SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [filters.search, handleFilterChange, searchInput])

    // Clear all filters
    const clearFilters = useCallback(() => {
        const defaultFilters: QCSessionFilters = { page: DEFAULT_PAGE, page_size: DEFAULT_PAGE_SIZE }
        setFilterDraft({
            baseSearch: currentSessionSearch,
            filters: defaultFilters,
            searchInput: '',
        })
        updateURL(defaultFilters)
    }, [currentSessionSearch, updateURL])

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

    return (
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1 max-w-sm">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Tìm theo tên xét nghiệm..."
                            value={searchInput}
                            onChange={(e) => handleSearchInputChange(e.target.value)}
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

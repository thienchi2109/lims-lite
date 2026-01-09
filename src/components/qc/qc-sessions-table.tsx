'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
    Activity,
    Filter,
    Loader2,
    Search,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTablePagination } from '@/components/ui/data-table-pagination'
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { getQCSessionsPaginated } from '@/app/actions/qc-sessions'
import type { QCSessionFilters, QCSessionsResult } from '@/types/qc'
import { SessionRow } from './session-row'
import { StartSessionDialog } from './start-session-dialog'
import { BulkStartSessionDialog } from './bulk-start-dialog'
import { BulkEndSessionDialog } from './bulk-end-dialog'

// ============================================================================
// TYPES
// ============================================================================

interface FilterOption {
    id: string
    name: string
}

interface QCSessionsTableProps {
    specialties: FilterOption[]
    assays: FilterOption[]
    initialData?: QCSessionsResult
    initialFilters?: Partial<QCSessionFilters>
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QCSessionsTable({
    specialties,
    assays,
    initialData,
    initialFilters,
}: QCSessionsTableProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Parse initial filters from props or URL (props take precedence for SSR)
    const getInitialFilters = useCallback((): QCSessionFilters => {
        if (initialFilters) {
            return {
                status: initialFilters.status,
                session_mode: initialFilters.session_mode,
                assay_id: initialFilters.assay_id,
                specialty_id: initialFilters.specialty_id,
                active_only: initialFilters.active_only ?? false,
                search: initialFilters.search,
                page: initialFilters.page ?? 1,
                page_size: initialFilters.page_size ?? 20,
            }
        }
        // Fallback to URL params with sess_ prefix for server-side pagination
        return {
            status: (searchParams.get('sess_status') as QCSessionFilters['status']) || undefined,
            session_mode: (searchParams.get('sess_mode') as QCSessionFilters['session_mode']) || undefined,
            assay_id: searchParams.get('sess_assay') || undefined,
            specialty_id: searchParams.get('sess_specialty') || undefined,
            active_only: searchParams.get('sess_active') === 'true',
            search: searchParams.get('sess_search') || undefined,
            page: parseInt(searchParams.get('sess_page') || '1', 10),
            page_size: parseInt(searchParams.get('sess_size') || '20', 10),
        }
    }, [searchParams, initialFilters])

    const [filters, setFilters] = useState<QCSessionFilters>(getInitialFilters)
    const [data, setData] = useState<QCSessionsResult | null>(initialData || null)
    const [loading, setLoading] = useState(!initialData)
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [searchInput, setSearchInput] = useState(filters.search || '')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Sync state with server-provided data when it changes
    useEffect(() => {
        if (initialData) {
            setData(initialData)
            setLoading(false)
        }
    }, [initialData])

    // Sync filters with initialFilters when they change (server-side pagination)
    useEffect(() => {
        if (initialFilters) {
            const newFilters = getInitialFilters()
            setFilters(newFilters)
            setSearchInput(newFilters.search || '')
        }
    }, [initialFilters, getInitialFilters])

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

    // Fetch data when filters change
    const fetchData = useCallback(async (newFilters: QCSessionFilters) => {
        setLoading(true)
        try {
            const result = await getQCSessionsPaginated(newFilters)
            if ('error' in result) {
                console.error('Error:', result.error)
                return
            }
            setData(result)
            setSelectedIds(new Set()) // Clear selection on data change
        } finally {
            setLoading(false)
        }
    }, [])

    // Update URL when filters change (uses sess_ prefix for server-side pagination)
    const updateURL = useCallback((newFilters: QCSessionFilters) => {
        // Preserve existing URL params (e.g., materials filters, qc_days)
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
        router.push(queryString ? `?${queryString}` : window.location.pathname, { scroll: false })
    }, [router, searchParams])

    // Handle filter change - update URL for server-side refetch (no client fetchData needed)
    const handleFilterChange = useCallback((key: keyof QCSessionFilters, value: any) => {
        const newFilters = {
            ...filters,
            [key]: value === 'all' ? undefined : value,
            page: key === 'page' ? value : 1,
        }
        setFilters(newFilters)
        updateURL(newFilters)
        // Note: Server-side fetch happens via URL change, no client fetch needed
    }, [filters, updateURL])

    // Handle search with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput !== (filters.search || '')) {
                handleFilterChange('search', searchInput || undefined)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [searchInput]) // eslint-disable-line react-hooks/exhaustive-deps

    // Initial fetch - only if no initial data provided (backward compatibility)
    useEffect(() => {
        if (!initialData) {
            fetchData(filters)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const clearFilters = () => {
        const defaultFilters: QCSessionFilters = { page: 1, page_size: 20 }
        setFilters(defaultFilters)
        setSearchInput('')
        updateURL(defaultFilters)
        // Note: Server-side fetch happens via URL change
    }

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

    const hasActiveFilters = filters.status || filters.session_mode || filters.assay_id ||
        filters.specialty_id || filters.active_only || filters.search

    return (
        <div className="space-y-4">
            {/* Toolbar */}
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
                        <StartSessionDialog
                            assays={assays}
                            onSuccess={() => fetchData(filters)}
                        />
                        <BulkStartSessionDialog
                            assays={assays}
                            onSuccess={() => fetchData(filters)}
                        />
                        <CollapsibleTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Filter className="h-4 w-4 mr-2" />
                                Bộ lọc
                                {hasActiveFilters && (
                                    <Badge variant="secondary" className="ml-2">
                                        {[filters.status, filters.session_mode, filters.assay_id,
                                          filters.specialty_id, filters.active_only].filter(Boolean).length}
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
                            options={[
                                { value: 'all', label: 'Tất cả' },
                                { value: 'pending', label: 'Chờ QC' },
                                { value: 'pass', label: 'Đạt' },
                                { value: 'warning', label: 'Cảnh báo' },
                                { value: 'blocked', label: 'Bị chặn' },
                                { value: 'resolved', label: 'Đã xử lý' },
                            ]}
                        />
                        <FilterSelect
                            label="Chế độ"
                            value={filters.session_mode || 'all'}
                            onChange={(v) => handleFilterChange('session_mode', v)}
                            options={[
                                { value: 'all', label: 'Tất cả' },
                                { value: 'daily', label: 'Hàng ngày' },
                                { value: 'batch', label: 'Theo lô' },
                                { value: 'shift', label: 'Theo ca' },
                            ]}
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
                            options={[
                                { value: 'all', label: 'Tất cả' },
                                { value: 'active', label: 'Đang hoạt động' },
                            ]}
                        />
                    </div>
                </CollapsibleContent>
            </Collapsible>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                        Đã chọn {selectedIds.size} phiên
                    </span>
                    <BulkEndSessionDialog
                        sessions={selectedSessions}
                        onSuccess={() => fetchData(filters)}
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
                                    onSessionEnded={() => fetchData(filters)}
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

// ============================================================================
// FILTER SELECT - Extracted for cleaner code
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

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    Filter,
    Loader2,
    Search,
    XCircle,
} from 'lucide-react'
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
import {
    type QCSessionFilters,
    type QCSessionRow,
    type QCSessionsResult,
} from '@/types/qc'
import { EndSessionDialog } from './end-session-dialog'
import { StartSessionDialog } from './start-session-dialog'

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
}

// ============================================================================
// STATUS CONFIG
// ============================================================================

const STATUS_CONFIG: Record<string, {
    icon: typeof CheckCircle2
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    className?: string
}> = {
    pending: { icon: Clock, label: 'Chờ QC', variant: 'outline' },
    pass: { icon: CheckCircle2, label: 'Đạt', variant: 'default', className: 'bg-green-600' },
    warning: { icon: AlertTriangle, label: 'Cảnh báo', variant: 'secondary', className: 'bg-yellow-500 text-black' },
    blocked: { icon: XCircle, label: 'Bị chặn', variant: 'destructive' },
    resolved: { icon: CheckCircle2, label: 'Đã xử lý', variant: 'outline', className: 'border-green-600 text-green-600' },
}

const SESSION_MODE_LABELS: Record<string, string> = {
    daily: 'Hàng ngày',
    batch: 'Theo lô',
    shift: 'Theo ca',
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QCSessionsTable({
    specialties,
    assays,
    initialData,
}: QCSessionsTableProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Parse initial filters from URL
    const getInitialFilters = useCallback((): QCSessionFilters => ({
        status: (searchParams.get('status') as QCSessionFilters['status']) || undefined,
        session_mode: (searchParams.get('mode') as QCSessionFilters['session_mode']) || undefined,
        assay_id: searchParams.get('assay') || undefined,
        specialty_id: searchParams.get('specialty') || undefined,
        active_only: searchParams.get('active') === 'true',
        search: searchParams.get('search') || undefined,
        page: parseInt(searchParams.get('page') || '1', 10),
        page_size: 20,
    }), [searchParams])

    const [filters, setFilters] = useState<QCSessionFilters>(getInitialFilters)
    const [data, setData] = useState<QCSessionsResult | null>(initialData || null)
    const [loading, setLoading] = useState(!initialData)
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [searchInput, setSearchInput] = useState(filters.search || '')

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
        } finally {
            setLoading(false)
        }
    }, [])

    // Update URL when filters change
    const updateURL = useCallback((newFilters: QCSessionFilters) => {
        const params = new URLSearchParams()
        if (newFilters.status) params.set('status', newFilters.status)
        if (newFilters.session_mode) params.set('mode', newFilters.session_mode)
        if (newFilters.assay_id) params.set('assay', newFilters.assay_id)
        if (newFilters.specialty_id) params.set('specialty', newFilters.specialty_id)
        if (newFilters.active_only) params.set('active', 'true')
        if (newFilters.search) params.set('search', newFilters.search)
        if (newFilters.page > 1) params.set('page', newFilters.page.toString())

        const queryString = params.toString()
        router.push(queryString ? `?${queryString}` : '', { scroll: false })
    }, [router])

    // Handle filter change
    const handleFilterChange = useCallback((key: keyof QCSessionFilters, value: any) => {
        const newFilters = {
            ...filters,
            [key]: value === 'all' ? undefined : value,
            page: key === 'page' ? value : 1, // Reset page when other filters change
        }
        setFilters(newFilters)
        updateURL(newFilters)
        fetchData(newFilters)
    }, [filters, updateURL, fetchData])

    // Handle search with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput !== (filters.search || '')) {
                handleFilterChange('search', searchInput || undefined)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [searchInput]) // eslint-disable-line react-hooks/exhaustive-deps

    // Initial fetch
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
        fetchData(defaultFilters)
    }

    const hasActiveFilters = filters.status || filters.session_mode || filters.assay_id ||
        filters.specialty_id || filters.active_only || filters.search

    return (
        <div className="space-y-4">
            {/* Filters */}
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
                        <div className="space-y-1.5">
                            <Label className="text-xs">Trạng thái</Label>
                            <Select
                                value={filters.status || 'all'}
                                onValueChange={(v) => handleFilterChange('status', v)}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tất cả</SelectItem>
                                    <SelectItem value="pending">Chờ QC</SelectItem>
                                    <SelectItem value="pass">Đạt</SelectItem>
                                    <SelectItem value="warning">Cảnh báo</SelectItem>
                                    <SelectItem value="blocked">Bị chặn</SelectItem>
                                    <SelectItem value="resolved">Đã xử lý</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">Chế độ</Label>
                            <Select
                                value={filters.session_mode || 'all'}
                                onValueChange={(v) => handleFilterChange('session_mode', v)}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tất cả</SelectItem>
                                    <SelectItem value="daily">Hàng ngày</SelectItem>
                                    <SelectItem value="batch">Theo lô</SelectItem>
                                    <SelectItem value="shift">Theo ca</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">Chuyên khoa</Label>
                            <Select
                                value={filters.specialty_id || 'all'}
                                onValueChange={(v) => handleFilterChange('specialty_id', v)}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tất cả</SelectItem>
                                    {specialties.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">Xét nghiệm</Label>
                            <Select
                                value={filters.assay_id || 'all'}
                                onValueChange={(v) => handleFilterChange('assay_id', v)}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tất cả</SelectItem>
                                    {assays.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">Hoạt động</Label>
                            <Select
                                value={filters.active_only ? 'active' : 'all'}
                                onValueChange={(v) => handleFilterChange('active_only', v === 'active')}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tất cả</SelectItem>
                                    <SelectItem value="active">Đang hoạt động</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
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
                                <TableCell colSpan={8} className="h-32 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                    <span className="text-muted-foreground">Đang tải...</span>
                                </TableCell>
                            </TableRow>
                        ) : data?.data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-32 text-center">
                                    <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                    <span className="text-muted-foreground">Không có phiên QC nào</span>
                                </TableCell>
                            </TableRow>
                        ) : (
                            data?.data.map((session) => (
                                <SessionRow
                                    key={session.id}
                                    session={session}
                                    onSessionEnded={() => fetchData(filters)}
                                />
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {data && data.total_pages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Hiển thị {((data.page - 1) * data.page_size) + 1} - {Math.min(data.page * data.page_size, data.total)} trong tổng số {data.total} phiên
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFilterChange('page', data.page - 1)}
                            disabled={data.page <= 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm">
                            Trang {data.page} / {data.total_pages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFilterChange('page', data.page + 1)}
                            disabled={data.page >= data.total_pages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ============================================================================
// SESSION ROW
// ============================================================================

function SessionRow({
    session,
    onSessionEnded,
}: {
    session: QCSessionRow
    onSessionEnded: () => void
}) {
    const statusConfig = STATUS_CONFIG[session.qc_status] || STATUS_CONFIG.pending
    const StatusIcon = statusConfig.icon
    const isActive = !session.ended_at

    return (
        <TableRow>
            <TableCell>
                <div>
                    <div className="font-medium">{session.assay_name}</div>
                    {session.specialty_name && (
                        <div className="text-xs text-muted-foreground">{session.specialty_name}</div>
                    )}
                </div>
            </TableCell>
            <TableCell>
                <Badge variant="outline">
                    {SESSION_MODE_LABELS[session.session_mode] || session.session_mode}
                </Badge>
            </TableCell>
            <TableCell>
                <Badge variant={statusConfig.variant} className={`gap-1 ${statusConfig.className || ''}`}>
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                </Badge>
            </TableCell>
            <TableCell>
                <div className="text-sm">
                    {format(new Date(session.started_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                </div>
                {session.started_by_name && (
                    <div className="text-xs text-muted-foreground">{session.started_by_name}</div>
                )}
            </TableCell>
            <TableCell>
                {session.ended_at ? (
                    <div className="text-sm">
                        {format(new Date(session.ended_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </div>
                ) : (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                        <Activity className="h-3 w-3 mr-1" />
                        Đang hoạt động
                    </Badge>
                )}
            </TableCell>
            <TableCell className="text-center">
                <span className="font-medium">{session.results_count}</span>
            </TableCell>
            <TableCell className="text-center">
                {session.violations_count > 0 ? (
                    <Badge variant="destructive">{session.violations_count}</Badge>
                ) : (
                    <span className="text-muted-foreground">0</span>
                )}
            </TableCell>
            <TableCell className="text-right">
                {isActive && (
                    <EndSessionDialog
                        sessionId={session.id}
                        onSuccess={onSessionEnded}
                    />
                )}
            </TableCell>
        </TableRow>
    )
}

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Activity, Loader2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTablePagination } from '@/components/ui/data-table-pagination'
import { Button } from '@/components/ui/button'
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
import { SessionRow } from './session-row'
import { StartSessionDialog } from './start-session-dialog'
import { BulkStartSessionDialog } from './bulk-start-dialog'
import { BulkEndSessionDialog } from './bulk-end-dialog'
import { QCSessionsFilterBar } from './qc-sessions-filter-bar'

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
// COMPONENT
// ============================================================================

export function QCSessionsTable({
    specialties,
    assays,
    initialData,
}: QCSessionsTableProps) {
    const [data, setData] = useState<QCSessionsResult | null>(initialData || null)
    const [loading, setLoading] = useState(!initialData)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Sync state with server-provided data when it changes
    useEffect(() => {
        if (initialData) {
            setData(initialData)
            setLoading(false)
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

    // Fetch data from server
    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            // Parse filters from URL
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
            setSelectedIds(new Set()) // Clear selection on data change
        } finally {
            setLoading(false)
        }
    }, [])

    // Initial fetch - only if no initial data provided (backward compatibility)
    useEffect(() => {
        if (!initialData) {
            fetchData()
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

    return (
        <div className="space-y-4">
            {/* Filter Bar and Actions */}
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

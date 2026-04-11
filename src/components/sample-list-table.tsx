'use client'

import { useState, type MouseEvent } from 'react'
import {
    useReactTable,
    getCoreRowModel,
    type ColumnDef,
} from '@tanstack/react-table'
import { type SampleWithUser } from '@/types'
import { Button } from '@/components/ui/button'
import { SampleEditDialog } from '@/components/sample-edit-dialog'
import { DiscardSampleDialog } from '@/components/discard-sample-dialog'
import { Eye, Pencil, ClipboardPen, Trash2 } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { markLocalSamplesMutation } from '@/lib/samples-realtime'
import { sampleKeys } from '@/types/query-keys'
import {
    SampleDataGrid,
    SampleIdCell,
    ClientNameCell,
    StatusCell,
    DateCell,
    ReceiverCell,
    ColumnHeader,
    useGridHighlight,
    GRID_LABELS,
    type SortDirection,
} from '@/components/sample-grid'
import type { PendingQueryAction } from '@/components/sample-grid/hooks/usePendingQueryNavigation'

interface SampleListTableProps {
    samples: SampleWithUser[]
    page: number
    pageSize: number
    totalPages: number
    totalCount: number
    permissions?: {
        canDiscard: boolean
        canEdit: boolean
        canViewResults: boolean
        canEnterResults: boolean
    }
    searchParams: string
    error?: string | null
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    selectedSampleId?: string | null
    pendingAction?: PendingQueryAction | null
    onQueryUpdate?: (
        updates: Record<string, string | null>,
        action: PendingQueryAction,
    ) => void
}

export function SampleListTable({
    samples: serverSamples,
    page,
    pageSize,
    totalPages,
    totalCount,
    permissions,
    searchParams,
    error,
    sortBy = 'updated_at',
    sortOrder = 'desc',
    selectedSampleId,
    pendingAction = null,
    onQueryUpdate,
}: SampleListTableProps) {
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [selectedSampleForEdit, setSelectedSampleForEdit] = useState<SampleWithUser | null>(null)
    const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
    const [selectedSampleForDiscard, setSelectedSampleForDiscard] = useState<string | null>(null)

    const router = useRouter()
    const pathname = usePathname()
    const queryClient = useQueryClient()

    // Use shared highlight hook for realtime updates
    const highlightedRowIds = useGridHighlight(serverSamples)

    const updateQuery = (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams)
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                params.delete(key)
            } else {
                params.set(key, value)
            }
        })
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

    const updateListQuery = (
        updates: Record<string, string | null>,
        action: PendingQueryAction,
    ) => {
        if (onQueryUpdate) {
            onQueryUpdate(updates, action)
            return
        }

        updateQuery(updates)
    }

    const handleSort = (column: string) => {
        const isAsc = sortBy === column && sortOrder === 'asc'
        updateListQuery({
            sortBy: column,
            sortOrder: isAsc ? 'desc' : 'asc',
        }, 'filter')
    }

    const handleEditSample = (sample: SampleWithUser) => {
        setSelectedSampleForEdit(sample)
        setEditDialogOpen(true)
    }

    const handleEditSuccess = () => {
        if (!selectedSampleForEdit) return

        const params = new URLSearchParams(searchParams)
        params.set('sortBy', 'updated_at')
        params.set('sortOrder', 'desc')
        params.set('sampleId', selectedSampleForEdit.id)
        params.set('page', '1')
        router.push(`${pathname}?${params.toString()}`)

        markLocalSamplesMutation(selectedSampleForEdit.id)
        queryClient.invalidateQueries({ queryKey: sampleKeys.all })
    }

    const handleRowClick = (sample: SampleWithUser) => {
        updateQuery({ sampleId: sample.id })
    }

    const handlePageChange = (newPage: number) => {
        if (newPage === page || pendingAction !== null) {
            return
        }

        updateListQuery({ page: String(newPage) }, 'page')
    }

    // Helper to get sort direction for a column
    const getSortDirection = (column: string): SortDirection => {
        if (sortBy !== column) return null
        return sortOrder
    }

    const stopRowClick = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation()
    }

    // Define columns using shared cell components
    // Note: Not memoized because action handlers need fresh closures for searchParams.
    // TanStack Table handles column re-renders efficiently.
    const columns: ColumnDef<SampleWithUser>[] = [
        {
            accessorKey: 'sample_id',
            header: GRID_LABELS.columns.sampleId,
            cell: ({ row }) => <SampleIdCell value={row.original.sample_id} />,
        },
        {
            accessorKey: 'client_name',
            header: GRID_LABELS.columns.clientName,
            cell: ({ row }) => <ClientNameCell value={row.original.client_name} />,
        },
        {
            accessorKey: 'status',
            header: GRID_LABELS.columns.status,
            cell: ({ row }) => <StatusCell status={row.original.status} />,
        },
        {
            accessorKey: 'received_at',
            header: () => (
                <ColumnHeader
                    label={GRID_LABELS.columns.receivedAt}
                    sortDirection={getSortDirection('received_at')}
                    onSort={() => handleSort('received_at')}
                />
            ),
            cell: ({ row }) => <DateCell value={row.original.received_at} />,
        },
        {
            accessorKey: 'received_by_name',
            header: GRID_LABELS.columns.receiver,
            cell: ({ row }) => <ReceiverCell receiverName={row.original.received_by_name} />,
        },
        {
            accessorKey: 'updated_at',
            header: () => (
                <ColumnHeader
                    label={GRID_LABELS.columns.updatedAt}
                    sortDirection={getSortDirection('updated_at')}
                    onSort={() => handleSort('updated_at')}
                />
            ),
            cell: ({ row }) => <DateCell value={row.original.updated_at} />,
        },
        {
            id: 'actions',
            header: GRID_LABELS.columns.actions,
            cell: ({ row }) => {
                const status = row.original.status

                // Calculate granular permissions based on status
                const canEdit = permissions?.canEdit && status === 'received'
                const canEnterResults = permissions?.canEnterResults &&
                    ['assigned', 'in_progress'].includes(status)
                const canViewResults = permissions?.canViewResults &&
                    ['assigned', 'in_progress', 'review', 'completed'].includes(status)
                const canDiscard = permissions?.canDiscard &&
                    ['received', 'assigned', 'in_progress'].includes(status)

                return (
                    <div
                        className="flex items-center gap-1"
                        data-stop-row-click="true"
                    >
                        {/* Edit button - Both roles, status-gated */}
                        {canEdit && (
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={(event) => {
                                    stopRowClick(event)
                                    handleEditSample(row.original)
                                }}
                                title="Chỉnh sửa"
                                className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                        )}

                        {/* Enter Results button - Analyst only */}
                        {canEnterResults && (
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={(event) => {
                                    stopRowClick(event)
                                    updateQuery({ sampleId: row.original.id, view: 'results' })
                                }}
                                title="Nhập kết quả"
                                className="h-8 w-8 text-slate-500 hover:text-sky-600 hover:bg-sky-50"
                            >
                                <ClipboardPen className="h-4 w-4" />
                            </Button>
                        )}

                        {/* View Results button - Manager only (when can't enter) */}
                        {canViewResults && !canEnterResults && (
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={(event) => {
                                    stopRowClick(event)
                                    updateQuery({ sampleId: row.original.id, view: 'results' })
                                }}
                                title="Xem kết quả"
                                className="h-8 w-8 text-slate-500 hover:text-sky-600 hover:bg-sky-50"
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                        )}

                        {/* Discard button - Manager only, status-gated */}
                        {canDiscard && (
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={(event) => {
                                    stopRowClick(event)
                                    setSelectedSampleForDiscard(row.original.id)
                                    setDiscardDialogOpen(true)
                                }}
                                title="Loại bỏ mẫu"
                                className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                )
            },
        },
    ]

    const table = useReactTable({
        data: serverSamples,
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount: totalPages,
    })

    // Handle error state
    if (error) {
        return (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-8 text-center text-destructive">
                {error}
            </div>
        )
    }

    return (
        <>
            <SampleDataGrid
                table={table}
                isTransitioning={pendingAction !== null}
                transitionLabel={
                    pendingAction === 'filter'
                        ? GRID_LABELS.pagination.loadingFilter
                        : GRID_LABELS.pagination.loadingPage
                }
                pagination={{
                    mode: 'server',
                    page,
                    totalPages,
                    totalCount,
                    pageSize,
                    onPageChange: handlePageChange,
                    isPending: pendingAction !== null,
                    pendingLabel: pendingAction === 'page' ? GRID_LABELS.pagination.loadingPage : null,
                }}
                selectedRowId={selectedSampleId}
                onRowClick={handleRowClick}
                highlightedRowIds={highlightedRowIds}
                emptyIcon={ClipboardPen}
                emptyMessage="Không tìm thấy mẫu nào. Tạo mẫu đầu tiên để bắt đầu."
            />

            {/* Edit Dialog */}
            {selectedSampleForEdit && (
                <SampleEditDialog
                    key={selectedSampleForEdit.id}
                    sample={selectedSampleForEdit}
                    open={editDialogOpen}
                    onOpenChange={setEditDialogOpen}
                    onSuccess={handleEditSuccess}
                />
            )}

            {/* Discard Dialog */}
            {selectedSampleForDiscard && (
                <DiscardSampleDialog
                    sampleId={selectedSampleForDiscard}
                    open={discardDialogOpen}
                    onOpenChange={setDiscardDialogOpen}
                />
            )}
        </>
    )
}

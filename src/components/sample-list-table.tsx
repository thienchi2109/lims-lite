'use client'

import { useEffect, useState } from 'react'
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    type ColumnDef,
} from '@tanstack/react-table'
import { updateSampleClient } from '@/lib/api-client'
import { type SampleWithUser } from '@/types'
import { formatDate } from '@/lib/utils-lims'
import { Button } from '@/components/ui/button'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SampleStatusBadge } from '@/components/sample-status-badge'
import { EditableCell } from '@/components/editable-cell'
import { SampleEditDialog } from '@/components/sample-edit-dialog'
import { ChevronLeft, ChevronRight, Eye, Pencil, ArrowUpDown, ArrowUp, ArrowDown, ClipboardPen, XCircle } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { sampleKeys } from '@/types/query-keys'

interface SampleListTableProps {
    samples: SampleWithUser[]
    page: number
    pageSize: number
    totalPages: number
    totalCount: number
    permissions?: {
        canReject: boolean
        canIgnore: boolean
        canEdit: boolean
        canViewResults: boolean
        canEnterResults: boolean
    }
    error?: string | null
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    selectedSampleId?: string | null
}

export function SampleListTable({
    samples: serverSamples,
    page,
    pageSize,
    totalPages,
    totalCount,
    permissions,
    error,
    sortBy = 'created_at',
    sortOrder = 'desc',
    selectedSampleId,
}: SampleListTableProps) {
    const [samples, setSamples] = useState<SampleWithUser[]>(serverSamples)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [selectedSampleForEdit, setSelectedSampleForEdit] = useState<SampleWithUser | null>(null)

    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const queryClient = useQueryClient()

    // Keep local state in sync with server data on navigation
    useEffect(() => {
        setSamples(serverSamples)
    }, [serverSamples])

    const handleUpdateCell = async (sampleId: string, field: 'client_name', value: string) => {
        const result = await updateSampleClient({
            id: sampleId,
            [field]: value,
        })

        if (!result.error) {
            // Update local state for optimistic UI
            setSamples((prev) =>
                prev.map((s) => (s.id === sampleId ? { ...s, [field]: value } : s))
            )

            // Apply the same refresh pattern as result saving:
            // 1. Update URL params to sort by updated_at DESC and navigate to page 1
            const params = new URLSearchParams(searchParams?.toString() ?? '')
            params.set('sortBy', 'updated_at')
            params.set('sortOrder', 'desc')
            params.set('sampleId', sampleId)
            params.set('page', '1')
            router.push(`${pathname}?${params.toString()}`)

            // 2. Invalidate TanStack Query cache to trigger refetch
            queryClient.invalidateQueries({ queryKey: sampleKeys.all })
        }

        return result
    }

    const handleEditSample = (sample: SampleWithUser) => {
        setSelectedSampleForEdit(sample)
        setEditDialogOpen(true)
    }

    const handleEditSuccess = () => {
        if (!selectedSampleForEdit) return

        // Apply the same refresh pattern as result saving and inline edit:
        // 1. Update URL params to sort by updated_at DESC and navigate to page 1
        const params = new URLSearchParams(searchParams?.toString() ?? '')
        params.set('sortBy', 'updated_at')
        params.set('sortOrder', 'desc')
        params.set('sampleId', selectedSampleForEdit.id)
        params.set('page', '1')
        router.push(`${pathname}?${params.toString()}`)

        // 2. Invalidate TanStack Query cache to trigger refetch
        queryClient.invalidateQueries({ queryKey: sampleKeys.all })
    }

    const updateQuery = (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString())
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                params.delete(key)
            } else {
                params.set(key, value)
            }
        })
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname)
    }

    const handleSort = (column: string) => {
        const isAsc = sortBy === column && sortOrder === 'asc'
        updateQuery({
            sortBy: column,
            sortOrder: isAsc ? 'desc' : 'asc',
        })
    }

    const handleRowClick = (sample: SampleWithUser, event: React.MouseEvent<HTMLTableRowElement>) => {
        const target = event.target as HTMLElement | null
        const isInteractiveClick = target?.closest('button, a, input, textarea, select, [role="button"], [data-stop-row-click="true"]')
        if (isInteractiveClick) {
            return
        }

        updateQuery({ sampleId: sample.id })
    }

    const columns: ColumnDef<SampleWithUser>[] = [
        {
            accessorKey: 'sample_id',
            header: 'Mã mẫu',
            cell: ({ row }) => (
                <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{row.original.sample_id}</span>
            ),
        },
        {
            accessorKey: 'client_name',
            header: 'Tên khách hàng',
            cell: ({ row }) => (
                <EditableCell
                    value={row.original.client_name || ''}
                    onSave={(newValue) =>
                        handleUpdateCell(row.original.id, 'client_name', newValue)
                    }
                    disabled={!permissions?.canEdit && row.original.status !== 'received'}
                />
            ),
        },
        {
            accessorKey: 'status',
            header: 'Trạng thái',
            cell: ({ row }) => <SampleStatusBadge status={row.original.status} />,
        },
        {
            accessorKey: 'received_at',
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => handleSort('received_at')}
                        className="-ml-4 h-8 data-[state=open]:bg-accent text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 hover:bg-transparent"
                    >
                        Ngày nhận
                        {sortBy === 'received_at' ? (
                            sortOrder === 'asc' ? (
                                <ArrowUp className="ml-2 h-3 w-3" />
                            ) : (
                                <ArrowDown className="ml-2 h-3 w-3" />
                            )
                        ) : (
                            <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
                        )}
                    </Button>
                )
            },
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground font-mono">
                    {formatDate(row.original.received_at)}
                </span>
            ),
        },
        {
            accessorKey: 'received_by_name',
            header: 'Người nhận',
            cell: ({ row }) => (
                <span className="text-sm text-slate-600 dark:text-slate-400">{row.original.received_by_name || 'N/A'}</span>
            ),
        },
        {
            accessorKey: 'updated_at',
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => handleSort('updated_at')}
                        className="-ml-4 h-8 data-[state=open]:bg-accent text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 hover:bg-transparent"
                    >
                        Ngày cập nhật
                        {sortBy === 'updated_at' ? (
                            sortOrder === 'asc' ? (
                                <ArrowUp className="ml-2 h-3 w-3" />
                            ) : (
                                <ArrowDown className="ml-2 h-3 w-3" />
                            )
                        ) : (
                            <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
                        )}
                    </Button>
                )
            },
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground font-mono">
                    {formatDate(row.original.updated_at)}
                </span>
            ),
        },
    ]

    // Add unified actions column with permission-based gating
    columns.push({
        id: 'actions',
        header: 'Hành động',
        cell: ({ row }) => {
            const status = row.original.status

            // Calculate granular permissions based on status
            const canEdit = permissions?.canEdit && status === 'received'
            const canEnterResults = permissions?.canEnterResults &&
                ['assigned', 'in_progress'].includes(status)
            const canViewResults = permissions?.canViewResults &&
                ['assigned', 'in_progress', 'review', 'completed'].includes(status)
            const canReject = permissions?.canReject &&
                ['received', 'assigned'].includes(status)

            return (
                <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                    data-stop-row-click="true"
                >
                    {/* Edit button - Both roles, status-gated */}
                    {canEdit && (
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleEditSample(row.original)}
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
                            onClick={() => updateQuery({ sampleId: row.original.id, view: 'results' })}
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
                            onClick={() => updateQuery({ sampleId: row.original.id, view: 'results' })}
                            title="Xem kết quả"
                            className="h-8 w-8 text-slate-500 hover:text-sky-600 hover:bg-sky-50"
                        >
                            <Eye className="h-4 w-4" />
                        </Button>
                    )}

                    {/* Reject button - Manager only, status-gated */}
                    {canReject && (
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                                // TODO: Implement reject dialog
                                console.log('Reject sample:', row.original.id)
                            }}
                            title="Từ chối"
                            className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                        >
                            <XCircle className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            )
        },
    })

    const table = useReactTable({
        data: samples,
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount: totalPages,
    })

    return (
        <div className="space-y-4 h-full flex flex-col">
            {/* Table */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 flex-1 overflow-auto bg-white dark:bg-slate-950 relative shadow-sm">
                {error ? (
                    <div className="p-8 text-center text-destructive">{error}</div>
                ) : samples.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <ClipboardPen className="h-6 w-6 text-slate-400" />
                        </div>
                        <p>Không tìm thấy mẫu nào. Tạo mẫu đầu tiên để bắt đầu.</p>
                    </div>
                ) : (
                    <table className="w-full caption-bottom text-sm">
                        <TableHeader className="bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60 dark:bg-slate-900/95">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                                    {headerGroup.headers.map((header) => (
                                        <TableHead
                                            key={header.id}
                                            className="sticky top-0 z-20 h-9 bg-slate-50/95 text-xs font-semibold uppercase tracking-wider text-slate-500 backdrop-blur supports-[backdrop-filter]:bg-slate-50/80 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800"
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                            )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows.map((row) => {
                                const isSelected = row.original.id === selectedSampleId
                                return (
                                    <TableRow
                                        key={row.id}
                                        onClick={(event) => handleRowClick(row.original, event)}
                                        className={`cursor-pointer transition-colors border-slate-100 dark:border-slate-800 ${isSelected
                                            ? 'bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30'
                                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/50'
                                            }`}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="py-2">
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {samples.length > 0 && (
                <div className="flex items-center justify-between shrink-0 px-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                            Hiển thị <span className="font-medium text-foreground">{(page - 1) * pageSize + 1}</span> - <span className="font-medium text-foreground">{Math.min(page * pageSize, totalCount)}</span> của <span className="font-medium text-foreground">{totalCount}</span> mẫu
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuery({ page: String(Math.max(1, page - 1)) })}
                            disabled={page === 1}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="text-xs font-medium min-w-[3rem] text-center">
                            {page} / {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuery({ page: String(Math.min(totalPages, page + 1)) })}
                            disabled={page === totalPages}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

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
        </div>
    )
}

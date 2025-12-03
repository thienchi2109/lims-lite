'use client'

import { useEffect, useState } from 'react'
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    type ColumnDef,
} from '@tanstack/react-table'
import { updateSample } from '@/app/actions/samples'
import { type SampleWithUser } from '@/types'
import { formatDate } from '@/lib/utils-lims'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SampleStatusBadge } from '@/components/sample-status-badge'
import { EditableCell } from '@/components/editable-cell'
import { TestAssignmentDialog } from '@/components/test-assignment-dialog'
import { SampleDetailDialog } from '@/components/sample-detail-dialog'
import { SampleEditDialog } from '@/components/sample-edit-dialog'
import { ChevronLeft, ChevronRight, FlaskConical, Eye, Pencil, FileText, ArrowUpDown, ArrowUp, ArrowDown, ClipboardPen } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

interface SampleListTableProps {
    samples: SampleWithUser[]
    page: number
    pageSize: number
    totalPages: number
    totalCount: number
    isManager?: boolean
    error?: string | null
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
}

export function SampleListTable({
    samples: serverSamples,
    page,
    pageSize,
    totalPages,
    totalCount,
    isManager = false,
    error,
    sortBy = 'created_at',
    sortOrder = 'desc',
}: SampleListTableProps) {
    const [samples, setSamples] = useState<SampleWithUser[]>(serverSamples)
    const [assignDialogOpen, setAssignDialogOpen] = useState(false)
    const [detailDialogOpen, setDetailDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [selectedSample, setSelectedSample] = useState<SampleWithUser | null>(null)

    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()

    // Keep local state in sync with server data on navigation
    useEffect(() => {
        setSamples(serverSamples)
    }, [serverSamples])

    const handleUpdateCell = async (sampleId: string, field: 'client_name', value: string) => {
        const result = await updateSample({
            id: sampleId,
            [field]: value,
        })

        if (!result.error) {
            // Update local state
            setSamples((prev) =>
                prev.map((s) => (s.id === sampleId ? { ...s, [field]: value } : s))
            )
        }

        return result
    }

    const handleAssignTests = (sample: SampleWithUser) => {
        setSelectedSample(sample)
        setAssignDialogOpen(true)
    }

    const handleAssignSuccess = () => {
        setAssignDialogOpen(false)
        router.refresh()
    }

    const handleViewDetail = (sample: SampleWithUser) => {
        setSelectedSample(sample)
        setDetailDialogOpen(true)
        updateQuery({ sampleId: sample.id })
    }

    const handleEditSample = (sample: SampleWithUser) => {
        setSelectedSample(sample)
        setEditDialogOpen(true)
    }

    const handleEditSuccess = () => {
        router.refresh()
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

    // Auto-open detail dialog when sampleId is present in query (e.g., after creation)
    useEffect(() => {
        const sampleId = searchParams.get('sampleId')
        if (sampleId) {
            const sample = samples.find((s) => s.id === sampleId)
            if (sample) {
                setSelectedSample(sample)
                setDetailDialogOpen(true)
            }
        }
    }, [searchParams, samples])

    const handleDetailOpenChange = (open: boolean) => {
        setDetailDialogOpen(open)
        if (!open) {
            updateQuery({ sampleId: null })
        }
    }

    const columns: ColumnDef<SampleWithUser>[] = [
        {
            accessorKey: 'sample_id',
            header: 'Mã mẫu',
            cell: ({ row }) => (
                <span className="font-mono font-medium">{row.original.sample_id}</span>
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
                    disabled={!isManager && row.original.status !== 'received'}
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
                        className="-ml-4 h-8 data-[state=open]:bg-accent"
                    >
                        Ngày nhận
                        {sortBy === 'received_at' ? (
                            sortOrder === 'asc' ? (
                                <ArrowUp className="ml-2 h-4 w-4" />
                            ) : (
                                <ArrowDown className="ml-2 h-4 w-4" />
                            )
                        ) : (
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        )}
                    </Button>
                )
            },
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground">
                    {formatDate(row.original.received_at)}
                </span>
            ),
        },
        {
            accessorKey: 'received_by_name',
            header: 'Người nhận',
            cell: ({ row }) => (
                <span className="text-sm">{row.original.received_by_name || 'N/A'}</span>
            ),
        },
    ]

    // Add actions column based on role
    if (isManager) {
        columns.push({
            id: 'actions',
            header: 'Hành động',
            cell: ({ row }) => {
                const canViewResults = ['assigned', 'in_progress', 'review', 'completed'].includes(row.original.status)

                return (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleViewDetail(row.original)}
                            title="Chi tiết mẫu"
                        >
                            <FileText className="h-4 w-4" />
                        </Button>
                        {canViewResults && (
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => window.location.href = `/manager/results/${row.original.id}`}
                                title="Xem kết quả"
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleAssignTests(row.original)}
                            disabled={row.original.status === 'completed'}
                            title="Chỉ định xét nghiệm"
                        >
                            <FlaskConical className="h-4 w-4" />
                        </Button>
                    </div>
                )
            },
        })
    } else {
        // Analyst actions
        columns.push({
            id: 'actions',
            header: 'Hành động',
            cell: ({ row }) => {
                const canEnterResults = ['assigned', 'in_progress'].includes(row.original.status)
                const isReceived = row.original.status === 'received'

                return (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleViewDetail(row.original)}
                            title="Chi tiết mẫu"
                        >
                            <FileText className="h-4 w-4" />
                        </Button>
                        {isReceived && (
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleEditSample(row.original)}
                                title="Chỉnh sửa"
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                        )}
                        {canEnterResults && (
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => window.location.href = `/analyst/results/${row.original.id}`}
                                title="Nhập kết quả"
                            >
                                <ClipboardPen className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                )
            },
        })
    }

    const table = useReactTable({
        data: samples,
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount: totalPages,
    })

    return (
        <div className="space-y-4">
            {/* Table */}
            <div className="rounded-md border">
                {error ? (
                    <div className="p-8 text-center text-destructive">{error}</div>
                ) : samples.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        Không tìm thấy mẫu nào. Tạo mẫu đầu tiên để bắt đầu.
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id}>
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
                            {table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            {/* Pagination */}
            {samples.length > 0 && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>
                            {(page - 1) * pageSize + 1} -{' '}
                            {Math.min(page * pageSize, totalCount)} của {totalCount} mẫu
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuery({ page: String(Math.max(1, page - 1)) })}
                            disabled={page === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Trước
                        </Button>
                        <div className="text-sm">
                            Trang {page} của {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuery({ page: String(Math.min(totalPages, page + 1)) })}
                            disabled={page === totalPages}
                        >
                            Tiếp
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Test Assignment Dialog */}
            {selectedSample && (
                <>
                    <TestAssignmentDialog
                        sampleId={selectedSample.id}
                        sampleName={selectedSample.sample_id}
                        open={assignDialogOpen}
                        onOpenChange={setAssignDialogOpen}
                        onSuccess={handleAssignSuccess}
                    />
                    <SampleDetailDialog
                        sample={selectedSample}
                        open={detailDialogOpen}
                        onOpenChange={handleDetailOpenChange}
                    />
                    <SampleEditDialog
                        key={selectedSample.id}
                        sample={selectedSample}
                        open={editDialogOpen}
                        onOpenChange={setEditDialogOpen}
                        onSuccess={handleEditSuccess}
                    />
                </>
            )}
        </div>
    )
}

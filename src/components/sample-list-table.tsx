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
import { ChevronLeft, ChevronRight, FlaskConical } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

interface SampleListTableProps {
    samples: SampleWithUser[]
    page: number
    pageSize: number
    totalPages: number
    totalCount: number
    isManager?: boolean
    error?: string | null
}

export function SampleListTable({
    samples: serverSamples,
    page,
    pageSize,
    totalPages,
    totalCount,
    isManager = false,
    error,
}: SampleListTableProps) {
    const [samples, setSamples] = useState<SampleWithUser[]>(serverSamples)
    const [assignDialogOpen, setAssignDialogOpen] = useState(false)
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

    const updateQuery = (nextPage: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', String(nextPage))
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname)
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
            header: 'Ngày nhận',
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
                    <div className="flex items-center gap-2">
                        {canViewResults && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.location.href = `/manager/results/${row.original.id}`}
                            >
                                Xem kết quả
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAssignTests(row.original)}
                            disabled={row.original.status === 'completed'}
                        >
                            <FlaskConical className="h-4 w-4 mr-2" />
                            Chỉ định xét nghiệm
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

                if (!canEnterResults) return null

                return (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = `/analyst/results/${row.original.id}`}
                    >
                        Nhập kết quả
                    </Button>
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
                    <div className="text-sm text-muted-foreground">
                        Hiển thị {(page - 1) * pageSize + 1} đến{' '}
                        {Math.min(page * pageSize, totalCount)} của {totalCount} mẫu
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuery(Math.max(1, page - 1))}
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
                            onClick={() => updateQuery(Math.min(totalPages, page + 1))}
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
                <TestAssignmentDialog
                    sampleId={selectedSample.id}
                    sampleName={selectedSample.sample_id}
                    open={assignDialogOpen}
                    onOpenChange={setAssignDialogOpen}
                    onSuccess={handleAssignSuccess}
                />
            )}
        </div>
    )
}

'use client'

import { useState } from 'react'
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    useReactTable,
} from '@tanstack/react-table'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, ClipboardPen } from 'lucide-react'
import { SampleStatusBadge } from '@/components/sample-status-badge'
import { type SampleStatus } from '@/types'

// Type for approval queue data
interface ApprovalQueueSample {
    id: string
    sample_id: string
    client_name: string | null
    status: SampleStatus
    received_at: string
    updated_at: string
    received_by_name: string | null
    total_tests: number
    entered_count: number
    approved_count: number
    pending_count: number
}

interface ApprovalQueueTableProps {
    data: ApprovalQueueSample[]
    selectedSampleId?: string
}

export function ApprovalQueueTable({ data, selectedSampleId }: ApprovalQueueTableProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Client-side pagination state
    const [pageIndex, setPageIndex] = useState(0)
    const [pageSize, setPageSize] = useState(20)

    const handleRowClick = (sampleId: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('sampleId', sampleId)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const columns: ColumnDef<ApprovalQueueSample>[] = [
        {
            accessorKey: 'sample_id',
            header: 'Mã mẫu',
            cell: ({ row }) => (
                <span className="font-mono font-medium text-slate-700 dark:text-slate-200">
                    {row.getValue('sample_id')}
                </span>
            ),
        },
        {
            accessorKey: 'client_name',
            header: 'Khách hàng',
            cell: ({ row }) => (
                <span className="text-sm text-slate-900 dark:text-slate-100">
                    {row.getValue('client_name') || '-'}
                </span>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Trạng thái',
            cell: ({ row }) => (
                <SampleStatusBadge status={row.getValue('status')} />
            ),
        },
        {
            id: 'progress',
            header: 'Tiến độ',
            cell: ({ row }) => {
                const { entered_count, approved_count, total_tests } = row.original
                const completedCount = entered_count + approved_count

                return (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                            {completedCount}/{total_tests} xét nghiệm
                        </span>
                        <div className="flex gap-1">
                            {entered_count > 0 && (
                                <Badge variant="secondary" className="text-xs font-normal">
                                    {entered_count} đã nhập
                                </Badge>
                            )}
                            {approved_count > 0 && (
                                <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700 font-normal">
                                    {approved_count} đã duyệt
                                </Badge>
                            )}
                        </div>
                    </div>
                )
            },
        },
        {
            accessorKey: 'received_at',
            header: 'Ngày nhận',
            cell: ({ row }) => {
                const date = new Date(row.getValue('received_at'))
                return (
                    <span className="text-sm text-muted-foreground font-mono">
                        {format(date, 'HH:mm, dd/MM/yyyy')}
                    </span>
                )
            },
        },
        {
            accessorKey: 'updated_at',
            header: 'Ngày cập nhật',
            cell: ({ row }) => {
                const date = new Date(row.getValue('updated_at'))
                return (
                    <span className="text-sm text-muted-foreground font-mono">
                        {format(date, 'HH:mm, dd/MM/yyyy')}
                    </span>
                )
            },
        },
        {
            id: 'actions',
            header: 'Hành động',
            cell: ({ row }) => {
                return (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation()
                            handleRowClick(row.original.id)
                        }}
                        className="h-8 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    >
                        Xem xét
                    </Button>
                )
            },
        },
    ]

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        state: {
            pagination: {
                pageIndex,
                pageSize,
            },
        },
        onPaginationChange: (updater) => {
            if (typeof updater === 'function') {
                const newState = updater({ pageIndex, pageSize })
                setPageIndex(newState.pageIndex)
                setPageSize(newState.pageSize)
            } else {
                setPageIndex(updater.pageIndex)
                setPageSize(updater.pageSize)
            }
        },
    })

    const totalCount = data.length
    const pageCount = table.getPageCount()
    const currentPage = table.getState().pagination.pageIndex + 1

    return (
        <div className="space-y-4 h-full flex flex-col">
            {/* Table */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 flex-1 overflow-auto bg-white dark:bg-slate-950 relative shadow-sm">
                {data.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <ClipboardPen className="h-6 w-6 text-slate-400" />
                        </div>
                        <p>Không có mẫu nào chờ phê duyệt</p>
                    </div>
                ) : (
                    <table className="w-full caption-bottom text-sm">
                        <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60 dark:bg-slate-900/95 z-20 shadow-sm border-b border-slate-200 dark:border-slate-800">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id} className="h-9 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                                        onClick={() => handleRowClick(row.original.id)}
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
            {data.length > 0 && (
                <div className="flex items-center justify-between shrink-0 px-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                            Hiển thị <span className="font-medium text-foreground">{Math.min((currentPage - 1) * pageSize + 1, totalCount)}</span> - <span className="font-medium text-foreground">{Math.min(currentPage * pageSize, totalCount)}</span> của <span className="font-medium text-foreground">{totalCount}</span> mẫu
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="text-xs font-medium min-w-[3rem] text-center">
                            {currentPage} / {pageCount}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}


'use client'

import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

// Type for approval queue data
interface ApprovalQueueSample {
    id: string
    sample_id: string
    client_name: string | null
    status: string
    received_at: string
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

    const handleRowClick = (sampleId: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('sampleId', sampleId)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const columns: ColumnDef<ApprovalQueueSample>[] = [
        {
            accessorKey: 'sample_id',
            header: 'Mã mẫu',
            cell: ({ row }) => {
                return (
                    <span className="font-medium text-primary">
                        {row.getValue('sample_id')}
                    </span>
                )
            },
        },
        {
            accessorKey: 'client_name',
            header: 'Khách hàng',
            cell: ({ row }) => row.getValue('client_name') || '-',
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
                                <Badge variant="secondary" className="text-xs">
                                    {entered_count} đã nhập
                                </Badge>
                            )}
                            {approved_count > 0 && (
                                <Badge variant="default" className="text-xs bg-green-600">
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
            header: 'Đã nhận',
            cell: ({ row }) => {
                const date = new Date(row.getValue('received_at'))
                return (
                    <div className="flex flex-col">
                        <span className="text-sm">{format(date, 'MMM d, yyyy')}</span>
                        <span className="text-xs text-muted-foreground">{format(date, 'HH:mm')}</span>
                    </div>
                )
            },
        },
        {
            id: 'actions',
            header: 'Hành động',
            cell: ({ row }) => {
                return (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation()
                            handleRowClick(row.original.id)
                        }}
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
    })

    if (data.length === 0) {
        return (
            <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-muted-foreground">Không có mẫu nào chờ phê duyệt</p>
            </div>
        )
    }

    return (
        <div className="rounded-md border bg-white dark:bg-slate-900 h-full overflow-auto">
            <Table>
                <TableHeader className="sticky top-0 bg-white dark:bg-slate-900 z-10 shadow-sm">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <TableHead key={header.id}>
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(header.column.columnDef.header, header.getContext())}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows.map((row) => (
                        <TableRow
                            key={row.id}
                            className={cn(
                                'cursor-pointer transition-colors',
                                row.original.id === selectedSampleId
                                    ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border-l-4 border-l-blue-500'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            )}
                            onClick={() => handleRowClick(row.original.id)}
                        >
                            {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

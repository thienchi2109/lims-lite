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
}

export function ApprovalQueueTable({ data }: ApprovalQueueTableProps) {
    const columns: ColumnDef<ApprovalQueueSample>[] = [
        {
            accessorKey: 'sample_id',
            header: 'Mã mẫu',
            cell: ({ row }) => {
                return (
                    <Link
                        href={`/manager/results/${row.original.id}`}
                        className="font-medium text-primary hover:underline"
                    >
                        {row.getValue('sample_id')}
                    </Link>
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
                    <Link href={`/manager/results/${row.original.id}`}>
                        <Button variant="outline" size="sm">
                            Xem xét & Phê duyệt
                        </Button>
                    </Link>
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
        <div className="rounded-md border">
            <Table>
                <TableHeader>
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
                        <TableRow key={row.id}>
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

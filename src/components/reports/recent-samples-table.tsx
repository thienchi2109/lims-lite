'use client'

import { useMemo, useState } from 'react'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { SampleStatusBadge } from '@/components/sample-status-badge'
import { type SampleStatus } from '@/types'

// Type for recent samples data
export interface RecentSampleData {
  id: string
  sample_id: string
  client_name: string | null
  status: SampleStatus
  received_at: string
  approved_at: string | null
  tat_hours: number | null
}

interface RecentSamplesTableProps {
  data: RecentSampleData[]
  statusFilter?: SampleStatus | null
}

export function RecentSamplesTable({ data, statusFilter }: RecentSamplesTableProps) {
  // Filter data by status if provided (from chart click)
  const filteredData = useMemo(() => {
    if (!statusFilter) return data
    return data.filter(sample => sample.status === statusFilter)
  }, [data, statusFilter])

  // Default sorting: TAT descending (longest first)
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'tat_hours', desc: true }
  ])

  const columns: ColumnDef<RecentSampleData>[] = [
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
      accessorKey: 'received_at',
      header: 'Ngày nhận',
      cell: ({ row }) => {
        const date = new Date(row.getValue('received_at'))
        return (
          <span className="text-sm text-muted-foreground font-mono">
            {format(date, 'dd/MM/yyyy HH:mm')}
          </span>
        )
      },
    },
    {
      accessorKey: 'approved_at',
      header: 'Ngày duyệt',
      cell: ({ row }) => {
        const dateValue = row.getValue('approved_at') as string | null
        if (!dateValue) {
          return <span className="text-sm text-muted-foreground">-</span>
        }
        const date = new Date(dateValue)
        return (
          <span className="text-sm text-muted-foreground font-mono">
            {format(date, 'dd/MM/yyyy HH:mm')}
          </span>
        )
      },
    },
    {
      accessorKey: 'tat_hours',
      header: 'TAT',
      cell: ({ row }) => {
        const tatHours = row.getValue('tat_hours') as number | null

        if (tatHours === null) {
          return <span className="text-sm text-muted-foreground">-</span>
        }

        // Format TAT display
        const days = Math.floor(tatHours / 24)
        const hours = Math.floor(tatHours % 24)

        // Color code based on SLA (72h = 3 days)
        const isOverdue = tatHours > 72
        const isNearSLA = tatHours > 48 && tatHours <= 72

        return (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-medium',
                isOverdue && 'text-red-600 dark:text-red-400',
                isNearSLA && 'text-amber-600 dark:text-amber-400',
                !isOverdue && !isNearSLA && 'text-green-600 dark:text-green-400'
              )}
            >
              {days > 0 ? `${days}d ${hours}h` : `${hours}h`}
            </span>
          </div>
        )
      },
      sortingFn: (rowA, rowB) => {
        const a = rowA.getValue('tat_hours') as number | null
        const b = rowB.getValue('tat_hours') as number | null

        // Null values go to the end
        if (a === null && b === null) return 0
        if (a === null) return 1
        if (b === null) return -1

        return a - b
      },
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => (
        <SampleStatusBadge status={row.original.status} />
      ),
    },
  ]

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  })

  const totalCount = filteredData.length
  const pageCount = table.getPageCount()
  const currentPage = table.getState().pagination.pageIndex + 1
  const pageSize = table.getState().pagination.pageSize

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Mẫu gần đây
          </h3>
          {statusFilter && (
            <p className="text-sm text-muted-foreground">
              Lọc theo trạng thái: <SampleStatusBadge status={statusFilter} />
            </p>
          )}
        </div>
        {totalCount > 0 && (
          <div className="text-sm text-muted-foreground">
            Tổng: <span className="font-medium text-foreground">{totalCount}</span> mẫu
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 flex-1 overflow-auto bg-white dark:bg-slate-950 relative shadow-sm">
        {filteredData.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <FileText className="h-6 w-6 text-slate-400" />
            </div>
            <p>
              {statusFilter
                ? 'Không có mẫu nào với trạng thái này'
                : 'Không có dữ liệu mẫu trong khoảng thời gian này'}
            </p>
          </div>
        ) : (
          <table className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60 dark:bg-slate-900/95 z-20 shadow-sm border-b border-slate-200 dark:border-slate-800">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="h-9 text-xs font-semibold uppercase tracking-wider text-slate-500"
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
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="transition-colors border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-900/50"
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
              ))}
            </TableBody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {filteredData.length > 0 && pageCount > 1 && (
        <div className="flex items-center justify-between shrink-0 px-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              Hiển thị{' '}
              <span className="font-medium text-foreground">
                {Math.min((currentPage - 1) * pageSize + 1, totalCount)}
              </span>{' '}
              -{' '}
              <span className="font-medium text-foreground">
                {Math.min(currentPage * pageSize, totalCount)}
              </span>{' '}
              của <span className="font-medium text-foreground">{totalCount}</span> mẫu
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

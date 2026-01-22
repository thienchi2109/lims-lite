'use client'

import { flexRender, type Table } from '@tanstack/react-table'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { MotionTableRow } from './MotionTableRow'
import { SampleGridPagination } from './SampleGridPagination'
import { GRID_LABELS } from './constants'
import type { SampleGridRow, PaginationProps } from './types'
import type { LucideIcon } from 'lucide-react'

// Module-level constant to avoid creating new Set on each render
const EMPTY_HIGHLIGHTED_SET: Set<string> = new Set()

interface SampleDataGridProps<T extends SampleGridRow> {
  /** TanStack Table instance (consumer owns this) */
  table: Table<T>
  /** Pagination configuration */
  pagination: PaginationProps<T>
  /** Currently selected row ID */
  selectedRowId?: string | null
  /** Row click handler */
  onRowClick?: (row: T, event: React.MouseEvent<HTMLTableRowElement>) => void
  /** Loading state */
  isLoading?: boolean
  /** Empty state message */
  emptyMessage?: string
  /** Empty state icon */
  emptyIcon?: LucideIcon
  /** Row IDs to highlight (for realtime updates) */
  highlightedRowIds?: Set<string>
  /** Enable Framer Motion animations (default: true) */
  animatedRows?: boolean
  /** Additional className for container */
  className?: string
  /** Sticky header (default: true) */
  stickyHeader?: boolean
}

/**
 * Shared data grid component for sample tables.
 * Consumer owns the useReactTable() call and passes the table instance.
 * Supports both animated rows (Framer Motion) and regular rows.
 *
 * @example
 * ```tsx
 * const table = useReactTable({ data, columns, ... })
 *
 * <SampleDataGrid
 *   table={table}
 *   pagination={{ mode: 'server', page, totalPages, totalCount, pageSize, onPageChange }}
 *   selectedRowId={selectedId}
 *   onRowClick={(row) => setSelectedId(row.id)}
 *   highlightedRowIds={updatedRows}
 * />
 * ```
 */
export function SampleDataGrid<T extends SampleGridRow>({
  table,
  pagination,
  selectedRowId,
  onRowClick,
  isLoading = false,
  emptyMessage = GRID_LABELS.empty.noSamples,
  emptyIcon: EmptyIcon,
  highlightedRowIds = EMPTY_HIGHLIGHTED_SET,
  animatedRows = true,
  className,
  stickyHeader = true,
}: SampleDataGridProps<T>) {
  const rows = table.getRowModel().rows
  const hasData = rows.length > 0

  // Determine if click should be ignored (clicked on interactive element)
  const shouldIgnoreClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    const interactive = target.closest(
      'button, a, input, textarea, select, [role="button"], [data-stop-row-click="true"]'
    )
    return interactive !== null
  }

  const handleRowClick = (row: T, event: React.MouseEvent<HTMLTableRowElement>) => {
    if (shouldIgnoreClick(event)) return
    onRowClick?.(row, event)
  }

  // Render table row - either animated or regular
  const renderRow = (row: ReturnType<typeof table.getRowModel>['rows'][0]) => {
    const isSelected = row.original.id === selectedRowId
    const isHighlighted = highlightedRowIds.has(row.original.id)

    const rowContent = row.getVisibleCells().map((cell) => (
      <TableCell key={cell.id} className="py-2">
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </TableCell>
    ))

    if (animatedRows) {
      return (
        <MotionTableRow
          key={row.id}
          isSelected={isSelected}
          isHighlighted={isHighlighted}
          onClick={(e) => handleRowClick(row.original, e as React.MouseEvent<HTMLTableRowElement>)}
        >
          {rowContent}
        </MotionTableRow>
      )
    }

    return (
      <TableRow
        key={row.id}
        onClick={(e) => handleRowClick(row.original, e)}
        className={cn(
          'cursor-pointer transition-colors border-slate-100 dark:border-slate-800',
          isSelected
            ? 'bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30'
            : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/50'
        )}
      >
        {rowContent}
      </TableRow>
    )
  }

  return (
    <div className={cn('space-y-4 h-full flex flex-col', className)}>
      {/* Table Container */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 flex-1 overflow-auto bg-white dark:bg-slate-950 relative shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            <p>Đang tải...</p>
          </div>
        ) : !hasData ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
            {EmptyIcon && (
              <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <EmptyIcon className="h-6 w-6 text-slate-400" />
              </div>
            )}
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <table className="w-full caption-bottom text-sm">
            <TableHeader
              className={cn(
                stickyHeader &&
                  'sticky top-0 bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60 dark:bg-slate-900/95 z-20 shadow-sm border-b border-slate-200 dark:border-slate-800'
              )}
            >
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="h-9 text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>{rows.map(renderRow)}</TableBody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {hasData && !isLoading && <SampleGridPagination {...pagination} />}
    </div>
  )
}

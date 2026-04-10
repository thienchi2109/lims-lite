'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { GRID_LABELS } from './constants'
import type { ServerPagination, ClientPagination } from './types'

type SampleGridPaginationProps<T> = ServerPagination | ClientPagination<T>

function assertNever(x: never): never {
  throw new Error(`Unexpected pagination mode: ${x}`)
}

export function SampleGridPagination<T>(props: SampleGridPaginationProps<T>) {
  if (props.mode === 'server') {
    const { page, totalPages, totalCount, pageSize, onPageChange, isPending = false } = props
    const from = Math.min((page - 1) * pageSize + 1, totalCount)
    const to = Math.min(page * pageSize, totalCount)

    return (
      <div className="flex items-center justify-between shrink-0 px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {GRID_LABELS.pagination.showing}{' '}
            <span className="font-medium text-foreground">{from}</span> -{' '}
            <span className="font-medium text-foreground">{to}</span>{' '}
            {GRID_LABELS.pagination.of}{' '}
            <span className="font-medium text-foreground">{totalCount}</span>{' '}
            {GRID_LABELS.pagination.samples}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isPending && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-sky-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Đang chuyển trang...</span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={isPending || page <= 1}
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
            onClick={() => onPageChange(page + 1)}
            disabled={isPending || page >= totalPages}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  } else if (props.mode === 'client') {
    const { table } = props
    const pageIndex = table.getState().pagination.pageIndex
    const pageSize = table.getState().pagination.pageSize
    const totalCount = table.getFilteredRowModel().rows.length
    const pageCount = table.getPageCount()
    const currentPage = pageIndex + 1
    const from = Math.min(pageIndex * pageSize + 1, totalCount)
    const to = Math.min((pageIndex + 1) * pageSize, totalCount)

    return (
      <div className="flex items-center justify-between shrink-0 px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {GRID_LABELS.pagination.showing}{' '}
            <span className="font-medium text-foreground">{from}</span> -{' '}
            <span className="font-medium text-foreground">{to}</span>{' '}
            {GRID_LABELS.pagination.of}{' '}
            <span className="font-medium text-foreground">{totalCount}</span>{' '}
            {GRID_LABELS.pagination.samples}
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
    )
  } else {
    return assertNever(props)
  }
}

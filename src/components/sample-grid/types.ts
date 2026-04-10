import type { Table } from '@tanstack/react-table'
import type { LucideIcon } from 'lucide-react'
import type { SampleStatus } from '@/types/core'

/** Base row type - all sample grids must extend this */
export interface SampleGridRow {
  id: string
  sample_id: string
  status: SampleStatus
  updated_at: string | null  // Used by useGridHighlight (nullable for rows without updates)
}

/** Server-side pagination props */
export interface ServerPagination {
  mode: 'server'
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
  onPageChange: (page: number) => void
  isPending?: boolean
}

/** Client-side pagination props */
export interface ClientPagination<T> {
  mode: 'client'
  table: Table<T>
}

export type PaginationProps<T> = ServerPagination | ClientPagination<T>

export interface SampleDataGridProps<T extends SampleGridRow> {
  // TanStack Table instance (consumer owns this)
  table: Table<T>

  // Pagination (unified interface)
  pagination: PaginationProps<T>

  // State
  selectedRowId?: string | null
  onRowClick?: (row: T, event: React.MouseEvent<HTMLTableRowElement>) => void

  // Optional features
  isLoading?: boolean
  isTransitioning?: boolean
  emptyMessage?: string
  emptyIcon?: LucideIcon
  highlightedRowIds?: Set<string>
  animatedRows?: boolean  // Enable Framer Motion animations (default: true)

  // Styling
  className?: string
  stickyHeader?: boolean  // Default: true
}

/** Sort direction for column headers */
export type SortDirection = 'asc' | 'desc' | null

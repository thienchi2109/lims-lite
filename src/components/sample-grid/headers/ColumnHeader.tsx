import { memo } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SortDirection } from '../types'

interface ColumnHeaderProps {
  /** Column label text */
  label: string
  /** Current sort direction (null = not sorted, or not sortable) */
  sortDirection?: SortDirection
  /** Click handler for sorting - if undefined, column is not sortable */
  onSort?: () => void
  /** Additional className */
  className?: string
}

/**
 * Reusable column header component with optional sorting support.
 *
 * Usage:
 * // Non-sortable header
 * <ColumnHeader label="Sample ID" />
 *
 * // Sortable header
 * <ColumnHeader
 *   label="Received Date"
 *   sortDirection={currentSort === 'received_at' ? sortOrder : null}
 *   onSort={() => handleSort('received_at')}
 * />
 */
export const ColumnHeader = memo(function ColumnHeader({
  label,
  sortDirection,
  onSort,
  className,
}: ColumnHeaderProps) {
  const isSortable = onSort !== undefined

  // Render sort icon based on direction
  const SortIcon =
    sortDirection === 'asc'
      ? ArrowUp
      : sortDirection === 'desc'
        ? ArrowDown
        : ArrowUpDown

  if (!isSortable) {
    return <span className={className}>{label}</span>
  }

  return (
    <button
      type="button"
      onClick={onSort}
      className={cn(
        'flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 transition-colors',
        className
      )}
    >
      {label}
      <SortIcon
        className={cn(
          'h-3.5 w-3.5',
          sortDirection === null && 'opacity-50'
        )}
      />
    </button>
  )
})

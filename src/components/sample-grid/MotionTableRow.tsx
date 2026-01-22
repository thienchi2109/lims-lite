'use client'

import { forwardRef, memo } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { cn } from '@/lib/utils'
import { rowHighlight } from '@/lib/motion'

interface MotionTableRowProps extends HTMLMotionProps<'tr'> {
  /** Whether this row is currently selected */
  isSelected?: boolean
  /** Whether this row should show highlight animation */
  isHighlighted?: boolean
}

/**
 * Framer Motion-enabled table row component with selection and highlight states
 *
 * @example
 * ```tsx
 * <MotionTableRow
 *   isSelected={row.id === selectedId}
 *   isHighlighted={updatedRows.has(row.id)}
 *   onClick={() => handleRowClick(row)}
 * >
 *   <TableCell>Content</TableCell>
 * </MotionTableRow>
 * ```
 */
export const MotionTableRow = memo(
  forwardRef<HTMLTableRowElement, MotionTableRowProps>(
    function MotionTableRow({ className, isSelected, isHighlighted, ...props }, ref) {
      return (
        <motion.tr
          ref={ref}
          initial={false}
          animate={isHighlighted ? rowHighlight : undefined}
          className={cn(
            'cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800',
            isSelected
              ? 'bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30'
              : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/50',
            className
          )}
          {...props}
        />
      )
    }
  )
)

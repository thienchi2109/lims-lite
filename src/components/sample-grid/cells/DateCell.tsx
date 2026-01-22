import { memo } from 'react'
import { formatDate } from '@/lib/utils-lims'

interface DateCellProps {
  value: string | null
}

export const DateCell = memo(function DateCell({ value }: DateCellProps) {
  if (!value) {
    return (
      <span className="text-sm text-muted-foreground font-mono">
        -
      </span>
    )
  }

  return (
    <span className="text-sm text-muted-foreground font-mono">
      {formatDate(value)}
    </span>
  )
})

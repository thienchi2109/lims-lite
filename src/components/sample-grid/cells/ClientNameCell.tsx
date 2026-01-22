import { memo } from 'react'

interface ClientNameCellProps {
  value: string | null
}

export const ClientNameCell = memo(function ClientNameCell({ value }: ClientNameCellProps) {
  return (
    <span className="text-sm text-slate-700 dark:text-slate-200">
      {value || '-'}
    </span>
  )
})

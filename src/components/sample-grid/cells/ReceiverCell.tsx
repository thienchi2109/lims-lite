import { memo } from 'react'

interface ReceiverCellProps {
  receiverName: string | null
}

export const ReceiverCell = memo(function ReceiverCell({ receiverName }: ReceiverCellProps) {
  return (
    <span className="text-sm text-slate-600 dark:text-slate-400">
      {receiverName || 'N/A'}
    </span>
  )
})

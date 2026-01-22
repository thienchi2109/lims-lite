import { memo } from 'react'

interface SampleIdCellProps {
  value: string
}

export const SampleIdCell = memo(function SampleIdCell({ value }: SampleIdCellProps) {
  return (
    <span className="font-mono font-medium text-slate-700 dark:text-slate-200">
      {value}
    </span>
  )
})

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { GRID_LABELS } from '../constants'

interface ProgressCellProps {
  enteredCount: number
  approvedCount: number
  totalTests: number
}

export const ProgressCell = memo(function ProgressCell({
  enteredCount,
  approvedCount,
  totalTests,
}: ProgressCellProps) {
  const completedCount = enteredCount + approvedCount

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {completedCount}/{totalTests} {GRID_LABELS.progress.tests}
      </span>
      <div className="flex gap-1">
        {enteredCount > 0 && (
          <Badge variant="secondary" className="text-xs font-normal">
            {enteredCount} {GRID_LABELS.progress.entered}
          </Badge>
        )}
        {approvedCount > 0 && (
          <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700 font-normal">
            {approvedCount} {GRID_LABELS.progress.approved}
          </Badge>
        )}
      </div>
    </div>
  )
})

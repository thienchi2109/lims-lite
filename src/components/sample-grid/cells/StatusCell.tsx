import { memo } from 'react'
import { SampleStatusBadge } from '@/components/sample-status-badge'
import { type SampleStatus } from '@/types/core'

interface StatusCellProps {
  status: SampleStatus
}

export const StatusCell = memo(function StatusCell({ status }: StatusCellProps) {
  return <SampleStatusBadge status={status} />
})

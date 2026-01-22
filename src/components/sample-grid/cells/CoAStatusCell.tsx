import { memo } from 'react'
import { CoAStatusBadge } from '@/components/coa-status-badge'
import { type CoAReportStatus } from '@/types'

interface CoAStatusCellProps {
  status: CoAReportStatus | undefined | null
}

export const CoAStatusCell = memo(function CoAStatusCell({ status }: CoAStatusCellProps) {
  return <CoAStatusBadge status={status} />
})

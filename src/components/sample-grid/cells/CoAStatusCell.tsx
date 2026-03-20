import { memo } from 'react'
import { CoAStatusBadge } from '@/components/coa-status-badge'
import { type CoAReportStatus } from '@/types'

interface CoAStatusCellProps {
  status: CoAReportStatus | undefined | null
  errorMessage?: string | null
}

export const CoAStatusCell = memo(function CoAStatusCell({ status, errorMessage }: CoAStatusCellProps) {
  const failedMessage = errorMessage?.trim()
  if (status === 'failed' && failedMessage) {
    return (
      <span title={`Lỗi CoA: ${failedMessage}`}>
        <CoAStatusBadge status={status} />
      </span>
    )
  }

  return <CoAStatusBadge status={status} />
})

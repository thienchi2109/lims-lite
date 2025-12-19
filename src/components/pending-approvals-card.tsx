/**
 * Pending Approvals Card Component
 *
 * Displays pending approval count KPI:
 * - Vietnamese label: "Chờ Phê Duyệt"
 * - Alert if >20 samples OR average wait >24 hours
 * - Shows count and average wait time
 * - Icon: ClipboardCheck (representing approval workflow)
 */

'use client'

import { ClipboardCheck } from 'lucide-react'
import { KPICard } from '@/components/kpi-card'
import { formatDuration, shouldAlertApprovalQueue } from '@/lib/utils-reports'
import type { KPIMetrics } from '@/types'

export interface PendingApprovalsCardProps {
  data: KPIMetrics['pendingApprovals']
  isLoading?: boolean
  onClick?: () => void
}

export function PendingApprovalsCard({ data, isLoading = false, onClick }: PendingApprovalsCardProps) {
  // Check if critical threshold is exceeded
  const isCritical = shouldAlertApprovalQueue(data.count, data.avgWaitHours)

  // Determine gradient based on count and wait time
  const getGradient = (): 'green' | 'yellow' | 'red' => {
    if (isCritical) return 'red'
    if (data.count > 10 || data.avgWaitHours > 12) return 'yellow'
    return 'green'
  }

  const gradient = getGradient()

  // Alert message based on threshold
  const getAlertMessage = (): string | undefined => {
    if (data.count > 20) return `${data.count} mẫu chờ duyệt`
    if (data.avgWaitHours > 24) return `Chờ trung bình ${formatDuration(data.avgWaitHours)}`
    return undefined
  }

  const alertMessage = getAlertMessage()

  return (
    <KPICard
      title="Chờ Phê Duyệt"
      value={data.count}
      unit="mẫu"
      icon={<ClipboardCheck className="h-5 w-5" />}
      gradient={gradient}
      alert={
        isCritical && alertMessage
          ? {
              show: true,
              message: alertMessage,
            }
          : undefined
      }
      isLoading={isLoading}
      onClick={onClick}
    />
  )
}

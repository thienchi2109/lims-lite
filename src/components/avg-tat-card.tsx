/**
 * Average TAT Card Component
 *
 * Displays average turnaround time (TAT) KPI:
 * - Vietnamese label: "TAT Trung Bình"
 * - Alert threshold: >60 hours (2.5 days)
 * - Shows trend vs previous period
 * - Icon: Clock (representing time)
 */

'use client'

import { Clock } from 'lucide-react'
import { KPICard } from '@/components/kpi-card'
import { formatDuration, getTATColor } from '@/lib/utils-reports'
import type { KPIMetrics } from '@/types'

export interface AvgTATCardProps {
  data: KPIMetrics['avgTAT']
  isLoading?: boolean
  onClick?: () => void
}

export function AvgTATCard({ data, isLoading = false, onClick }: AvgTATCardProps) {
  // Alert if TAT exceeds 60 hours (2.5 days)
  const showAlert = data.value > 60

  // Calculate trend direction
  const getTrendDirection = (current: number, previous: number): 'up' | 'down' | 'stable' => {
    const change = current - previous
    if (Math.abs(change) < 1) return 'stable'
    return change > 0 ? 'up' : 'down'
  }

  // Use shared utility with 60h SLA (getTATColor uses 80% threshold = 48h for green)
  const gradient = getTATColor(data.value, 60)
  const trendDirection = getTrendDirection(data.value, data.previousValue)

  return (
    <KPICard
      title="TAT Trung Bình"
      value={formatDuration(data.value)}
      trend={
        data.previousValue > 0
          ? {
              value: data.trend,
              direction: trendDirection,
              label: 'vs kỳ trước',
            }
          : undefined
      }
      trendType="inverse"
      icon={<Clock className="h-5 w-5" />}
      gradient={gradient}
      alert={
        showAlert
          ? {
              show: true,
              message: 'Vượt SLA',
            }
          : undefined
      }
      isLoading={isLoading}
      onClick={onClick}
    />
  )
}

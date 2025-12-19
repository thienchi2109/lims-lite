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
import { formatDuration } from '@/lib/utils-reports'
import type { KPIMetrics } from '@/types'

export interface AvgTATCardProps {
  data: KPIMetrics['avgTAT']
  isLoading?: boolean
  onClick?: () => void
}

export function AvgTATCard({ data, isLoading = false, onClick }: AvgTATCardProps) {
  // Determine gradient color based on TAT value
  // Green: <48h (2 days), Yellow: 48-60h, Red: >60h
  const getTATGradient = (hours: number): 'green' | 'yellow' | 'red' => {
    if (hours < 48) return 'green'
    if (hours <= 60) return 'yellow'
    return 'red'
  }

  // Alert if TAT exceeds 60 hours (2.5 days)
  const showAlert = data.value > 60

  // Calculate trend direction
  const getTrendDirection = (current: number, previous: number): 'up' | 'down' | 'stable' => {
    const change = current - previous
    if (Math.abs(change) < 1) return 'stable'
    // For TAT, increase is bad (down arrow = worse), decrease is good (up arrow = better)
    // But we reverse the display logic to match common KPI conventions
    return change > 0 ? 'up' : 'down'
  }

  const gradient = getTATGradient(data.value)
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

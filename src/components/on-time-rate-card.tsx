/**
 * On-Time Rate Card Component
 *
 * Displays on-time completion rate KPI:
 * - Vietnamese label: "Tỷ Lệ Đúng Hạn"
 * - Color thresholds: Green ≥90%, Yellow 80-89%, Red <80%
 * - Shows trend vs previous period
 * - Icon: Target (representing performance target)
 */

'use client'

import { Target } from 'lucide-react'
import { KPICard } from '@/components/kpi-card'
import type { KPIMetrics } from '@/types'

export interface OnTimeRateCardProps {
  data: KPIMetrics['onTimeRate']
  isLoading?: boolean
  onClick?: () => void
}

export function OnTimeRateCard({ data, isLoading = false, onClick }: OnTimeRateCardProps) {
  // Calculate trend direction
  const getTrendDirection = (trend: number): 'up' | 'down' | 'stable' => {
    if (Math.abs(trend) < 0.5) return 'stable'
    return trend > 0 ? 'up' : 'down'
  }

  const trendDirection = getTrendDirection(data.trend)

  // Gradient is already provided by backend based on thresholds
  const gradient = data.color

  return (
    <KPICard
      title="Tỷ Lệ Đúng Hạn"
      value={data.value.toFixed(1)}
      unit="%"
      trend={{
        value: data.trend,
        direction: trendDirection,
        label: 'vs kỳ trước',
      }}
      icon={<Target className="h-5 w-5" />}
      gradient={gradient}
      isLoading={isLoading}
      onClick={onClick}
    />
  )
}

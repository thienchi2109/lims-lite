/**
 * Error Rate Card Component
 *
 * Displays error rate KPI (from audit logs):
 * - Vietnamese label: "Tỷ Lệ Lỗi"
 * - Shows percentage of modifications vs total results
 * - Lower is better (inverse trend logic)
 * - Shows trend vs previous period
 * - Icon: AlertTriangle (representing errors/corrections)
 */

'use client'

import { AlertTriangle } from 'lucide-react'
import { KPICard } from '@/components/kpi-card'
import type { KPIMetrics } from '@/types'

export interface ErrorRateCardProps {
  data: KPIMetrics['errorRate']
  isLoading?: boolean
  onClick?: () => void
}

export function ErrorRateCard({ data, isLoading = false, onClick }: ErrorRateCardProps) {
  // Calculate trend direction
  const getTrendDirection = (trend: number): 'up' | 'down' | 'stable' => {
    if (Math.abs(trend) < 0.5) return 'stable'
    return trend > 0 ? 'up' : 'down'
  }

  // Determine gradient color based on error rate
  // Lower error rate = better (green)
  const getGradient = (rate: number): 'green' | 'yellow' | 'red' => {
    if (rate < 2) return 'green'
    if (rate < 5) return 'yellow'
    return 'red'
  }

  const trendDirection = getTrendDirection(data.trend)
  const gradient = getGradient(data.value)

  return (
    <KPICard
      title="Tỷ Lệ Lỗi"
      value={data.value.toFixed(1)}
      unit="%"
      trend={{
        value: data.trend,
        direction: trendDirection,
        label: 'vs kỳ trước',
      }}
      trendType="inverse"
      icon={<AlertTriangle className="h-5 w-5" />}
      gradient={gradient}
      isLoading={isLoading}
      onClick={onClick}
    />
  )
}

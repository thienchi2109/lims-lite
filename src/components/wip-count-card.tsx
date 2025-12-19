/**
 * WIP Count Card Component
 *
 * Displays work-in-progress (WIP) sample count KPI:
 * - Vietnamese label: "Mẫu Đang Xử Lý"
 * - Shows breakdown by status
 * - Icon: Package (representing samples)
 */

'use client'

import { Package } from 'lucide-react'
import { KPICard } from '@/components/kpi-card'
import type { KPIMetrics } from '@/types'

export interface WIPCountCardProps {
  data: KPIMetrics['wipCount']
  isLoading?: boolean
  onClick?: () => void
}

export function WIPCountCard({ data, isLoading = false, onClick }: WIPCountCardProps) {
  // Color based on WIP volume (example thresholds - can be adjusted)
  const getGradient = (count: number): 'green' | 'blue' | 'yellow' => {
    if (count < 50) return 'green'
    if (count < 100) return 'blue'
    return 'yellow'
  }

  const gradient = getGradient(data.value)

  return (
    <KPICard
      title="Mẫu Đang Xử Lý"
      value={data.value}
      unit="mẫu"
      icon={<Package className="h-5 w-5" />}
      gradient={gradient}
      isLoading={isLoading}
      onClick={onClick}
    />
  )
}

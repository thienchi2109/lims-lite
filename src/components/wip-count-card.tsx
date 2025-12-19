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

  const statusLabels: Record<string, string> = {
    received: 'Đã nhận',
    assigned: 'Đã chỉ định',
    in_progress: 'Đang thực hiện',
    review: 'Chờ duyệt',
  }

  const breakdownContent = (
    <div className="space-y-1">
      {data.breakdown.map((item) => (
        <div key={item.status} className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {statusLabels[item.status] || item.status}
          </span>
          <span className="font-medium">{item.count}</span>
        </div>
      ))}
    </div>
  )

  return (
    <KPICard
      title="Mẫu Đang Xử Lý"
      value={data.value}
      unit="mẫu"
      icon={<Package className="h-5 w-5" />}
      gradient={gradient}
      extra={breakdownContent}
      isLoading={isLoading}
      onClick={onClick}
    />
  )
}

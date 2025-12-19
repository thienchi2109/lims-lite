/**
 * Sample Status Chart Component
 *
 * Horizontal bar chart showing WIP distribution by status:
 * - Vietnamese status labels (Đã nhận, Đã chỉ định, Đang thực hiện, Chờ duyệt)
 * - Color-coded bars matching KPI card gradients
 * - Shows count for each status
 * - Tooltip with percentage and count
 * - Responsive with loading skeleton and empty state
 */

'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ChartContainer } from '@/components/chart-container'
import { chartConfig, getChartColor, formatVietnameseNumber } from '@/lib/chart-theme'
import type { SampleStatusData } from '@/types'

export interface SampleStatusChartProps {
  data: SampleStatusData[]
  isLoading?: boolean
  height?: number
}

// Vietnamese status labels
const statusLabels: Record<string, string> = {
  received: 'Đã nhận',
  assigned: 'Đã chỉ định',
  in_progress: 'Đang thực hiện',
  review: 'Chờ duyệt',
  completed: 'Hoàn thành',
  discarded: 'Loại bỏ',
}

// Status colors matching LIMS workflow
const statusColors: Record<string, string> = {
  received: getChartColor('blue'),
  assigned: getChartColor('purple'),
  in_progress: getChartColor('yellow'),
  review: getChartColor('orange'),
  completed: getChartColor('green'),
  discarded: getChartColor('gray'),
}

export function SampleStatusChart({
  data,
  isLoading = false,
  height = 300,
}: SampleStatusChartProps) {
  // Format data with Vietnamese labels
  const chartData = data.map(item => ({
    ...item,
    statusLabel: statusLabels[item.status] || item.status,
    color: statusColors[item.status] || getChartColor('gray'),
  }))

  // Calculate total for percentage
  const total = data.reduce((sum, item) => sum + item.count, 0)

  const isEmpty = !isLoading && data.length === 0

  return (
    <ChartContainer
      title="Phân Bổ Trạng Thái Mẫu"
      subtitle="Số lượng mẫu theo từng trạng thái"
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="Chưa có dữ liệu phân bổ"
      height={height}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <CartesianGrid {...chartConfig.grid} horizontal={false} />

          <XAxis
            type="number"
            {...chartConfig.axis}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />

          <YAxis
            type="category"
            dataKey="statusLabel"
            {...chartConfig.axis}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            width={90}
          />

          <Tooltip
            {...chartConfig.tooltip}
            formatter={(value?: number, name?: string, props?: any) => {
              if (value === undefined) return ['', '']
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
              return [
                `${formatVietnameseNumber(value)} mẫu (${percentage}%)`,
                'Số lượng'
              ]
            }}
            labelFormatter={(label) => `${label}`}
          />

          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            maxBarSize={40}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

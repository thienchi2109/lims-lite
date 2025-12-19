/**
 * Staff Productivity Chart Component
 *
 * Grouped bar chart comparing analyst performance (Manager-only feature):
 * - X-axis: Analyst names
 * - Y-axis: Dual metrics (Tests Completed, Results Modified)
 * - Grouped bars with different colors for each metric
 * - Vietnamese labels and tooltips
 * - Tooltip with detailed statistics
 * - Responsive with loading skeleton and empty state
 *
 * NOTE: This component should only be displayed to users with Manager role
 */

'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ChartContainer } from '@/components/chart-container'
import { chartConfig, getChartColor, formatVietnameseNumber } from '@/lib/chart-theme'
import type { StaffProductivityData } from '@/types'

export interface StaffProductivityChartProps {
  data: StaffProductivityData[]
  isLoading?: boolean
  height?: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    dataKey: string
    payload: StaffProductivityData
  }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0].payload

  return (
    <div style={chartConfig.tooltip.contentStyle}>
      <div style={chartConfig.tooltip.labelStyle}>
        Nhà phân tích: {data.analystName}
      </div>
      <div style={{ ...chartConfig.tooltip.itemStyle, color: getChartColor('blue') }}>
        Xét nghiệm hoàn thành: {formatVietnameseNumber(data.testsCompleted)}
      </div>
      <div style={{ ...chartConfig.tooltip.itemStyle, color: getChartColor('purple') }}>
        Kết quả đã sửa: {formatVietnameseNumber(data.resultsModified)}
      </div>
    </div>
  )
}

export function StaffProductivityChart({
  data = [],
  isLoading = false,
  height = 300,
}: StaffProductivityChartProps) {
  const isEmpty = !isLoading && data.length === 0

  return (
    <ChartContainer
      title="Năng Suất Nhà Phân Tích"
      subtitle="So sánh hiệu suất hoàn thành xét nghiệm (Chỉ dành cho Quản lý)"
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="Chưa có dữ liệu năng suất"
      height={height}
      skeletonVariant="bar"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
        >
          <CartesianGrid {...chartConfig.grid} />

          <XAxis
            dataKey="analystName"
            {...chartConfig.axis}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />

          <YAxis
            yAxisId="left"
            {...chartConfig.axis}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            label={{
              value: 'Xét nghiệm',
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' },
            }}
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            {...chartConfig.axis}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            label={{
              value: 'Kết quả sửa',
              angle: 90,
              position: 'insideRight',
              style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' },
            }}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            {...chartConfig.legend}
            formatter={(value) => {
              if (value === 'testsCompleted') return 'Xét nghiệm hoàn thành'
              if (value === 'resultsModified') return 'Kết quả đã sửa'
              return value
            }}
          />

          <Bar
            yAxisId="left"
            dataKey="testsCompleted"
            fill={getChartColor('blue')}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />

          <Bar
            yAxisId="right"
            dataKey="resultsModified"
            fill={getChartColor('purple')}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

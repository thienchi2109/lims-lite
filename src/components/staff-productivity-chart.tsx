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

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
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
    payload: StaffProductivityData & { modificationRate: number }
  }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0].payload

  return (
    <div style={chartConfig.tooltip.contentStyle}>
      <div style={chartConfig.tooltip.labelStyle}>
        KTV: {data.analystName}
      </div>
      <div style={{ ...chartConfig.tooltip.itemStyle, color: getChartColor('blue') }}>
        Xét nghiệm hoàn thành: <span className="font-semibold">{formatVietnameseNumber(data.testsCompleted)}</span>
      </div>
      <div style={{ ...chartConfig.tooltip.itemStyle, color: getChartColor('purple') }}>
        Tỷ lệ sửa đổi: <span className="font-semibold">{data.modificationRate.toFixed(1)}%</span>
      </div>
      <div style={{ ...chartConfig.tooltip.itemStyle, color: 'hsl(var(--muted-foreground))', fontSize: '11px', marginTop: '4px' }}>
        (Đã sửa {formatVietnameseNumber(data.resultsModified)} kết quả)
      </div>
    </div>
  )
}

export function StaffProductivityChart({
  data = [],
  isLoading = false,
  height = 350,
}: StaffProductivityChartProps) {
  const isEmpty = !isLoading && data.length === 0

  // Enrich data with rate calculation
  const chartData = data.map(item => ({
    ...item,
    modificationRate: item.testsCompleted > 0
      ? (item.resultsModified / item.testsCompleted) * 100
      : 0
  }))

  return (
    <ChartContainer
      title="Hiệu suất Kiểm nghiệm viên"
      subtitle="So sánh hiệu suất hoàn thành xét nghiệm (Chỉ dành cho Lãnh đạo khoa XN)"
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="Chưa có dữ liệu năng suất"
      height={height}
      skeletonVariant="bar"
    >
      <ResponsiveContainer width="100%" height={height} minHeight={height} minWidth={0}>
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
        >
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={getChartColor('blue')} stopOpacity={0.8} />
              <stop offset="95%" stopColor={getChartColor('blue')} stopOpacity={0.3} />
            </linearGradient>
          </defs>

          <CartesianGrid {...chartConfig.grid} vertical={false} strokeDasharray="3 3" />

          <XAxis
            dataKey="analystName"
            {...chartConfig.axis}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            dy={10}
          />

          <YAxis
            yAxisId="left"
            {...chartConfig.axis}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(value) => formatVietnameseNumber(value)}
            allowDecimals={false}
            label={{
              value: 'Số lượng mẫu',
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))', fontSize: 11 },
              dy: 0,
              dx: -10
            }}
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            {...chartConfig.axis}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(value) => `${value}%`}
            domain={[0, 'auto']}
            label={{
              value: 'Tỷ lệ sửa đổi (%)',
              angle: 90,
              position: 'insideRight',
              style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))', fontSize: 11 },
              dy: 0,
              dx: 10
            }}
          />

          <Tooltip content={<CustomTooltip />} cursor={chartConfig.tooltip.cursor} />

          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            formatter={(value) => {
              if (value === 'testsCompleted') return <span className="text-slate-600 dark:text-slate-300 font-medium text-sm">Xét nghiệm hoàn thành</span>
              if (value === 'modificationRate') return <span className="text-slate-600 dark:text-slate-300 font-medium text-sm">Tỷ lệ sửa đổi (%)</span>
              return value
            }}
          />

          <Bar
            yAxisId="left"
            dataKey="testsCompleted"
            name="testsCompleted"
            fill="url(#barGradient)"
            radius={[6, 6, 0, 0]}
            maxBarSize={50}
            animationDuration={1500}
          />

          <Line
            yAxisId="right"
            type="monotone"
            dataKey="modificationRate"
            name="modificationRate"
            stroke={getChartColor('purple')}
            strokeWidth={3}
            dot={{ r: 4, fill: getChartColor('purple'), strokeWidth: 2, stroke: 'white' }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            animationDuration={1500}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

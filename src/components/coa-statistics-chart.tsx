/**
 * CoA Statistics Chart Component
 *
 * Donut chart showing Certificate of Analysis (CoA) pipeline funnel:
 * - Segment breakdown: Generated, Pending CoA, Not Approved
 * - Shows count and percentage for each segment
 * - Color-coded segments matching KPI gradients
 * - Center label with total count
 * - Tooltip with detailed statistics
 * - Responsive with loading skeleton and empty state
 */

'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { ChartContainer } from '@/components/chart-container'
import { chartConfig, getChartColor, formatVietnameseNumber } from '@/lib/chart-theme'
import type { CoAStatistics } from '@/types'

export interface CoAStatisticsChartProps {
  data: CoAStatistics[]
  isLoading?: boolean
  height?: number
}

// Vietnamese segment labels
const segmentLabels: Record<string, string> = {
  Generated: 'Đã tạo CoA',
  'Pending CoA': 'Chờ tạo CoA',
  'Not Approved': 'Chưa duyệt',
}

// Segment colors
const segmentColors: Record<string, string> = {
  Generated: getChartColor('green'),
  'Pending CoA': getChartColor('yellow'),
  'Not Approved': getChartColor('orange'),
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    payload: CoAStatistics
  }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0].payload

  return (
    <div
      style={{
        backgroundColor: 'hsl(var(--background))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '6px',
        padding: '8px 12px',
        fontSize: '12px',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '4px' }}>
        {segmentLabels[data.segment] || data.segment}
      </div>
      <div style={{ color: 'hsl(var(--muted-foreground))', padding: '2px 0' }}>
        Số lượng: {formatVietnameseNumber(data.count)}
      </div>
      <div style={{ color: 'hsl(var(--muted-foreground))', padding: '2px 0' }}>
        Tỷ lệ: {data.percentage.toFixed(1)}%
      </div>
    </div>
  )
}

export function CoAStatisticsChart({
  data,
  isLoading = false,
  height = 300,
}: CoAStatisticsChartProps) {
  const chartData = data.map(item => ({
    ...item,
    segmentLabel: segmentLabels[item.segment] || item.segment,
    color: segmentColors[item.segment] || getChartColor('gray'),
  }))

  const total = data.reduce((sum, item) => sum + item.count, 0)
  const isEmpty = !isLoading && data.length === 0

  return (
    <ChartContainer
      title="Thống Kê Certificate of Analysis"
      subtitle="Phân bổ theo giai đoạn xử lý"
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="Chưa có dữ liệu CoA"
      height={height}
      skeletonVariant="donut"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="segmentLabel"
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="80%"
            paddingAngle={2}
            label={(props: any) => {
              const { segmentLabel, percentage } = props as { segmentLabel: string; percentage: number }
              return `${segmentLabel}: ${percentage.toFixed(1)}%`
            }}
            labelLine={{
              stroke: 'hsl(var(--muted-foreground))',
              strokeWidth: 1,
            }}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>

          <Tooltip content={<CustomTooltip />} />

          <Legend
            {...chartConfig.legend}
            verticalAlign="bottom"
            height={36}
            formatter={(value) => value}
          />

          {/* Center label with total count */}
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize: '24px',
              fontWeight: 700,
              fill: 'hsl(var(--foreground))',
            }}
          >
            {formatVietnameseNumber(total)}
          </text>
          <text
            x="50%"
            y="50%"
            dy="1.5em"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize: '12px',
              fill: 'hsl(var(--muted-foreground))',
            }}
          >
            Tổng mẫu
          </text>
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

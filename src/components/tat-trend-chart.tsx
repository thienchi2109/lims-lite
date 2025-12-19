/**
 * TAT Trend Chart Component
 *
 * Line chart showing average TAT over time with SLA reference line:
 * - X-axis: Dates in Vietnamese format (dd/MM)
 * - Y-axis: TAT in hours
 * - Red dotted reference line at 72h (Giới hạn SLA)
 * - Area fill gradient for visual emphasis
 * - Tooltip shows: Ngày / TAT TB / Số mẫu
 * - Responsive with loading skeleton and empty state
 */

'use client'

import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts'
import { ChartContainer } from '@/components/chart-container'
import { chartConfig, getChartColor, formatChartDate, formatVietnameseNumber } from '@/lib/chart-theme'
import type { TATTrendData } from '@/types'

export interface TATTrendChartProps {
  data: TATTrendData[]
  isLoading?: boolean
  slaHours?: number
  height?: number
}

// Custom Tooltip to show Sample Count which isn't a chart series
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as TATTrendData & { dateFormatted: string }
    
    return (
      <div style={chartConfig.tooltip.contentStyle}>
        <p style={chartConfig.tooltip.labelStyle}>Ngày: {label}</p>
        <div style={chartConfig.tooltip.itemStyle}>
          <span className="font-medium">TAT TB:</span> {data.avgTATHours.toFixed(1)} giờ
        </div>
        <div style={chartConfig.tooltip.itemStyle}>
          <span className="font-medium">Số mẫu:</span> {formatVietnameseNumber(data.sampleCount)}
        </div>
      </div>
    )
  }
  return null
}

export function TATTrendChart({
  data,
  isLoading = false,
  slaHours = 72,
  height = 300,
}: TATTrendChartProps) {
  // Format data for chart (convert date strings to dd/MM format)
  const chartData = data.map(item => ({
    ...item,
    dateFormatted: formatChartDate(item.date),
  }))

  const isEmpty = !isLoading && data.length === 0

  return (
    <ChartContainer
      title="TAT Trung Bình Theo Thời Gian"
      subtitle="Thời gian xử lý mẫu trung bình (giờ)"
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="Chưa có dữ liệu TAT"
      height={height}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="tatGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={getChartColor('blue')} stopOpacity={0.3} />
              <stop offset="95%" stopColor={getChartColor('blue')} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid {...chartConfig.grid} />

          <XAxis
            dataKey="dateFormatted"
            {...chartConfig.axis}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />

          <YAxis
            {...chartConfig.axis}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            label={{
              value: 'Giờ',
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' },
            }}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }} />

          {/* SLA Reference Line */}
          <ReferenceLine
            y={slaHours}
            stroke={getChartColor('red')}
            strokeDasharray="5 5"
            strokeWidth={2}
            label={{
              value: 'Giới hạn SLA',
              position: 'insideTopRight',
              fill: getChartColor('red'),
              fontSize: 12,
              fontWeight: 600,
            }}
          />

          {/* Area fill - stroke="none" to avoid double line with the Line component */}
          <Area
            type="monotone"
            dataKey="avgTATHours"
            stroke="none"
            fill="url(#tatGradient)"
            fillOpacity={1}
          />

          {/* Line overlay for better visibility and dots */}
          <Line
            type="monotone"
            dataKey="avgTATHours"
            stroke={getChartColor('blue')}
            strokeWidth={3}
            dot={{ fill: getChartColor('blue'), r: 4 }}
            activeDot={{ r: 6, fill: getChartColor('blue') }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

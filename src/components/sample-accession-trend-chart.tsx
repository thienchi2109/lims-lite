/**
 * Sample Accession Trend Chart Component
 *
 * Combined bar + line chart showing sample accession volume trends:
 * - Bars: Sample count per period (daily/monthly/yearly)
 * - Line: Cumulative total (running sum)
 * - Dual Y-axis: Left for count, Right for cumulative
 * - Auto-granularity based on date range
 * - Tooltip shows: Period / Sample Count / Cumulative Total
 * - Responsive with loading skeleton and empty state
 */

'use client'

import {
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts'
import { ChartContainer } from '@/components/chart-container'
import { chartConfig, getChartColor, formatVietnameseNumber } from '@/lib/chart-theme'
import type { SampleAccessionTrendData } from '@/types'

export interface SampleAccessionTrendChartProps {
  data: SampleAccessionTrendData[]
  isLoading?: boolean
  height?: number
}

// Custom Tooltip showing both metrics
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as SampleAccessionTrendData

    return (
      <div style={chartConfig.tooltip.contentStyle}>
        <p style={chartConfig.tooltip.labelStyle}>Kỳ: {label}</p>
        <div style={chartConfig.tooltip.itemStyle}>
          <span className="font-medium">Số mẫu:</span> {formatVietnameseNumber(data.sampleCount)}
        </div>
        <div style={chartConfig.tooltip.itemStyle}>
          <span className="font-medium">Tổng tích lũy:</span>{' '}
          {formatVietnameseNumber(data.cumulativeCount)}
        </div>
      </div>
    )
  }
  return null
}

// Format period label based on granularity
const formatPeriodLabel = (period: string): string => {
  // Daily: "2024-01-15" → "15/01"
  if (period.length === 10 && period.includes('-')) {
    const [year, month, day] = period.split('-')
    return `${day}/${month}`
  }

  // Monthly: "2024-01" → "01/2024"
  if (period.length === 7 && period.includes('-')) {
    const [year, month] = period.split('-')
    return `${month}/${year}`
  }

  // Yearly: "2024" → "2024"
  return period
}

export function SampleAccessionTrendChart({
  data,
  isLoading = false,
  height = 300,
}: SampleAccessionTrendChartProps) {
  // Format data for chart (convert period to display format)
  const chartData = data.map((item) => ({
    ...item,
    periodFormatted: formatPeriodLabel(item.period),
  }))

  const isEmpty = !isLoading && data.length === 0

  // Calculate max values for Y-axis domains
  const maxCount = Math.max(...data.map((d) => d.sampleCount), 0)
  const maxCumulative = Math.max(...data.map((d) => d.cumulativeCount), 0)

  return (
    <ChartContainer
      title="Số lượng mẫu xét nghiệm nhận hàng ngày"
      subtitle="Số lượng mẫu tiếp nhận theo thời gian"
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="Chưa có dữ liệu tiếp nhận mẫu"
      height={height}
    >
      <ResponsiveContainer width="100%" height={height} minHeight={height} minWidth={0}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartConfig.grid.stroke} />

          {/* X-axis: Period labels */}
          <XAxis
            dataKey="periodFormatted"
            {...chartConfig.axis}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />

          {/* Left Y-axis: Sample count */}
          <YAxis
            yAxisId="left"
            {...chartConfig.axis}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            label={{
              value: 'Số mẫu',
              angle: -90,
              position: 'insideLeft',
              style: { fill: 'hsl(var(--muted-foreground))', fontSize: 12 },
            }}
            domain={[0, maxCount > 0 ? Math.ceil(maxCount * 1.1) : 10]}
          />

          {/* Right Y-axis: Cumulative total */}
          <YAxis
            yAxisId="right"
            orientation="right"
            {...chartConfig.axis}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            label={{
              value: 'Tổng tích lũy',
              angle: 90,
              position: 'insideRight',
              style: { fill: 'hsl(var(--muted-foreground))', fontSize: 12 },
            }}
            domain={[0, maxCumulative > 0 ? Math.ceil(maxCumulative * 1.1) : 10]}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Bar: Sample count per period */}
          <Bar
            yAxisId="left"
            dataKey="sampleCount"
            fill={getChartColor('blue')}
            radius={[4, 4, 0, 0]}
            maxBarSize={50}
          />

          {/* Line: Cumulative total */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumulativeCount"
            stroke={getChartColor('orange')}
            strokeWidth={2}
            dot={{ fill: getChartColor('orange'), r: 4 }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

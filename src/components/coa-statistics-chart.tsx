/**
 * CoA Statistics Chart Component
 *
 * Donut chart showing Certificate of Analysis (CoA) generation status:
 * - Segment breakdown: Generated (has CoA), Pending CoA (approved but no CoA)
 * - Percentage calculated based on APPROVED SAMPLES ONLY: (count / approved_samples) * 100
 * - Shows count and percentage for each segment
 * - Color-coded segments matching KPI gradients
 * - Center label with total approved count
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
    <div className="bg-background border border-border rounded-md px-3 py-2 text-xs shadow-sm">
      <div className="font-semibold mb-1">
        {segmentLabels[data.segment] || data.segment}
      </div>
      <div className="text-muted-foreground py-0.5">
        Số lượng: {formatVietnameseNumber(data.count)}
      </div>
      <div className="text-muted-foreground py-0.5">
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
      title="Thống kê số phiếu Trả kết quả XN đã tạo"
      subtitle="Phân bổ theo giai đoạn xử lý (chỉ tính mẫu đã duyệt)"
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="Chưa có dữ liệu CoA"
      height={height}
      skeletonVariant="donut"
    >
      <ResponsiveContainer width="100%" height="100%" minHeight={height}>
        <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="segmentLabel"
            cx="50%"
            cy="50%"
            innerRadius="50%"
            outerRadius="65%"
            paddingAngle={2}
            label={({ cx, x, y, segmentLabel, percentage, fill }: any) => {
              // Shorten label to avoid cutoff
              const shortLabel = segmentLabel.replace(' CoA', '')
              return (
                <text
                  x={x}
                  y={y}
                  fill={fill}
                  textAnchor={x > cx ? 'start' : 'end'}
                  dominantBaseline="central"
                  style={{ fontSize: '10px', fontWeight: 500 }}
                >
                  {`${shortLabel} (${percentage.toFixed(0)}%)`}
                </text>
              )
            }}
            labelLine={{
              stroke: 'hsl(var(--muted-foreground))',
              strokeWidth: 1,
            }}
          >
            {chartData.map((entry) => (
              <Cell key={entry.segment} fill={entry.color} />
            ))}
          </Pie>

          <Tooltip content={<CustomTooltip />} />

          <Legend
            {...chartConfig.legend}
            verticalAlign="bottom"
            height={36}
            formatter={(value) => value}
          />

          {/* Center label with total approved count */}
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
            Mẫu đã duyệt
          </text>
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

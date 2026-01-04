'use client'

import { useMemo } from 'react'
import {
    LineChart, Line, XAxis, YAxis, ReferenceLine,
    ResponsiveContainer, Tooltip, Label,
} from 'recharts'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import type { MiniChartDataPoint } from './qc-sparkline'
import { QC_CHART_COLORS, QC_RESULT_STATUS_LABELS } from './qc-chart-constants'

// Types
interface LeveyJenningsChartProps {
    mean: number
    sd: number
    dataPoints: Array<MiniChartDataPoint & { measuredAt: string }>
    height?: number
}

interface ChartDataPoint extends MiniChartDataPoint {
    measuredAt: string
    index: number
    date: string
}

interface DotProps { cx?: number; cy?: number; payload?: ChartDataPoint }
interface TooltipProps { active?: boolean; payload?: Array<{ payload: ChartDataPoint }> }

// Constants
const LINE_COLOR = '#94a3b8' // Keep local as it's specific to this chart

// Helper Components
function renderDot({ cx, cy, payload }: DotProps) {
    if (cx === undefined || cy === undefined || !payload) return null
    const color = payload.status === 'reject' ? QC_CHART_COLORS.reject
        : payload.status === 'warning' ? QC_CHART_COLORS.warning : QC_CHART_COLORS.pass
    return <circle cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />
}

function ChartTooltip({ active, payload }: TooltipProps) {
    if (!active || !payload?.[0]) return null
    const data = payload[0].payload
    const statusClass = data.status === 'reject' ? 'text-red-600'
        : data.status === 'warning' ? 'text-yellow-600' : 'text-green-600'

    return (
        <div className="rounded border bg-background px-3 py-2 text-sm shadow-lg">
            <div className="font-medium">{data.date}</div>
            <div className="font-mono text-lg">{data.value.toFixed(2)}</div>
            <div className={`${statusClass} font-medium`}>{QC_RESULT_STATUS_LABELS[data.status]}</div>
        </div>
    )
}

// Main Component
export function LeveyJenningsChart({
    mean, sd, dataPoints, height = 200,
}: LeveyJenningsChartProps) {
    const chartData = useMemo(() => dataPoints.map((d, idx) => ({
        ...d,
        index: idx + 1,
        date: format(new Date(d.measuredAt), 'dd/MM', { locale: vi }),
    })), [dataPoints])

    const yDomain = useMemo(() => [mean - 4 * sd, mean + 4 * sd], [mean, sd])

    if (chartData.length === 0) {
        return (
            <div
                className="rounded-md border border-dashed flex items-center justify-center text-muted-foreground"
                style={{ height }}
            >
                Chưa có dữ liệu QC
            </div>
        )
    }

    return (
        <div style={{ height }} className="rounded-md border bg-muted/20">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 50, left: 10, bottom: 8 }}>
                    <YAxis
                        domain={yDomain}
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                        tickFormatter={(v) => v.toFixed(1)}
                    />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                    />
                    <Tooltip content={<ChartTooltip />} />

                    {/* Reference lines: +3SD, +2SD, Mean, -2SD, -3SD */}
                    <ReferenceLine y={mean + 3 * sd} stroke={QC_CHART_COLORS.sd3} strokeWidth={1}>
                        <Label value="+3SD" position="right" fontSize={9} fill={QC_CHART_COLORS.sd3} />
                    </ReferenceLine>
                    <ReferenceLine y={mean + 2 * sd} stroke={QC_CHART_COLORS.sd2} strokeDasharray="4 2" strokeWidth={1}>
                        <Label value="+2SD" position="right" fontSize={9} fill={QC_CHART_COLORS.sd2} />
                    </ReferenceLine>
                    <ReferenceLine y={mean} stroke={QC_CHART_COLORS.mean} strokeWidth={2}>
                        <Label value="Mean" position="right" fontSize={9} fill={QC_CHART_COLORS.mean} />
                    </ReferenceLine>
                    <ReferenceLine y={mean - 2 * sd} stroke={QC_CHART_COLORS.sd2} strokeDasharray="4 2" strokeWidth={1}>
                        <Label value="-2SD" position="right" fontSize={9} fill={QC_CHART_COLORS.sd2} />
                    </ReferenceLine>
                    <ReferenceLine y={mean - 3 * sd} stroke={QC_CHART_COLORS.sd3} strokeWidth={1}>
                        <Label value="-3SD" position="right" fontSize={9} fill={QC_CHART_COLORS.sd3} />
                    </ReferenceLine>

                    <Line
                        type="linear"
                        dataKey="value"
                        stroke={LINE_COLOR}
                        strokeWidth={1.5}
                        dot={renderDot}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                        animationDuration={400}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

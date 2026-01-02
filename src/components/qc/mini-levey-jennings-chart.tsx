'use client'

import { useMemo } from 'react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
} from 'recharts'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import type { QCResultStatus } from '@/types/qc'

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
    pass: '#22c55e',
    warning: '#eab308',
    reject: '#ef4444',
    mean: '#22c55e',
    sd2: '#eab308',
    sd3: '#ef4444',
    line: '#94a3b8',
    grid: '#e2e8f0',
}

// ============================================================================
// TYPES
// ============================================================================

interface DataPoint {
    id: string
    value: number
    status: QCResultStatus
    measuredAt: string
}

interface ChartDataPoint extends DataPoint {
    index: number
    date: string
}

interface MiniLeveyJenningsChartProps {
    mean: number
    sd: number
    dataPoints: DataPoint[]
    height?: number
}

interface DotProps {
    cx?: number
    cy?: number
    payload?: ChartDataPoint
}

interface TooltipProps {
    active?: boolean
    payload?: Array<{ payload: ChartDataPoint }>
}

// ============================================================================
// HELPER COMPONENTS (outside main component to prevent re-creation)
// ============================================================================

/**
 * Color-coded dot renderer based on QC status
 * Defined outside component to maintain stable reference
 */
function renderDot({ cx, cy, payload }: DotProps) {
    if (cx === undefined || cy === undefined || !payload) return null

    const color = payload.status === 'reject'
        ? COLORS.reject
        : payload.status === 'warning'
            ? COLORS.warning
            : COLORS.pass

    return (
        <circle
            cx={cx}
            cy={cy}
            r={3}
            fill={color}
            stroke="#fff"
            strokeWidth={1}
        />
    )
}

/**
 * Compact tooltip for mini chart
 * Defined outside component to maintain stable reference
 */
function MiniTooltip({ active, payload }: TooltipProps) {
    if (!active || !payload?.[0]) return null
    const data = payload[0].payload
    const statusLabel = data.status === 'reject' ? 'Vi phạm' : data.status === 'warning' ? 'Cảnh báo' : 'Đạt'

    return (
        <div className="rounded border bg-background px-2 py-1 text-xs shadow">
            <div className="font-medium">{data.date}</div>
            <div className="font-mono">{data.value.toFixed(2)}</div>
            <div className={data.status === 'reject' ? 'text-red-600' : data.status === 'warning' ? 'text-yellow-600' : 'text-green-600'}>
                {statusLabel}
            </div>
        </div>
    )
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Compact Levey-Jennings chart for QC assay cards
 * Shows last 30 days of QC data in a mini format
 */
export function MiniLeveyJenningsChart({
    mean,
    sd,
    dataPoints,
    height = 96,
}: MiniLeveyJenningsChartProps) {
    // Filter to last 30 days and transform data
    const chartData = useMemo(() => {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 30)

        return dataPoints
            .filter(d => new Date(d.measuredAt) >= cutoff)
            .slice(-15) // Max 15 points for mini chart
            .map((d, idx) => ({
                ...d,
                index: idx + 1,
                date: format(new Date(d.measuredAt), 'dd/MM', { locale: vi }),
            }))
    }, [dataPoints])

    // Y-axis domain: Mean ±4SD
    const yDomain = useMemo(() => {
        return [mean - 4 * sd, mean + 4 * sd]
    }, [mean, sd])

    // Empty state
    if (chartData.length === 0) {
        return (
            <div
                className="rounded-md border border-dashed flex items-center justify-center text-muted-foreground text-xs"
                style={{ height }}
            >
                Chưa có dữ liệu QC
            </div>
        )
    }

    return (
        <div style={{ height }} className="rounded-md border bg-muted/30">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                >
                    {/* Y-axis (hidden labels for compact view) */}
                    <YAxis domain={yDomain} hide />

                    {/* X-axis (minimal) */}
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 8 }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                    />

                    <Tooltip content={<MiniTooltip />} />

                    {/* Reference lines - ±3SD (red), ±2SD (yellow), Mean (green) */}
                    <ReferenceLine y={mean + 3 * sd} stroke={COLORS.sd3} strokeWidth={1} />
                    <ReferenceLine y={mean - 3 * sd} stroke={COLORS.sd3} strokeWidth={1} />
                    <ReferenceLine y={mean + 2 * sd} stroke={COLORS.sd2} strokeDasharray="2 2" strokeWidth={1} />
                    <ReferenceLine y={mean - 2 * sd} stroke={COLORS.sd2} strokeDasharray="2 2" strokeWidth={1} />
                    <ReferenceLine y={mean} stroke={COLORS.mean} strokeWidth={1.5} />

                    {/* Data line */}
                    <Line
                        type="linear"
                        dataKey="value"
                        stroke={COLORS.line}
                        strokeWidth={1}
                        dot={renderDot}
                        activeDot={{ r: 4, strokeWidth: 1 }}
                        animationDuration={500}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

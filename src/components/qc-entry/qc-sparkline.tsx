'use client'

import { useMemo } from 'react'
import {
    LineChart,
    Line,
    YAxis,
    ReferenceLine,
    ResponsiveContainer,
} from 'recharts'
import { QC_CHART_COLORS } from './qc-chart-constants'

// ============================================================================
// TYPES
// ============================================================================

export interface MiniChartDataPoint {
    value: number
    status: 'pass' | 'warning' | 'reject'
}

interface QCSparklineProps {
    dataPoints: MiniChartDataPoint[]
    mean: number
    sd: number
}

interface DotProps {
    cx?: number
    cy?: number
    payload?: MiniChartDataPoint & { index: number }
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LINE_COLOR = '#94a3b8' // Keep local as it's specific to this chart

// ============================================================================
// HELPER
// ============================================================================

function renderDot({ cx, cy, payload }: DotProps) {
    if (cx === undefined || cy === undefined || !payload) return null

    const color = payload.status === 'reject'
        ? QC_CHART_COLORS.reject
        : payload.status === 'warning'
            ? QC_CHART_COLORS.warning
            : QC_CHART_COLORS.pass

    return <circle cx={cx} cy={cy} r={2} fill={color} />
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QCSparkline({ dataPoints, mean, sd }: QCSparklineProps) {
    const chartData = useMemo(() => {
        return dataPoints.slice(-10).map((d, idx) => ({ ...d, index: idx }))
    }, [dataPoints])

    const yDomain = useMemo(() => [mean - 3 * sd, mean + 3 * sd], [mean, sd])

    if (chartData.length === 0) {
        return <div className="h-6 w-full bg-muted/30 rounded" />
    }

    return (
        <div className="h-6 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                    <YAxis domain={yDomain} hide />
                    <ReferenceLine y={mean + 2 * sd} stroke={QC_CHART_COLORS.sd2} strokeDasharray="2 2" strokeWidth={0.5} />
                    <ReferenceLine y={mean - 2 * sd} stroke={QC_CHART_COLORS.sd2} strokeDasharray="2 2" strokeWidth={0.5} />
                    <ReferenceLine y={mean} stroke={QC_CHART_COLORS.mean} strokeWidth={0.5} />
                    <Line
                        type="linear"
                        dataKey="value"
                        stroke={LINE_COLOR}
                        strokeWidth={1}
                        dot={renderDot}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

'use client'

import { useMemo, useState } from 'react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
    ResponsiveContainer,
    Legend,
} from 'recharts'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { ChartContainer } from '@/components/chart-container'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import type { QCResultStatus } from '@/types/qc'

const STATUS_LABELS = {
    pass: 'Đạt',
    warning: 'Cảnh báo',
    reject: 'Không đạt',
} as const

/** Tooltip component extracted to module scope to avoid re-creation on every render */
function LJChartTooltip({ active, payload, units }: { active?: boolean; payload?: any[]; units: string }) {
    if (!active || !payload?.[0]) return null

    const data = payload[0].payload

    return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
            <p className="text-sm font-medium">{data.fullDate}</p>
            <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Giá trị:</span>
                    <span className="font-mono font-medium">
                        {data.value.toFixed(2)} {units}
                    </span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Z-score:</span>
                    <span className="font-mono font-medium">
                        {data.zScore?.toFixed(2) ?? 'N/A'}
                    </span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Trạng thái:</span>
                    <Badge
                        variant={data.status === 'reject' ? 'destructive' : data.status === 'warning' ? 'secondary' : 'default'}
                        className={data.status === 'pass' ? 'bg-green-600' : data.status === 'warning' ? 'bg-yellow-500 text-black' : ''}
                    >
                        {STATUS_LABELS[data.status as keyof typeof STATUS_LABELS]}
                    </Badge>
                </div>
                {data.ruleViolated && (
                    <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Vi phạm:</span>
                        <Badge variant="destructive">{data.ruleViolated}</Badge>
                    </div>
                )}
            </div>
        </div>
    )
}

// Color scheme based on NotebookLM best practices
const COLORS = {
    pass: '#22c55e',      // Green - within ±2SD
    warning: '#eab308',   // Yellow - between ±2SD and ±3SD
    reject: '#ef4444',    // Red - outside ±3SD
    mean: '#22c55e',      // Green solid line for mean
    sd1: '#94a3b8',       // Light gray for ±1SD
    sd2: '#eab308',       // Yellow dashed for ±2SD
    sd3: '#ef4444',       // Red solid for ±3SD (action limits)
    grid: '#e2e8f0',
    line: '#3b82f6',      // Blue connecting line
}

interface DataPoint {
    id: string
    value: number
    zScore: number | null
    status: QCResultStatus
    measuredAt: string
    ruleViolated?: string | null
}

interface LeveyJenningsChartProps {
    /** Chart title */
    title?: string
    /** Assay name */
    assayName: string
    /** Material name and level */
    materialInfo: string
    /** Target mean from control limits */
    mean: number
    /** Standard deviation from control limits */
    sd: number
    /** Units for display */
    units?: string
    /** Data points to plot */
    dataPoints: DataPoint[]
    /** Loading state */
    isLoading?: boolean
    /** Chart height */
    height?: number
}

/**
 * Levey-Jennings Chart for QC visualization
 *
 * Best practices from NotebookLM:
 * - Y-axis scaled to Mean ±4SD
 * - Reference lines: Mean (green), ±1SD (gray), ±2SD (yellow), ±3SD (red)
 * - Color-coded points: Green (pass), Yellow (warning), Red (reject)
 * - Connecting lines for trend detection
 * - Tooltips with value, Z-score, rule violations
 */
export function LeveyJenningsChart({
    title = 'Biểu đồ Levey-Jennings',
    assayName,
    materialInfo,
    mean,
    sd,
    units = '',
    dataPoints,
    isLoading = false,
    height = 350,
}: LeveyJenningsChartProps) {
    const [dateRange, setDateRange] = useState<'7' | '14' | '30' | '90'>('30')

    // Filter data by date range
    const filteredData = useMemo(() => {
        const days = parseInt(dateRange)
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - days)

        return dataPoints
            .filter(d => new Date(d.measuredAt) >= cutoff)
            .map((d, idx) => ({
                ...d,
                index: idx + 1,
                date: format(new Date(d.measuredAt), 'dd/MM', { locale: vi }),
                fullDate: format(new Date(d.measuredAt), 'dd/MM/yyyy HH:mm', { locale: vi }),
            }))
    }, [dataPoints, dateRange])

    // Calculate Y-axis domain: Mean ±4SD (recommended by NotebookLM)
    const yDomain = useMemo(() => {
        const min = mean - 4 * sd
        const max = mean + 4 * sd
        return [min, max]
    }, [mean, sd])

    // Custom dot renderer for color-coded points
    const renderDot = (props: any) => {
        const { cx, cy, payload } = props
        if (cx === undefined || cy === undefined) return null

        const color = payload.status === 'reject'
            ? COLORS.reject
            : payload.status === 'warning'
                ? COLORS.warning
                : COLORS.pass

        return (
            <circle
                cx={cx}
                cy={cy}
                r={5}
                fill={color}
                stroke="#fff"
                strokeWidth={2}
                style={{ cursor: 'pointer' }}
            />
        )
    }

    return (
        <ChartContainer
            title={title}
            subtitle={`${assayName} - ${materialInfo}`}
            isLoading={isLoading}
            isEmpty={filteredData.length === 0}
            emptyMessage="Không có dữ liệu QC trong khoảng thời gian này"
            height={height}
            skeletonVariant="line"
        >
            <div className="space-y-3">
                {/* Date range filter */}
                <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground">Khoảng thời gian:</Label>
                    <Select value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
                        <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">7 ngày</SelectItem>
                            <SelectItem value="14">14 ngày</SelectItem>
                            <SelectItem value="30">30 ngày</SelectItem>
                            <SelectItem value="90">90 ngày</SelectItem>
                        </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">
                        ({filteredData.length} điểm)
                    </span>
                </div>

                {/* Chart */}
                <ResponsiveContainer width="100%" height={height - 60}>
                    <LineChart
                        data={filteredData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />

                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={{ stroke: COLORS.grid }}
                        />

                        <YAxis
                            domain={yDomain}
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={{ stroke: COLORS.grid }}
                            tickFormatter={(v) => v.toFixed(1)}
                            label={{
                                value: units,
                                angle: -90,
                                position: 'insideLeft',
                                style: { textAnchor: 'middle', fontSize: 11 },
                            }}
                        />

                        <Tooltip content={<LJChartTooltip units={units} />} />

                        {/* Reference Lines - Order matters for z-index */}
                        {/* ±3SD - Red solid (Action Limits) */}
                        <ReferenceLine
                            y={mean + 3 * sd}
                            stroke={COLORS.sd3}
                            strokeWidth={2}
                            label={{ value: '+3SD', position: 'right', fontSize: 10, fill: COLORS.sd3 }}
                        />
                        <ReferenceLine
                            y={mean - 3 * sd}
                            stroke={COLORS.sd3}
                            strokeWidth={2}
                            label={{ value: '-3SD', position: 'right', fontSize: 10, fill: COLORS.sd3 }}
                        />

                        {/* ±2SD - Yellow dashed (Warning) */}
                        <ReferenceLine
                            y={mean + 2 * sd}
                            stroke={COLORS.sd2}
                            strokeDasharray="5 5"
                            label={{ value: '+2SD', position: 'right', fontSize: 10, fill: COLORS.sd2 }}
                        />
                        <ReferenceLine
                            y={mean - 2 * sd}
                            stroke={COLORS.sd2}
                            strokeDasharray="5 5"
                            label={{ value: '-2SD', position: 'right', fontSize: 10, fill: COLORS.sd2 }}
                        />

                        {/* ±1SD - Gray dashed */}
                        <ReferenceLine
                            y={mean + 1 * sd}
                            stroke={COLORS.sd1}
                            strokeDasharray="3 3"
                            strokeOpacity={0.7}
                        />
                        <ReferenceLine
                            y={mean - 1 * sd}
                            stroke={COLORS.sd1}
                            strokeDasharray="3 3"
                            strokeOpacity={0.7}
                        />

                        {/* Mean - Green solid */}
                        <ReferenceLine
                            y={mean}
                            stroke={COLORS.mean}
                            strokeWidth={2}
                            label={{ value: 'Mean', position: 'right', fontSize: 10, fill: COLORS.mean }}
                        />

                        {/* Data line with color-coded dots */}
                        <Line
                            type="linear"
                            dataKey="value"
                            stroke={COLORS.line}
                            strokeWidth={1.5}
                            dot={renderDot}
                            activeDot={{ r: 7, strokeWidth: 2 }}
                            animationDuration={800}
                            animationEasing="ease-in-out"
                        />

                        <Legend
                            verticalAlign="top"
                            height={36}
                            content={() => (
                                <div className="flex justify-center gap-4 text-xs">
                                    <span className="flex items-center gap-1">
                                        <span className="h-3 w-3 rounded-full bg-green-500" />
                                        Đạt
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="h-3 w-3 rounded-full bg-yellow-500" />
                                        Cảnh báo (1-2s)
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="h-3 w-3 rounded-full bg-red-500" />
                                        Không đạt
                                    </span>
                                </div>
                            )}
                        />
                    </LineChart>
                </ResponsiveContainer>

                {/* Control limits summary */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs border-t pt-2">
                    <div>
                        <span className="text-muted-foreground">Mean</span>
                        <p className="font-mono font-medium">{mean.toFixed(2)}</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground">SD</span>
                        <p className="font-mono font-medium">{sd.toFixed(2)}</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground">±2SD</span>
                        <p className="font-mono font-medium">
                            {(mean - 2 * sd).toFixed(1)} - {(mean + 2 * sd).toFixed(1)}
                        </p>
                    </div>
                    <div>
                        <span className="text-muted-foreground">±3SD</span>
                        <p className="font-mono font-medium">
                            {(mean - 3 * sd).toFixed(1)} - {(mean + 3 * sd).toFixed(1)}
                        </p>
                    </div>
                </div>
            </div>
        </ChartContainer>
    )
}

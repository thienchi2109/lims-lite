/**
 * Specialty Sample Chart Component
 *
 * Grouped vertical bar chart showing sample counts by lab specialty:
 * - Color-coded bars for each sample status
 * - Tooltip with sample count and test count
 * - Integrates with StatusFilterChips for status filtering
 * - Responsive with loading skeleton and empty state
 */

'use client'

import { useMemo } from 'react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts'
import { ChartContainer } from '@/components/chart-container'
import { StatusFilterChips, statusLabels, statusHexColors, ALL_STATUSES } from '@/components/status-filter-chips'
import { chartConfig, formatVietnameseNumber } from '@/lib/chart-theme'
import type { SpecialtySampleData, SampleStatus } from '@/types'

interface SpecialtySampleChartProps {
    data: SpecialtySampleData[]
    selectedStatuses: SampleStatus[]
    isLoading?: boolean
    height?: number
}

// Transform flat data into grouped format for Recharts
function transformDataForChart(data: SpecialtySampleData[], selectedStatuses: SampleStatus[]) {
    // Group by specialty
    const grouped = new Map<string, {
        specialtyCode: string
        specialtyName: string
        [key: string]: number | string // Dynamic status keys
    }>()

    for (const item of data) {
        if (!selectedStatuses.includes(item.status)) continue

        const key = item.specialtyCode
        if (!grouped.has(key)) {
            grouped.set(key, {
                specialtyCode: item.specialtyCode,
                specialtyName: item.specialtyName,
            })
        }

        const group = grouped.get(key)!
        group[item.status] = item.sampleCount
        // Store test count for tooltip
        group[`${item.status}_tests`] = item.testCount
    }

    return Array.from(grouped.values())
}

// Custom tooltip component
function SpecialtyTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean
    payload?: Array<{
        dataKey: string
        value: number
        fill: string
        payload: Record<string, number | string>
    }>
    label?: string
}) {
    if (!active || !payload?.length) return null

    return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
            <p className="font-medium text-slate-900 dark:text-slate-100 mb-2">{label}</p>
            {payload.map((entry) => {
                const status = entry.dataKey as SampleStatus
                const testCount = entry.payload[`${status}_tests`] || 0
                return (
                    <p
                        key={entry.dataKey}
                        className="text-sm py-0.5"
                        style={{ color: entry.fill }}
                    >
                        {statusLabels[status]}: {formatVietnameseNumber(entry.value)} mẫu
                        <span className="text-slate-500 dark:text-slate-400 ml-1">
                            ({formatVietnameseNumber(Number(testCount))} xét nghiệm)
                        </span>
                    </p>
                )
            })}
        </div>
    )
}

export function SpecialtySampleChart({
    data,
    selectedStatuses,
    isLoading = false,
    height = 400,
}: SpecialtySampleChartProps) {
    // Transform data for grouped bar chart
    const chartData = useMemo(
        () => transformDataForChart(data, selectedStatuses),
        [data, selectedStatuses]
    )

    const isEmpty = !isLoading && chartData.length === 0

    return (
        <ChartContainer
            title="Thống kê Mẫu theo Nhóm Kỹ Thuật"
            subtitle="Số lượng mẫu phân bổ theo chuyên khoa"
            isLoading={isLoading}
            isEmpty={isEmpty}
            emptyMessage={selectedStatuses.length === 0
                ? "Vui lòng chọn ít nhất một trạng thái"
                : "Chưa có dữ liệu thống kê"
            }
            height={height}
        >
            {/* Status Filter Chips */}
            <div className="mb-4 px-1">
                <StatusFilterChips selectedStatuses={selectedStatuses} />
            </div>

            <ResponsiveContainer width="100%" height={height - 60} minHeight={height - 60} minWidth={0}>
                <BarChart
                    data={chartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid {...chartConfig.grid} />

                    <XAxis
                        dataKey="specialtyName"
                        {...chartConfig.axis}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={60}
                    />

                    <YAxis
                        {...chartConfig.axis}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        allowDecimals={false}
                    />

                    <Tooltip content={<SpecialtyTooltip />} />

                    <Legend
                        {...chartConfig.legend}
                        formatter={(value: string) => statusLabels[value as SampleStatus] || value}
                    />

                    {/* Render bars for each selected status */}
                    {ALL_STATUSES.filter(status => selectedStatuses.includes(status)).map((status) => (
                        <Bar
                            key={status}
                            dataKey={status}
                            name={status}
                            fill={statusHexColors[status]}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </ChartContainer>
    )
}

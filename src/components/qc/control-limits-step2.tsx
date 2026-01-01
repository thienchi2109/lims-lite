'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Calculator, Plus, Trash2 } from 'lucide-react'
import type { DataPoint, ControlLimitsStats } from './control-limits-types'
import { MINIMUM_DATA_POINTS } from './control-limits-types'

interface Step2DataEntryProps {
    dataPoints: DataPoint[]
    stats: ControlLimitsStats | null
    newValue: string
    newDate: string
    onValueChange: (value: string) => void
    onDateChange: (date: string) => void
    onAddDataPoint: () => void
    onRemoveDataPoint: (id: string) => void
}

export function Step2DataEntry({
    dataPoints,
    stats,
    newValue,
    newDate,
    onValueChange,
    onDateChange,
    onAddDataPoint,
    onRemoveDataPoint,
}: Step2DataEntryProps) {
    const progress = (dataPoints.length / MINIMUM_DATA_POINTS) * 100
    const hasMinimumPoints = dataPoints.length >= MINIMUM_DATA_POINTS

    return (
        <div className="space-y-4">
            {/* Progress indicator */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span>Tiến độ thu thập dữ liệu</span>
                    <span className={hasMinimumPoints ? 'text-green-600' : 'text-muted-foreground'}>
                        {dataPoints.length}/{MINIMUM_DATA_POINTS} điểm
                    </span>
                </div>
                <Progress value={progress} className="h-2" />
                {!hasMinimumPoints && (
                    <p className="text-xs text-muted-foreground">
                        Cần ít nhất {MINIMUM_DATA_POINTS} điểm dữ liệu trong 10+ ngày để thiết lập giới hạn kiểm soát
                    </p>
                )}
            </div>

            {/* Add data point form */}
            <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                    <Label htmlFor="value">Giá trị</Label>
                    <Input
                        id="value"
                        type="number"
                        step="0.01"
                        value={newValue}
                        onChange={e => onValueChange(e.target.value)}
                        placeholder="Nhập giá trị..."
                        onKeyDown={e => e.key === 'Enter' && onAddDataPoint()}
                    />
                </div>
                <div className="w-40 space-y-1">
                    <Label htmlFor="date">Ngày</Label>
                    <Input
                        id="date"
                        type="date"
                        value={newDate}
                        onChange={e => onDateChange(e.target.value)}
                    />
                </div>
                <Button onClick={onAddDataPoint} size="icon">
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            {/* Data points table */}
            {dataPoints.length > 0 && (
                <div className="rounded-md border max-h-48 overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>Giá trị</TableHead>
                                <TableHead>Ngày</TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {dataPoints.map((dp, idx) => (
                                <TableRow key={dp.id}>
                                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                    <TableCell className="font-mono">{dp.value}</TableCell>
                                    <TableCell>{new Date(dp.date).toLocaleDateString('vi-VN')}</TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onRemoveDataPoint(dp.id)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Live statistics */}
            {stats && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                    <div className="flex items-center gap-2 font-medium">
                        <Calculator className="h-4 w-4" />
                        Thống kê tạm tính
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Mean:</span>
                            <span className="ml-2 font-mono">{stats.mean}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">SD:</span>
                            <span className="ml-2 font-mono">{stats.sd}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">CV%:</span>
                            <span className="ml-2 font-mono">{stats.cv}%</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

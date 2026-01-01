'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react'
import type { CrossoverDataPoint, CrossoverStats } from './lot-changeover-types'
import { MINIMUM_CROSSOVER_POINTS } from './lot-changeover-types'

interface CrossoverDataEntryProps {
    crossoverData: CrossoverDataPoint[]
    oldValue: string
    newValue: string
    dataDate: string
    crossoverStats: {
        oldLot: CrossoverStats | null
        newLot: CrossoverStats | null
        count: number
    }
    currentCV: number
    onOldValueChange: (value: string) => void
    onNewValueChange: (value: string) => void
    onDateChange: (value: string) => void
    onAddDataPoint: () => void
    onRemoveDataPoint: (id: string) => void
}

export function CrossoverDataEntry({
    crossoverData,
    oldValue,
    newValue,
    dataDate,
    crossoverStats,
    currentCV,
    onOldValueChange,
    onNewValueChange,
    onDateChange,
    onAddDataPoint,
    onRemoveDataPoint,
}: CrossoverDataEntryProps) {
    const hasMinimumPoints = crossoverData.length >= MINIMUM_CROSSOVER_POINTS
    const progress = (crossoverData.length / MINIMUM_CROSSOVER_POINTS) * 100

    return (
        <div className="space-y-4 border rounded-lg p-4">
            <div className="flex items-center justify-between">
                <h4 className="font-medium">Dữ liệu chéo (Crossover)</h4>
                {hasMinimumPoints ? (
                    <Badge className="bg-green-600 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Đủ dữ liệu
                    </Badge>
                ) : (
                    <Badge variant="outline" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {crossoverData.length}/{MINIMUM_CROSSOVER_POINTS} điểm
                    </Badge>
                )}
            </div>

            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
                Chạy song song 2 lô với cùng mẫu bệnh nhân. Nhập kết quả từ cả 2 lô.
            </p>

            {/* Add data point form */}
            <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                    <Label>Lô cũ</Label>
                    <Input
                        type="number"
                        step="0.01"
                        value={oldValue}
                        onChange={e => onOldValueChange(e.target.value)}
                        placeholder="Giá trị lô cũ"
                    />
                </div>
                <div className="flex-1 space-y-1">
                    <Label>Lô mới</Label>
                    <Input
                        type="number"
                        step="0.01"
                        value={newValue}
                        onChange={e => onNewValueChange(e.target.value)}
                        placeholder="Giá trị lô mới"
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), onAddDataPoint())}
                    />
                </div>
                <div className="w-32 space-y-1">
                    <Label>Ngày</Label>
                    <Input
                        type="date"
                        value={dataDate}
                        onChange={e => onDateChange(e.target.value)}
                    />
                </div>
                <Button type="button" onClick={onAddDataPoint} size="icon">
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            {/* Crossover data table */}
            {crossoverData.length > 0 && (
                <div className="rounded-md border max-h-40 overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>Lô cũ</TableHead>
                                <TableHead>Lô mới</TableHead>
                                <TableHead>Ngày</TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {crossoverData.map((dp, idx) => (
                                <TableRow key={dp.id}>
                                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                    <TableCell className="font-mono">{dp.oldLotValue}</TableCell>
                                    <TableCell className="font-mono">{dp.newLotValue}</TableCell>
                                    <TableCell>{new Date(dp.date).toLocaleDateString('vi-VN')}</TableCell>
                                    <TableCell>
                                        <Button
                                            type="button"
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

            {/* Statistics comparison */}
            {crossoverStats.count >= 2 && (
                <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 rounded-lg p-3">
                    <div>
                        <span className="text-muted-foreground">Mean lô cũ:</span>
                        <span className="ml-2 font-mono font-medium">{crossoverStats.oldLot?.mean ?? '-'}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Mean lô mới:</span>
                        <span className="ml-2 font-mono font-medium text-primary">{crossoverStats.newLot?.mean ?? '-'}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">SD lô cũ:</span>
                        <span className="ml-2 font-mono">{crossoverStats.oldLot?.sd ?? '-'}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">CV% (giữ nguyên):</span>
                        <span className="ml-2 font-mono text-primary">{currentCV.toFixed(2)}%</span>
                    </div>
                </div>
            )}
        </div>
    )
}

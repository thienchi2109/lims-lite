'use client'

import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { AssayOption, MaterialOption, ControlLimitsStats } from './control-limits-types'
import { MINIMUM_DATA_POINTS } from './control-limits-types'

interface Step3ReviewProps {
    selectedAssay: AssayOption | undefined
    selectedMaterial: MaterialOption | undefined
    stats: ControlLimitsStats | null
}

export function Step3Review({
    selectedAssay,
    selectedMaterial,
    stats,
}: Step3ReviewProps) {
    const hasMinimumPoints = (stats?.count ?? 0) >= MINIMUM_DATA_POINTS

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">Xác nhận giới hạn kiểm soát</h4>

                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                        <span className="text-muted-foreground">Xét nghiệm:</span>
                        <span className="ml-2 font-medium">{selectedAssay?.name}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Vật liệu:</span>
                        <span className="ml-2">{selectedMaterial?.name}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Mức:</span>
                        <Badge variant="outline">{selectedMaterial?.level}</Badge>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Số lô:</span>
                        <span className="ml-2 font-mono">{selectedMaterial?.lot_number}</span>
                    </div>
                </div>
            </div>

            {/* Statistics */}
            {stats && (
                <div className="rounded-lg border border-primary/50 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium">Giới hạn kiểm soát</h4>
                        {hasMinimumPoints ? (
                            <Badge className="bg-green-600 gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Đủ dữ liệu
                            </Badge>
                        ) : (
                            <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Thiếu dữ liệu
                            </Badge>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground">Mean (Giá trị trung bình)</span>
                            <p className="text-2xl font-mono font-bold">{stats.mean}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground">SD (Độ lệch chuẩn)</span>
                            <p className="text-2xl font-mono font-bold">{stats.sd}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground">CV% (Hệ số biến thiên)</span>
                            <p className="text-lg font-mono">{stats.cv}%</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground">Số điểm dữ liệu</span>
                            <p className="text-lg font-mono">{stats.count}</p>
                        </div>
                    </div>

                    {/* Control limits preview */}
                    <div className="pt-2 border-t text-sm space-y-1">
                        <p><span className="text-muted-foreground">±1SD:</span> {(stats.mean - stats.sd).toFixed(2)} - {(stats.mean + stats.sd).toFixed(2)}</p>
                        <p><span className="text-muted-foreground">±2SD:</span> {(stats.mean - 2*stats.sd).toFixed(2)} - {(stats.mean + 2*stats.sd).toFixed(2)}</p>
                        <p><span className="text-muted-foreground">±3SD:</span> {(stats.mean - 3*stats.sd).toFixed(2)} - {(stats.mean + 3*stats.sd).toFixed(2)}</p>
                    </div>
                </div>
            )}

            {!hasMinimumPoints && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Cảnh báo: Cần ít nhất {MINIMUM_DATA_POINTS} điểm dữ liệu để thiết lập giới hạn kiểm soát chính xác.
                </div>
            )}
        </div>
    )
}

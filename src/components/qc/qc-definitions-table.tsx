'use client'

import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { CheckCircle2, Settings, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataTablePagination } from '@/components/ui/data-table-pagination'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

export interface QCDefinitionWithDetails {
    id: string
    mean: number
    sd: number
    cv_percent: number | null
    is_active: boolean
    active_from: string
    data_points_count: number | null
    assay_id: string
    assay_name: string
    assay_units: string | null
    material_id: string
    material_name: string
    material_lot: string
    material_level: string
}

interface QCDefinitionsTableProps {
    definitions: QCDefinitionWithDetails[]
    total: number
    page: number
    pageSize: number
}

export function QCDefinitionsTable({
    definitions,
    total,
    page,
    pageSize,
}: QCDefinitionsTableProps) {
    if (definitions.length === 0 && total === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <Settings className="h-8 w-8 mx-auto mb-2" />
                Chưa có giới hạn kiểm soát nào. Nhấn &quot;Thiết lập mới&quot; để bắt đầu.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Xét nghiệm</TableHead>
                            <TableHead>Vật liệu / Mức độ</TableHead>
                            <TableHead className="text-right">Mean</TableHead>
                            <TableHead className="text-right">SD</TableHead>
                            <TableHead className="text-right">CV%</TableHead>
                            <TableHead>Ngày hiệu lực</TableHead>
                            <TableHead>Trạng thái</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {definitions.map((def) => (
                            <TableRow key={def.id}>
                                <TableCell>
                                    <div className="font-medium">{def.assay_name}</div>
                                    {def.assay_units && (
                                        <div className="text-xs text-muted-foreground">{def.assay_units}</div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div>{def.material_name}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {def.material_level === 'Low' ? 'Thấp' :
                                         def.material_level === 'Normal' ? 'Bình thường' :
                                         def.material_level === 'High' ? 'Cao' : def.material_level}
                                        {' • Lô: '}{def.material_lot}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {def.mean.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {def.sd.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {def.cv_percent ? `${def.cv_percent.toFixed(1)}%` : '—'}
                                </TableCell>
                                <TableCell>
                                    {format(new Date(def.active_from), 'dd/MM/yyyy', { locale: vi })}
                                </TableCell>
                                <TableCell>
                                    {def.is_active ? (
                                        <Badge className="gap-1 bg-green-100 text-green-700">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Đang sử dụng
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="gap-1">
                                            <XCircle className="h-3 w-3" />
                                            Ngừng sử dụng
                                        </Badge>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <DataTablePagination
                page={page}
                pageSize={pageSize}
                total={total}
                paramPrefix="def_"
            />
        </div>
    )
}

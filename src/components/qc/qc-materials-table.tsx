'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { AlertTriangle, CheckCircle2, Edit, MoreHorizontal, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { QCMaterialDialog } from './qc-material-dialog'
import { DeleteQCMaterialDialog } from './delete-qc-material-dialog'

export interface QCMaterial {
    id: string
    name: string
    manufacturer: string | null
    lot_number: string
    level: string
    expiry_date: string | null
    created_at: string
}

interface QCMaterialsTableProps {
    materials: QCMaterial[]
}

export function QCMaterialsTable({ materials }: QCMaterialsTableProps) {
    const [editMaterial, setEditMaterial] = useState<QCMaterial | null>(null)
    const [deleteMaterial, setDeleteMaterial] = useState<QCMaterial | null>(null)

    if (materials.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                Chưa có vật liệu QC nào. Nhấn &quot;Thêm vật liệu&quot; để bắt đầu.
            </div>
        )
    }

    const isExpired = (expiryDate: string | null) => {
        if (!expiryDate) return false
        return new Date(expiryDate) < new Date()
    }

    const isExpiringSoon = (expiryDate: string | null) => {
        if (!expiryDate) return false
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
        const expiry = new Date(expiryDate)
        return expiry <= thirtyDaysFromNow && expiry >= new Date()
    }

    return (
        <>
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Tên vật liệu</TableHead>
                    <TableHead>Nhà sản xuất</TableHead>
                    <TableHead>Số lô</TableHead>
                    <TableHead>Mức độ</TableHead>
                    <TableHead>Hạn sử dụng</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="w-[70px]">Thao tác</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {materials.map((material) => {
                    const expired = isExpired(material.expiry_date)
                    const expiringSoon = isExpiringSoon(material.expiry_date)

                    return (
                        <TableRow key={material.id}>
                            <TableCell className="font-medium">{material.name}</TableCell>
                            <TableCell>{material.manufacturer || '—'}</TableCell>
                            <TableCell className="font-mono text-sm">{material.lot_number}</TableCell>
                            <TableCell>
                                <Badge variant="outline">
                                    {material.level === 'low' ? 'Thấp' :
                                     material.level === 'normal' ? 'Bình thường' :
                                     material.level === 'high' ? 'Cao' : material.level}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                {material.expiry_date
                                    ? format(new Date(material.expiry_date), 'dd/MM/yyyy', { locale: vi })
                                    : '—'}
                            </TableCell>
                            <TableCell>
                                {expired ? (
                                    <Badge variant="destructive" className="gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        Hết hạn
                                    </Badge>
                                ) : expiringSoon ? (
                                    <Badge className="gap-1 bg-amber-100 text-amber-700">
                                        <AlertTriangle className="h-3 w-3" />
                                        Sắp hết hạn
                                    </Badge>
                                ) : (
                                    <Badge className="gap-1 bg-green-100 text-green-700">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Còn hạn
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Mở menu</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => setEditMaterial(material)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Sửa
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => setDeleteMaterial(material)}
                                            className="text-red-600"
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Xóa
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    )
                })}
            </TableBody>
        </Table>

        {/* Edit Dialog */}
        {editMaterial && (
            <QCMaterialDialog
                open={!!editMaterial}
                onOpenChange={(open) => !open && setEditMaterial(null)}
                mode="edit"
                material={editMaterial}
            />
        )}

        {/* Delete Dialog */}
        {deleteMaterial && (
            <DeleteQCMaterialDialog
                open={!!deleteMaterial}
                onOpenChange={(open) => !open && setDeleteMaterial(null)}
                material={deleteMaterial}
            />
        )}
        </>
    )
}

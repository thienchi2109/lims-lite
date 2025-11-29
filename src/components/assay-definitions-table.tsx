'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { AssayDefinitionDialog } from '@/components/assay-definition-dialog'
import { DeleteAssayDialog } from '@/components/delete-assay-dialog'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

type AssayDefinition = {
    id: string
    name: string
    method_id: string | null
    method_name: string | null
    units: string | null
    validation_rules: Record<string, any>
    created_at: string
    updated_at: string
}

type Props = {
    assays: AssayDefinition[]
    page: number
    pageSize: number
    totalPages: number
    totalCount: number
}

export function AssayDefinitionsTable({
    assays,
    page,
    pageSize,
    totalPages,
    totalCount,
}: Props) {
    const [editingAssay, setEditingAssay] = useState<AssayDefinition | null>(null)
    const [deletingAssay, setDeletingAssay] = useState<AssayDefinition | null>(null)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const updateQuery = (newPage: number, newPageSize: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', String(newPage))
        params.set('pageSize', String(newPageSize))
        router.replace(`${pathname}?${params.toString()}`)
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <p className="text-sm text-muted-foreground">
                        Tổng số: <span className="font-semibold">{totalCount}</span> chỉ tiêu
                    </p>
                </div>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm chỉ tiêu
                </Button>
            </div>

            {assays.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-slate-50 dark:bg-slate-900">
                    <p className="text-muted-foreground mb-4">
                        Chưa có chỉ tiêu xét nghiệm nào
                    </p>
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Thêm chỉ tiêu đầu tiên
                    </Button>
                </div>
            ) : (
                <>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tên chỉ tiêu</TableHead>
                                    <TableHead>Phương pháp</TableHead>
                                    <TableHead>Đơn vị</TableHead>
                                    <TableHead>Quy tắc xác thực</TableHead>
                                    <TableHead className="w-[100px]">Thao tác</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {assays.map((assay) => (
                                    <TableRow key={assay.id}>
                                        <TableCell className="font-medium">
                                            {assay.name}
                                        </TableCell>
                                        <TableCell>
                                            {assay.method_name ? (
                                                <Badge variant="outline">
                                                    {assay.method_name}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">
                                                    Chưa chỉ định
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {assay.units || (
                                                <span className="text-muted-foreground text-sm">
                                                    -
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {Object.keys(assay.validation_rules || {}).length > 0 ? (
                                                <Badge variant="secondary">
                                                    {Object.keys(assay.validation_rules).length} quy tắc
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">
                                                    Không có
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setEditingAssay(assay)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setDeletingAssay(assay)}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Hiển thị</span>
                            <Select
                                value={String(pageSize)}
                                onValueChange={(value) => updateQuery(1, Number(value))}
                            >
                                <SelectTrigger className="h-8 w-[70px]">
                                    <SelectValue placeholder={pageSize} />
                                </SelectTrigger>
                                <SelectContent side="top">
                                    {[10, 20, 50, 100].map((size) => (
                                        <SelectItem key={size} value={String(size)}>
                                            {size}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <span>
                                {(page - 1) * pageSize + 1} -{' '}
                                {Math.min(page * pageSize, totalCount)} của {totalCount} chỉ tiêu
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateQuery(Math.max(1, page - 1), pageSize)}
                                disabled={page === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Trước
                            </Button>
                            <div className="text-sm">
                                Trang {page} của {totalPages}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateQuery(Math.min(totalPages, page + 1), pageSize)}
                                disabled={page === totalPages}
                            >
                                Tiếp
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </>
            )}

            {/* Add Dialog */}
            <AssayDefinitionDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                mode="create"
            />

            {/* Edit Dialog */}
            {editingAssay && (
                <AssayDefinitionDialog
                    open={!!editingAssay}
                    onOpenChange={(open) => !open && setEditingAssay(null)}
                    mode="edit"
                    assay={editingAssay}
                />
            )}

            {/* Delete Dialog */}
            {deletingAssay && (
                <DeleteAssayDialog
                    open={!!deletingAssay}
                    onOpenChange={(open) => !open && setDeletingAssay(null)}
                    assay={deletingAssay}
                />
            )}
        </div>
    )
}

'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, FlaskConical, AlertCircle } from 'lucide-react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getAssayDefinitionMethodName } from '@/lib/assay-method-name'
import { AssayDefinitionDialog } from '@/components/assay-definition-dialog'
import { AssayDefinitionRowActions } from '@/components/assay-definition-row-actions'
import { DeleteAssayDialog } from '@/components/delete-assay-dialog'
import { AssayDefinitionsPagination } from '@/components/assay-definitions-pagination'
import { AssayDefinitionsTableToolbar } from '@/components/assay-definitions-table-toolbar'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { LabSpecialty } from '@/types'
import { AssayDefinition } from './assay-definition-dialog/types'

const EMPTY_SPECIALTIES: LabSpecialty[] = []

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
    specialties = EMPTY_SPECIALTIES,
}: Props & { specialties?: LabSpecialty[] }) {
    const [editingAssay, setEditingAssay] = useState<AssayDefinition | null>(null)
    const [viewingAssay, setViewingAssay] = useState<AssayDefinition | null>(null)
    const [deletingAssay, setDeletingAssay] = useState<AssayDefinition | null>(null)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [localAssays, setLocalAssays] = useState<AssayDefinition[]>(assays)
    useEffect(() => {
        setLocalAssays(assays)
    }, [assays])

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const matchesCurrentFilters = (candidate: Pick<AssayDefinition, 'name' | 'specialty_id'>) => {
        const specialtyFilter = searchParams.get('specialtyId')
        if (specialtyFilter && specialtyFilter !== 'all' && candidate.specialty_id !== specialtyFilter) {
            return false
        }

        const searchTerm = (searchParams.get('search') || '').trim().toLowerCase()
        if (searchTerm) {
            return candidate.name.toLowerCase().includes(searchTerm)
        }

        return true
    }

    const handleAssayCreated = (created: AssayDefinition) => {
        if (!matchesCurrentFilters(created)) return
        if (page !== 1) return

        setLocalAssays((prev) => {
            const next = [created, ...prev]
            return next.slice(0, pageSize)
        })
    }

    const handleAssayUpdated = (updated: AssayDefinition) => {
        setLocalAssays((prev) => {
            const existsIndex = prev.findIndex((a) => a.id === updated.id)

            if (!matchesCurrentFilters(updated)) {
                return existsIndex >= 0 ? prev.filter((a) => a.id !== updated.id) : prev
            }

            if (existsIndex >= 0) {
                return prev.map((a) =>
                    a.id === updated.id
                        ? { ...a, ...updated, methods: a.methods }
                        : a
                )
            }

            if (page !== 1) return prev

            const next = [updated, ...prev]
            return next.slice(0, pageSize)
        })
    }

    const handleAssayDeleted = (deletedId: string) => {
        setLocalAssays((prev) => prev.filter((a) => a.id !== deletedId))
    }

    const updateQuery = (newPage: number, newPageSize: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', String(newPage))
        params.set('pageSize', String(newPageSize))
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleSpecialtyFilter = (specialtyId: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (specialtyId && specialtyId !== 'all') {
            params.set('specialtyId', specialtyId)
        } else {
            params.delete('specialtyId')
        }
        params.set('page', '1')
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <div className="space-y-6">
            <AssayDefinitionsTableToolbar
                specialties={specialties}
                selectedSpecialtyId={searchParams.get('specialtyId') || 'all'}
                totalCount={totalCount}
                onSpecialtyFilter={handleSpecialtyFilter}
                onAdd={() => setIsAddDialogOpen(true)}
            />

            {localAssays.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-slate-900 rounded-lg border border-dashed">
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-full mb-4">
                        <FlaskConical className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        Chưa có chỉ tiêu xét nghiệm
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-sm text-center">
                        Bắt đầu bằng cách thêm chỉ tiêu xét nghiệm mới vào hệ thống hoặc thay đổi bộ lọc tìm kiếm.
                    </p>
                    <Button onClick={() => setIsAddDialogOpen(true)} variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Thêm chỉ tiêu đầu tiên
                    </Button>
                </div>
            ) : (
                <>
                    <Card className="overflow-hidden border shadow-sm bg-white dark:bg-slate-900">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <TableHead className="w-[250px] font-semibold text-slate-700 dark:text-slate-300">Tên chỉ tiêu</TableHead>
                                    <TableHead className="w-[180px] font-semibold text-slate-700 dark:text-slate-300">Nhóm kỹ thuật</TableHead>
                                    <TableHead className="w-[200px] font-semibold text-slate-700 dark:text-slate-300">Phương pháp</TableHead>
                                    <TableHead className="w-[100px] font-semibold text-slate-700 dark:text-slate-300">Đơn vị</TableHead>
                                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Quy tắc xác thực</TableHead>
                                    <TableHead className="w-[100px] text-right font-semibold text-slate-700 dark:text-slate-300">Thao tác</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {localAssays.map((assay) => (
                                    <TableRow key={assay.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <TableCell className="font-medium">
                                            {assay.name}
                                        </TableCell>
                                        <TableCell>
                                            {assay.specialty_id ? (
                                                (() => {
                                                    const sp = specialties.find(
                                                        (s) => s.id === assay.specialty_id
                                                    )
                                                    const colorMap: Record<string, string> = {
                                                        HEM: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100', // Huyết học
                                                        BIO: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100', // Sinh hóa
                                                        IMM: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100', // Miễn dịch
                                                        MIC: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100', // Vi sinh
                                                    }
                                                    return (
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                'px-2.5 py-0.5 rounded-full font-medium transition-colors',
                                                                sp?.code ? colorMap[sp.code] : ''
                                                            )}
                                                        >
                                                            {sp?.name || 'Unknown'}
                                                        </Badge>
                                                    )
                                                })()
                                            ) : (
                                                <span className="text-muted-foreground/50 text-sm italic">
                                                    -
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {getAssayDefinitionMethodName(assay) ? (
                                                <Badge
                                                    variant="secondary"
                                                    className="font-normal bg-slate-100 text-slate-700 hover:bg-slate-200 border-0"
                                                >
                                                    {getAssayDefinitionMethodName(assay)}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">
                                                    Chưa chỉ định
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {assay.units || (
                                                <span className="text-muted-foreground text-sm">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {Object.keys(assay.validation_rules || {}).length > 0 ? (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                                                    <AlertCircle className="h-3.5 w-3.5 text-blue-500" />
                                                    <span>
                                                        {Object.keys(assay.validation_rules || {}).length} quy tắc
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground/50 text-sm italic">
                                                    -
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <AssayDefinitionRowActions
                                                assay={assay}
                                                onView={setViewingAssay}
                                                onEdit={setEditingAssay}
                                                onDelete={setDeletingAssay}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>

                    <AssayDefinitionsPagination
                        page={page}
                        pageSize={pageSize}
                        totalPages={totalPages}
                        totalCount={totalCount}
                        onPageChange={updateQuery}
                    />
                </>
            )}

            <AssayDefinitionDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                mode="create"
                specialties={specialties}
                onCreated={handleAssayCreated}
            />

            {editingAssay && (
                <AssayDefinitionDialog
                    open={!!editingAssay}
                    onOpenChange={(open) => !open && setEditingAssay(null)}
                    mode="edit"
                    assay={editingAssay}
                    specialties={specialties}
                    onUpdated={handleAssayUpdated}
                />
            )}

            {viewingAssay && (
                <AssayDefinitionDialog
                    open={!!viewingAssay}
                    onOpenChange={(open) => !open && setViewingAssay(null)}
                    mode="view"
                    assay={viewingAssay}
                    specialties={specialties}
                />
            )}

            {deletingAssay && (
                <DeleteAssayDialog
                    open={!!deletingAssay}
                    onOpenChange={(open) => !open && setDeletingAssay(null)}
                    assay={deletingAssay}
                    onDeleted={handleAssayDeleted}
                />
            )}
        </div>
    )
}

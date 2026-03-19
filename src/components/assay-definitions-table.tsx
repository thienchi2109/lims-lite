'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Search, Filter, FlaskConical, TestTube2, AlertCircle } from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
import { SearchInput } from '@/components/ui/search-input'
import { LabSpecialty } from '@/types'
import { AssayDefinition, AssayMethod } from './assay-definition-dialog/types'

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
        params.set('page', '1') // Reset to page 1
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <div className="space-y-6">
            {/* Toolbar Section */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-4 rounded-lg border shadow-sm">
                <div className="flex flex-1 items-center gap-3">
                    <div className="relative w-full sm:w-72">
                        <SearchInput
                            placeholder="Tìm kiếm tên, mã chỉ tiêu..."
                            className="w-full pl-9 bg-slate-50 dark:bg-slate-950 border-slate-200"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>

                    <Separator orientation="vertical" className="h-8 hidden sm:block" />

                    <Select
                        value={searchParams.get('specialtyId') || 'all'}
                        onValueChange={handleSpecialtyFilter}
                    >
                        <SelectTrigger className="w-[240px] bg-slate-50 dark:bg-slate-950 border-slate-200">
                            <div className="flex items-center gap-2 text-muted-foreground truncate">
                                <Filter className="h-3.5 w-3.5 flex-shrink-0" />
                                <SelectValue placeholder="Nhóm kỹ thuật" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tất cả Nhóm kỹ thuật</SelectItem>
                            {specialties.map((specialty) => (
                                <SelectItem key={specialty.id} value={specialty.id}>
                                    {specialty.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400">
                        <TestTube2 className="h-3.5 w-3.5" />
                        {totalCount} chỉ tiêu
                    </div>
                    <Button onClick={() => setIsAddDialogOpen(true)} className="bg-primary hover:bg-primary/90 shadow-sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Thêm mới
                    </Button>
                </div>
            </div>

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
                                            {assay.methods && assay.methods.length > 0 ? (
                                                <div className="flex flex-col gap-1 items-start">
                                                    {assay.methods.find((m) => m.is_default) ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <Badge
                                                                variant="secondary"
                                                                className="font-normal bg-slate-100 text-slate-700 hover:bg-slate-200 border-0"
                                                            >
                                                                {
                                                                    assay.methods.find(
                                                                        (m) => m.is_default
                                                                    )?.name
                                                                }
                                                            </Badge>
                                                            {assay.methods.length > 1 && (
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Badge
                                                                                variant="outline"
                                                                                className="h-5 px-1.5 text-[10px] text-muted-foreground border-dashed cursor-help"
                                                                            >
                                                                                +{assay.methods.length - 1}
                                                                            </Badge>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <div className="flex flex-col gap-1">
                                                                                <span className="font-semibold text-xs">
                                                                                    Phương pháp khác:
                                                                                </span>
                                                                                {assay.methods
                                                                                    .filter(
                                                                                        (m) => !m.is_default
                                                                                    )
                                                                                    .map((m) => (
                                                                                        <span
                                                                                            key={m.id}
                                                                                            className="text-xs text-muted-foreground"
                                                                                        >
                                                                                            • {m.name}
                                                                                        </span>
                                                                                    ))}
                                                                            </div>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-muted-foreground font-normal"
                                                        >
                                                            {assay.methods[0].name}
                                                        </Badge>
                                                    )}
                                                </div>
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
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                                    onClick={() => setEditingAssay(assay)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => setDeletingAssay(assay)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>

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
                            <div className="text-sm font-medium min-w-[3rem] text-center">
                                Trang {page} / {totalPages}
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

            {/* Dialogs */}
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

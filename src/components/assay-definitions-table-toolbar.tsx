'use client'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { SearchInput } from '@/components/ui/search-input'
import { Filter, Plus, Search, TestTube2 } from 'lucide-react'
import { LabSpecialty } from '@/types'

type Props = {
    specialties: LabSpecialty[]
    selectedSpecialtyId: string
    totalCount: number
    onSpecialtyFilter: (specialtyId: string) => void
    onAdd: () => void
}

export function AssayDefinitionsTableToolbar({
    specialties,
    selectedSpecialtyId,
    totalCount,
    onSpecialtyFilter,
    onAdd,
}: Props) {
    return (
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

                <Select value={selectedSpecialtyId} onValueChange={onSpecialtyFilter}>
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
                <Button onClick={onAdd} className="bg-primary hover:bg-primary/90 shadow-sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm mới
                </Button>
            </div>
        </div>
    )
}

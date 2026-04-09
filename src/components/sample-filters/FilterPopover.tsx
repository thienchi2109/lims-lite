'use client'

import { Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type SampleStatus, type LabSpecialty } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { statusOptions } from './constants'

type FilterPopoverProps = {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    specialties: LabSpecialty[]
    receiverOptions: Array<{ id: string; name: string }>
    selectedSpecialtyIds: string[]
    status: SampleStatus | 'all'
    receiverId: string
    fromDate: string
    toDate: string
    onToggleSpecialty: (id: string) => void
    onStatusChange: (value: SampleStatus | 'all') => void
    onReceiverChange: (value: string) => void
    onFromDateChange: (value: string) => void
    onToDateChange: (value: string) => void
    onDateRangePreset: (range: 'today' | 'yesterday' | 'week' | 'month') => void
    onReset: () => void
    activeFiltersCount: number
}

export function FilterPopover({
    isOpen,
    onOpenChange,
    specialties,
    receiverOptions,
    selectedSpecialtyIds,
    status,
    receiverId,
    fromDate,
    toDate,
    onToggleSpecialty,
    onStatusChange,
    onReceiverChange,
    onFromDateChange,
    onToDateChange,
    onDateRangePreset,
    onReset,
    activeFiltersCount,
}: FilterPopoverProps) {
    const sortedSpecialties = [...specialties].sort((a, b) => a.display_order - b.display_order)
    const receiverValue = receiverId || 'all'

    return (
        <Popover open={isOpen} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant={activeFiltersCount > 0 ? "secondary" : "outline"}
                    className={cn(
                        "h-10 gap-2 font-normal",
                        activeFiltersCount > 0 && "bg-sky-100/50 text-sky-700 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-400"
                    )}
                >
                    <Filter className="h-4 w-4" />
                    <span>Bộ lọc</span>
                    {activeFiltersCount > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-sky-200 dark:bg-sky-800 text-sky-800 dark:text-sky-200 text-[10px]">
                            {activeFiltersCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0" align="end">
                <div className="flex flex-col h-[85vh] sm:h-auto overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                        <h4 className="font-semibold text-sm">Bộ lọc nâng cao</h4>
                        {activeFiltersCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onReset}
                                className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive"
                            >
                                Xóa tất cả
                            </Button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Specialty Filter */}
                        {specialties.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-slate-500">Nhóm kỹ thuật</Label>
                                <div className="flex flex-wrap gap-1.5">
                                    {sortedSpecialties.map((specialty) => {
                                        const isSelected = selectedSpecialtyIds.includes(specialty.id)
                                        return (
                                            <Tooltip key={specialty.id}>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={() => onToggleSpecialty(specialty.id)}
                                                        className={cn(
                                                            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                                                            isSelected
                                                                ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                                                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                                                        )}
                                                    >
                                                        {specialty.code}
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{specialty.name}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="h-[1px] bg-slate-100 dark:bg-slate-800" />

                        {/* Status Filter */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500">Trạng thái</Label>
                            <Select value={status} onValueChange={(val) => onStatusChange(val as SampleStatus | 'all')}>
                                <SelectTrigger className="w-full h-9 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {statusOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            <div className="flex items-center gap-2">
                                                <div className={cn("h-2 w-2 rounded-full", option.color)} />
                                                {option.label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Receiver Filter */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500">Người nhận</Label>
                            <Select value={receiverValue} onValueChange={onReceiverChange}>
                                <SelectTrigger className="w-full h-9 text-sm">
                                    <SelectValue placeholder="Chọn người nhận" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tất cả người nhận</SelectItem>
                                    {receiverOptions.map((receiver) => (
                                        <SelectItem key={receiver.id} value={receiver.id}>
                                            {receiver.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Date Filter */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500">Ngày nhận mẫu</Label>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <Button variant="outline" size="sm" onClick={() => onDateRangePreset('today')} className="text-xs h-7">Hôm nay</Button>
                                <Button variant="outline" size="sm" onClick={() => onDateRangePreset('week')} className="text-xs h-7">Tuần này</Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-muted-foreground">Từ ngày</span>
                                    <Input
                                        type="date"
                                        value={fromDate}
                                        onChange={(e) => onFromDateChange(e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] text-muted-foreground">Đến ngày</span>
                                    <Input
                                        type="date"
                                        value={toDate}
                                        onChange={(e) => onToDateChange(e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

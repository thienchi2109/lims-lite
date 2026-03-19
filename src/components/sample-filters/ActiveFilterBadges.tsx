'use client'

import { Calendar, X } from 'lucide-react'
import { type SampleStatus, type LabSpecialty } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { statusOptions } from './constants'

type ActiveFilterBadgesProps = {
    specialties: LabSpecialty[]
    selectedSpecialtyIds: string[]
    scope: 'active' | 'all'
    status: SampleStatus | 'all'
    receiverId: string
    receiverOptions: Array<{ id: string; name: string }>
    fromDate: string
    toDate: string
    onRemoveSpecialty: (id: string) => void
    onClearStatus: () => void
    onClearReceiver: () => void
    onClearDates: () => void
    onResetAll: () => void
}

export function ActiveFilterBadges({
    specialties,
    selectedSpecialtyIds,
    scope,
    status,
    receiverId,
    receiverOptions,
    fromDate,
    toDate,
    onRemoveSpecialty,
    onClearStatus,
    onClearReceiver,
    onClearDates,
    onResetAll,
}: ActiveFilterBadgesProps) {
    const isActiveScope = scope === 'active' && status === 'all'
    const hasExplicitFilters = status !== 'all' || receiverId !== '' || fromDate || toDate || selectedSpecialtyIds.length > 0
    const hasActiveFilters = isActiveScope || hasExplicitFilters

    if (!hasActiveFilters) return null

    return (
        <div className="flex flex-wrap gap-2 items-center pt-1">
            <span className="text-xs font-medium text-slate-500 mr-1">Đang lọc:</span>

            {isActiveScope && (
                <Badge variant="outline" className="h-7 gap-1 bg-white dark:bg-slate-900 border-dashed border-emerald-300 dark:border-emerald-800 pl-2 pr-2">
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        Mặc định ẩn mẫu hoàn thành
                    </span>
                </Badge>
            )}

            {/* Specialty Badges */}
            {selectedSpecialtyIds.map(id => {
                const specialty = specialties.find(s => s.id === id)
                if (!specialty) return null
                return (
                    <TooltipProvider key={id}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="cursor-help inline-flex">
                                    <Badge variant="outline" className="h-7 gap-1 bg-white dark:bg-slate-900 border-dashed border-sky-400 dark:border-sky-800 pl-2 pr-1">
                                        <span className="font-normal text-muted-foreground">Nhóm:</span>
                                        <span className="font-medium text-sky-700 dark:text-sky-400">{specialty.code}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => onRemoveSpecialty(id)}
                                            className="h-4 w-4 ml-1 hover:bg-transparent text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </Badge>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{specialty.name}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )
            })}

            {/* Status Badge */}
            {status !== 'all' && (
                <Badge variant="outline" className="h-7 gap-1 bg-white dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-700 pl-2 pr-1">
                    <span className="font-normal text-muted-foreground">Trạng thái:</span>
                    <span className="font-medium text-foreground">
                        {statusOptions.find(o => o.value === status)?.label}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onClearStatus}
                        className="h-4 w-4 ml-1 hover:bg-transparent text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </Badge>
            )}

            {/* Receiver Badge */}
            {receiverId !== '' && (
                <Badge variant="outline" className="h-7 gap-1 bg-white dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-700 pl-2 pr-1">
                    <span className="font-normal text-muted-foreground">Người nhận:</span>
                    <span className="font-medium text-foreground">
                        {receiverOptions.find(r => r.id === receiverId)?.name || 'Unknown'}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onClearReceiver}
                        className="h-4 w-4 ml-1 hover:bg-transparent text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </Badge>
            )}

            {/* Date Badge */}
            {(fromDate || toDate) && (
                <Badge variant="outline" className="h-7 gap-1 bg-white dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-700 pl-2 pr-1">
                    <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
                    <span className="font-medium text-foreground">
                        {fromDate ? new Date(fromDate).toLocaleDateString('vi-VN') : '...'} - {toDate ? new Date(toDate).toLocaleDateString('vi-VN') : '...'}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onClearDates}
                        className="h-4 w-4 ml-1 hover:bg-transparent text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </Badge>
            )}

            {/* Clear All Button */}
            {hasExplicitFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onResetAll}
                    className="h-7 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 px-2"
                >
                    Xóa tất cả
                </Button>
            )}
        </div>
    )
}

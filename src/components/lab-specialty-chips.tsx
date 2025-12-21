'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, X, ListFilter, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { LabSpecialty } from '@/types'

type LabSpecialtyChipsProps = {
    specialties: LabSpecialty[]
    selectedIds?: string[]
}

/**
 * Toggle chips for filtering samples by lab specialty (nhóm kỹ thuật).
 * Updates URL params for shareable, bookmark-able filter state.
 * Uses OR logic - shows samples with ANY selected specialty.
 */
export function LabSpecialtyChips({
    specialties,
    selectedIds = [],
}: LabSpecialtyChipsProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const searchParamsString = useMemo(() => searchParams.toString(), [searchParams])

    // Sort specialties by display_order
    const sortedSpecialties = useMemo(
        () => [...specialties].sort((a, b) => a.display_order - b.display_order),
        [specialties]
    )

    const updateUrl = (newSelectedIds: string[]) => {
        const params = new URLSearchParams(searchParamsString)

        if (newSelectedIds.length > 0) {
            params.set('specialtyIds', newSelectedIds.join(','))
        } else {
            params.delete('specialtyIds')
        }

        // Reset to page 1 when filter changes
        params.set('page', '1')

        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname)
    }

    const toggleSpecialty = (id: string) => {
        const isSelected = selectedIds.includes(id)
        const newSelectedIds = isSelected
            ? selectedIds.filter((selectedId) => selectedId !== id)
            : [...selectedIds, id]
        updateUrl(newSelectedIds)
    }

    const clearAll = () => {
        updateUrl([])
    }

    const selectedCount = selectedIds.length

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white/50 p-3 backdrop-blur-sm">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">
                    Lọc theo nhóm kỹ thuật:
                </span>
                {selectedCount > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">
                            Đã chọn: {selectedCount} nhóm
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearAll}
                            className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700"
                            aria-label="Xóa lọc nhóm kỹ thuật"
                        >
                            <X className="mr-1 h-3 w-3" aria-hidden="true" />
                            Xóa
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo nhóm kỹ thuật">
                {sortedSpecialties.map((specialty) => {
                    const isSelected = selectedIds.includes(specialty.id)
                    return (
                        <button
                            key={specialty.id}
                            type="button"
                            onClick={() => toggleSpecialty(specialty.id)}
                            aria-pressed={isSelected}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
                                'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1',
                                isSelected
                                    ? 'border-sky-500 bg-sky-500 text-white hover:bg-sky-600'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            )}
                        >
                            {isSelected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                            <span>{specialty.code}</span>
                            <span className="hidden sm:inline">- {specialty.name}</span>
                        </button>
                    )
                })}
            </div>

            {selectedCount === 0 && (
                <p className="text-xs text-slate-400">
                    Nhấp vào nhóm kỹ thuật để lọc mẫu
                </p>
            )}
        </div>
    )
}

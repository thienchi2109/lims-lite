'use client'

import React from 'react'
import { AssayDefinitionWithMethods, SelectedTest, LabSpecialty } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SPECIALTY_BADGE_CLASSES } from '@/lib/specialty-badges'
import { cn } from '@/lib/utils'

interface MobileTestCardProps {
    test: AssayDefinitionWithMethods
    isSelected: boolean
    selectedTest?: SelectedTest
    onToggle: (test: AssayDefinitionWithMethods) => void
    onMethodChange: (assayId: string, methodId: string) => void
    isDisabled?: boolean
    specialty?: LabSpecialty | null
}

export const MobileTestCard = React.memo(function MobileTestCard({
    test,
    isSelected,
    selectedTest,
    onToggle,
    onMethodChange,
    isDisabled,
    specialty
}: MobileTestCardProps) {
    return (
        <div
            onClick={() => !isDisabled && onToggle(test)}
            className={cn(
                "relative flex items-start gap-4 p-4 border-b border-slate-100 dark:border-slate-800 transition-all duration-200 active:scale-[0.99] touch-manipulation cursor-pointer select-none",
                isSelected
                    ? "bg-sky-50/60 dark:bg-sky-900/10 border-l-4 border-l-sky-500 pl-[12px]"
                    : "bg-white dark:bg-slate-950 border-l-4 border-l-transparent",
                isDisabled && "opacity-50 pointer-events-none"
            )}
        >
            {/* Custom Checkbox (Large Touch Target) */}
            <div className="pt-0.5">
                <div className={cn(
                    "h-6 w-6 rounded border flex items-center justify-center transition-colors shadow-sm",
                    isSelected
                        ? "bg-sky-600 border-sky-600"
                        : "border-slate-300 bg-white dark:bg-slate-900 dark:border-slate-700"
                )}>
                    {isSelected && (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-3.5 h-3.5 text-white animate-in zoom-in duration-200"
                        >
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                        <div className={cn(
                            "font-semibold text-base leading-tight transition-colors",
                            isSelected ? "text-sky-900 dark:text-sky-100" : "text-slate-900 dark:text-slate-100"
                        )}>
                            {test.name}
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                            {specialty && (
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-sm border-0",
                                        specialty.code && SPECIALTY_BADGE_CLASSES[specialty.code]
                                            ? SPECIALTY_BADGE_CLASSES[specialty.code].replace('bg-', 'bg-opacity-10 text-').replace('border-', '') + ' bg-' + specialty.code + '-100 text-' + specialty.code + '-700'
                                            : 'bg-slate-100 text-slate-600'
                                    )}
                                >
                                    {specialty.name}
                                </Badge>
                            )}

                            {/* Method Display (Static if not selected or single method) */}
                            {(!isSelected || test.methods.length <= 1) && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {test.methods[0]?.name || 'Không có phương pháp'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Method Selector (Only visible if selected AND has multiple methods) - Prevents click propagation */}
                {isSelected && test.methods.length > 1 && (
                    <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200" onClick={(e) => e.stopPropagation()}>
                        <Select
                            value={selectedTest?.methodId}
                            onValueChange={(val) => onMethodChange(test.id, val)}
                        >
                            <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 w-full shadow-sm active:scale-[0.98] transition-transform">
                                <span className="text-slate-500 mr-2">Phương pháp:</span>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {test.methods.map(m => (
                                    <SelectItem key={m.method_id} value={m.method_id} className="text-xs py-3">
                                        {m.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
        </div>
    )
}, (prev, next) => {
    return (
        prev.test.id === next.test.id &&
        prev.isSelected === next.isSelected &&
        prev.isDisabled === next.isDisabled &&
        prev.selectedTest?.methodId === next.selectedTest?.methodId
    )
})

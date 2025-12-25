import React, { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { AssayDefinitionWithMethods, SelectedTest } from '@/types'
import type { GridRow } from '@/types/test-assignment'
import { SPECIALTY_BADGE_CLASSES } from '@/lib/specialty-badges'
import { cn } from '@/lib/utils'
import {
    ChevronDown,
    Check,
    Search,
    Loader2,
    ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface MobileViewProps {
    // Context
    context?: React.ReactNode
    isContextOpen: boolean
    setIsContextOpen: (open: boolean) => void

    // Search & Filters
    searchQuery: string
    setSearchQuery: (query: string) => void
    selectedSpecialtyId: string
    setSelectedSpecialtyId: (id: string) => void
    specialties: Array<{ id: string; name: string; code: string }>

    // Data
    groupedRows: GridRow[]
    isLoading: boolean
    disabledSet: Set<string>
    specialtiesMap: Map<string, { id: string; name: string; code: string }>

    // Selection
    selected: SelectedTest[]
    onChange: (tests: SelectedTest[]) => void
    toggleTestSelection: (assay: AssayDefinitionWithMethods) => void

    // Save
    onSave: () => void
    isSaving: boolean
}

export function MobileView({
    context,
    isContextOpen,
    setIsContextOpen,
    searchQuery,
    setSearchQuery,
    selectedSpecialtyId,
    setSelectedSpecialtyId,
    specialties,
    groupedRows,
    isLoading,
    disabledSet,
    specialtiesMap,
    selected,
    onChange,
    toggleTestSelection,
    onSave,
    isSaving
}: MobileViewProps) {
    const parentRef = useRef<HTMLDivElement>(null)

    const rowVirtualizer = useVirtualizer({
        count: groupedRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => {
            const row = groupedRows[index]
            return row?.type === 'group' ? 44 : 88
        },
        overscan: 20,
    })

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 gap-4 overflow-hidden">
            {/* Context Collapsible */}
            <Collapsible
                open={isContextOpen}
                onOpenChange={setIsContextOpen}
                className="flex-shrink-0 space-y-2"
            >
                <div className="flex items-center justify-between px-1">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                        Thông tin hành chính
                    </h3>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full">
                            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isContextOpen ? "rotate-180" : "")} />
                            <span className="sr-only">Toggle Info</span>
                        </Button>
                    </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="space-y-4 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                    {context}
                </CollapsibleContent>
            </Collapsible>

            {/* Test Selection Card */}
            <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden relative">
                {/* Sticky Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3 bg-white dark:bg-slate-900 z-10">
                    {/* Search */}
                    <div className="relative w-full">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                            <Search size={18} />
                        </span>
                        <input
                            type="text"
                            placeholder="Tìm kiếm chỉ tiêu (ALT, Glucose...)"
                            className="w-full pl-10 pr-4 py-2 rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm outline-none transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Filter Pills */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        <button
                            onClick={() => setSelectedSpecialtyId('all')}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                                selectedSpecialtyId === 'all'
                                    ? "bg-blue-500 text-white shadow-sm"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                            )}
                        >
                            Tất cả
                        </button>
                        {specialties.map(spec => (
                            <button
                                key={spec.id}
                                onClick={() => setSelectedSpecialtyId(spec.id)}
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                                    selectedSpecialtyId === spec.id
                                        ? "bg-blue-500 text-white shadow-sm"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                                )}
                            >
                                {spec.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Virtualized List */}
                <div
                    ref={parentRef}
                    className="flex-1 overflow-auto w-full relative pb-20 scroll-smooth"
                >
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {isLoading && groupedRows.length === 0 ? (
                            <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-muted-foreground pt-10">
                                <div className="flex justify-center items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Đang tải...
                                </div>
                            </div>
                        ) : groupedRows.length === 0 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center pt-10">
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Không tìm thấy</h3>
                            </div>
                        ) : (
                            rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                const row = groupedRows[virtualRow.index]
                                if (!row) return null

                                if (row.type === 'group') {
                                    return (
                                        <div
                                            key={row.key}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                transform: `translateY(${virtualRow.start}px)`,
                                            }}
                                            className="px-2 pt-3"
                                        >
                                            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                                                {row.badgeClass ? (
                                                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap", row.badgeClass)}>
                                                        {row.label}
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                                        {row.label}
                                                    </span>
                                                )}
                                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                                    {row.count} chỉ tiêu
                                                </span>
                                            </div>
                                        </div>
                                    )
                                }

                                const test = row.assay
                                const selectedTest = selected.find(t => t.assayId === test.id)
                                const isSelected = !!selectedTest
                                const isDisabled = disabledSet.has(test.id)
                                const specialty = test.specialty_id ? specialtiesMap.get(test.specialty_id) : null

                                return (
                                    <div
                                        key={test.id}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                        className="px-2 pt-2"
                                    >
                                        <label className={cn(
                                            "group relative flex items-center p-3 rounded-lg border cursor-pointer transition-all",
                                            isSelected
                                                ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                                                : "bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800",
                                            isDisabled && "opacity-50 cursor-not-allowed"
                                        )}>
                                            <div
                                                className={cn(
                                                    "flex items-center justify-center w-5 h-5 rounded border transition-colors mr-3",
                                                    isSelected
                                                        ? "bg-blue-500 border-blue-500 text-white"
                                                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                                )}
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    !isDisabled && toggleTestSelection(test)
                                                }}
                                            >
                                                {isSelected && <Check size={14} strokeWidth={3} />}
                                            </div>

                                            <div className="flex-1 min-w-0" onClick={() => !isDisabled && toggleTestSelection(test)}>
                                                <div className="flex justify-between items-start">
                                                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate pr-2">
                                                        {test.name}
                                                    </span>
                                                    {specialty && (
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap",
                                                            SPECIALTY_BADGE_CLASSES[specialty.code] || "bg-slate-100 text-slate-700"
                                                        )}>
                                                            {specialty.name}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                                                    {test.methods.length > 0 ? (test.methods.length > 1 ? `${test.methods.length} phương pháp` : test.methods[0].name) : 'N/A'}
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-md animate-in zoom-in duration-200 key={selected.length}">
                                    {selected.length}
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Đã chọn</span>
                                <button
                                    onClick={() => onChange([])}
                                    disabled={selected.length === 0}
                                    className="text-xs text-red-500 hover:text-red-600 hover:underline text-left disabled:opacity-50"
                                >
                                    Xóa hết
                                </button>
                            </div>
                        </div>
                        <Button
                            onClick={onSave}
                            disabled={isSaving}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 h-auto rounded-xl font-medium shadow-lg shadow-blue-500/30 transition-transform active:scale-95 flex items-center gap-2"
                        >
                            {isSaving ? <Loader2 className="animate-spin" /> : <span>Tiếp tục</span>}
                            {!isSaving && <ArrowRight size={20} />}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

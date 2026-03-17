'use client'

/**
 * AccessionMobileLayout
 *
 * Layout orchestrator for mobile accession test selection (< 1280px).
 * Composes: context collapsible, search/filter, accordion test list,
 * selected tests summary strip, and bottom action bar.
 */

import { cn } from '@/lib/utils'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { AccessionMobileTestList } from '@/components/accession-mobile-test-list'
import {
    Search,
    ChevronDown,
    Loader2,
    ArrowRight,
    X,
} from 'lucide-react'
import type { AssayDefinitionWithMethods, SelectedTest } from '@/types'
import type { GridRow } from '@/types/test-assignment'

interface AccessionMobileLayoutProps {
    context?: React.ReactNode
    isContextOpen: boolean
    setIsContextOpen: (open: boolean) => void
    searchQuery: string
    setSearchQuery: (query: string) => void
    selectedSpecialtyId: string
    setSelectedSpecialtyId: (id: string) => void
    specialties: Array<{ id: string; name: string; code: string }>
    groupedRows: GridRow[]
    isLoading: boolean
    disabledSet: Set<string>
    specialtiesMap: Map<string, { id: string; name: string; code: string }>
    selected: SelectedTest[]
    onChange: (tests: SelectedTest[]) => void
    toggleTestSelection: (assay: AssayDefinitionWithMethods) => void
    handleMethodChange: (assayId: string, methodId: string) => void
    onSave: () => void
    isSaving: boolean
    isSaveDisabled?: boolean
    saveLabel: string
}

export function AccessionMobileLayout({
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
    handleMethodChange,
    onSave,
    isSaving,
    isSaveDisabled,
    saveLabel,
}: AccessionMobileLayoutProps) {
    const handleRemoveTest = (assayId: string) => {
        onChange(selected.filter((t) => t.assayId !== assayId))
    }

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
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full"
                        >
                            <ChevronDown
                                className={cn(
                                    'h-4 w-4 transition-transform duration-200',
                                    isContextOpen ? 'rotate-180' : '',
                                )}
                            />
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
                {/* Sticky Header: Search + Filter */}
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
                            type="button"
                            onClick={() => setSelectedSpecialtyId('all')}
                            className={cn(
                                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                                selectedSpecialtyId === 'all'
                                    ? 'bg-blue-500 text-white shadow-sm'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
                            )}
                        >
                            Tất cả
                        </button>
                        {specialties.map((spec) => (
                            <button
                                type="button"
                                key={spec.id}
                                onClick={() => setSelectedSpecialtyId(spec.id)}
                                className={cn(
                                    'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                                    selectedSpecialtyId === spec.id
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
                                )}
                            >
                                {spec.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Accordion Test List */}
                <div className={cn(
                    'flex-1 overflow-auto w-full relative scroll-smooth px-2 pt-2',
                    selected.length > 0 ? 'pb-32' : 'pb-20',
                )}>
                    <AccessionMobileTestList
                        groupedRows={groupedRows}
                        selected={selected}
                        toggleTestSelection={toggleTestSelection}
                        handleMethodChange={handleMethodChange}
                        disabledSet={disabledSet}
                        specialtiesMap={specialtiesMap}
                        searchQuery={searchQuery}
                        isLoading={isLoading}
                    />
                </div>

                {/* Selected Tests Summary Strip */}
                {selected.length > 0 && (
                    <div
                        data-testid="selected-strip"
                        className="absolute bottom-[64px] left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 px-2.5 py-1.5 z-20"
                    >
                        <div className="flex gap-2 overflow-x-auto no-scrollbar">
                            {selected.map((test) => (
                                <div
                                    key={test.assayId}
                                    data-testid={`chip-${test.assayId}`}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-medium whitespace-nowrap shrink-0"
                                >
                                    <span>{test.assayName}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveTest(test.assayId)}
                                        className="ml-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors"
                                        aria-label={`Xóa ${test.assayName}`}
                                    >
                                        <X size={11} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Bottom Bar */}
                <div
                    data-testid="bottom-bar"
                    className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-3 py-2.5 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm">
                                {selected.length}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                    Đã chọn
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onChange([])}
                                    disabled={selected.length === 0}
                                    className="text-[11px] text-red-500 hover:text-red-600 hover:underline text-left disabled:opacity-50"
                                >
                                    Xóa hết
                                </button>
                            </div>
                        </div>
                        <Button
                            type="button"
                            data-testid="save-button"
                            onClick={onSave}
                            disabled={isSaving || isSaveDisabled}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 h-9 rounded-lg text-xs font-semibold shadow-md shadow-blue-500/20 transition-transform active:scale-95 flex items-center gap-1.5"
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <span>{saveLabel}</span>
                            )}
                            {!isSaving && <ArrowRight size={16} />}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

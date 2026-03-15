'use client'

/**
 * AccessionMobileTestList
 *
 * Renders lab test catalog as accordion-based specialty groups for mobile.
 * - Single-expand: only one group open at a time
 * - Shows test name + method name per row
 * - Falls back to flat list when searchQuery is active
 * - Expand state is local (not shared with desktop view)
 */

import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'
import { SPECIALTY_BADGE_CLASSES } from '@/lib/specialty-badges'
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from '@/components/ui/accordion'
import { Check, Loader2, ChevronDown } from 'lucide-react'
import type { AssayDefinitionWithMethods, SelectedTest } from '@/types'
import type { GridRow } from '@/types/test-assignment'

interface AccessionMobileTestListProps {
    groupedRows: GridRow[]
    selected: SelectedTest[]
    toggleTestSelection: (assay: AssayDefinitionWithMethods) => void
    handleMethodChange: (assayId: string, methodId: string) => void
    disabledSet: Set<string>
    specialtiesMap: Map<string, { id: string; name: string; code: string }>
    searchQuery: string
    isLoading: boolean
}

export function AccessionMobileTestList({
    groupedRows,
    selected,
    toggleTestSelection,
    handleMethodChange,
    disabledSet,
    specialtiesMap,
    searchQuery,
    isLoading,
}: AccessionMobileTestListProps) {
    // Loading state
    if (isLoading && groupedRows.length === 0) {
        return (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Đang tải...
            </div>
        )
    }

    // Empty state
    if (groupedRows.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Không tìm thấy
                </h3>
            </div>
        )
    }

    const selectedSet = new Set(selected.map((t) => t.assayId))

    // When search is active → virtualized flat list (no accordion)
    if (searchQuery.trim() !== '') {
        const assayRows = groupedRows.filter(
            (row): row is GridRow & { type: 'assay' } => row.type === 'assay',
        )

        return (
            <VirtualizedFlatList
                assayRows={assayRows}
                selectedSet={selectedSet}
                selectedTests={selected}
                disabledSet={disabledSet}
                specialtiesMap={specialtiesMap}
                toggleTestSelection={toggleTestSelection}
                handleMethodChange={handleMethodChange}
            />
        )
    }

    // Group the rows into sections
    const groups = buildGroups(groupedRows)

    return (
        <Accordion type="single" collapsible className="w-full">
            {groups.map((group) => (
                <AccordionItem key={group.key} value={group.key}>
                    <AccordionTrigger
                        className="px-3 py-2.5 hover:no-underline"
                    >
                        <div className="flex items-center justify-between w-full pr-2">
                            <div className="flex items-center gap-2">
                                {group.badgeClass ? (
                                    <span
                                        className={cn(
                                            'px-2 py-0.5 rounded text-[10px] font-medium',
                                            group.badgeClass,
                                        )}
                                    >
                                        {group.label}
                                    </span>
                                ) : (
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                        {group.label}
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                {group.count} chỉ tiêu
                            </span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-1 pb-1">
                        <div className="flex flex-col gap-1">
                            {group.assays.map((assay) => {
                                const selectedTest = selected.find((t) => t.assayId === assay.id)
                                return (
                                    <TestRow
                                        key={assay.id}
                                        assay={assay}
                                        isSelected={selectedSet.has(assay.id)}
                                        isDisabled={disabledSet.has(assay.id)}
                                        selectedTest={selectedTest}
                                        specialtiesMap={specialtiesMap}
                                        onToggle={toggleTestSelection}
                                        onMethodChange={handleMethodChange}
                                    />
                                )
                            })}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    )
}

// ---------- Internal Components ----------

/** Virtualized flat list for search results — prevents perf regression with large catalogs */
interface VirtualizedFlatListProps {
    assayRows: Array<GridRow & { type: 'assay' }>
    selectedSet: Set<string>
    selectedTests: SelectedTest[]
    disabledSet: Set<string>
    specialtiesMap: Map<string, { id: string; name: string; code: string }>
    toggleTestSelection: (assay: AssayDefinitionWithMethods) => void
    handleMethodChange: (assayId: string, methodId: string) => void
}

function VirtualizedFlatList({
    assayRows,
    selectedSet,
    selectedTests,
    disabledSet,
    specialtiesMap,
    toggleTestSelection,
    handleMethodChange,
}: VirtualizedFlatListProps) {
    const parentRef = useRef<HTMLDivElement>(null)

    const virtualizer = useVirtualizer({
        count: assayRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 72,
        overscan: 10,
    })

    return (
        <div
            ref={parentRef}
            data-testid="flat-list"
            className="h-full overflow-auto px-2"
        >
            <div
                style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}
            >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                    const row = assayRows[virtualRow.index]
                    return (
                        <div
                            key={row.key}
                            data-index={virtualRow.index}
                            ref={virtualizer.measureElement}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                            className="pb-1"
                        >
                            <TestRow
                                assay={row.assay}
                                isSelected={selectedSet.has(row.assay.id)}
                                isDisabled={disabledSet.has(row.assay.id)}
                                selectedTest={selectedTests.find(
                                    (t) => t.assayId === row.assay.id,
                                )}
                                specialtiesMap={specialtiesMap}
                                onToggle={toggleTestSelection}
                                onMethodChange={handleMethodChange}
                            />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

interface TestRowProps {
    assay: AssayDefinitionWithMethods
    isSelected: boolean
    isDisabled: boolean
    selectedTest?: SelectedTest
    specialtiesMap: Map<string, { id: string; name: string; code: string }>
    onToggle: (assay: AssayDefinitionWithMethods) => void
    onMethodChange: (assayId: string, methodId: string) => void
}

function TestRow({
    assay, isSelected, isDisabled, selectedTest,
    specialtiesMap, onToggle, onMethodChange,
}: TestRowProps) {
    const [methodOpen, setMethodOpen] = useState(false)

    const specialty = assay.specialty_id
        ? specialtiesMap.get(assay.specialty_id)
        : null

    const hasMultipleMethods = assay.methods.length > 1
    const methodLabel = isSelected && selectedTest
        ? selectedTest.methodName
        : assay.methods.length > 0
            ? assay.methods.length > 1
                ? `${assay.methods.length} phương pháp`
                : assay.methods[0].name
            : 'N/A'

    return (
        <div data-testid={`test-row-${assay.id}`}>
            <div
                role="button"
                tabIndex={0}
                onClick={() => !isDisabled && onToggle(assay)}
                onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
                        e.preventDefault()
                        onToggle(assay)
                    }
                }}
                className={cn(
                    'group relative flex items-center p-3 rounded-lg border cursor-pointer transition-all',
                    isSelected
                        ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                        : 'bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800',
                    isDisabled && 'opacity-50 cursor-not-allowed',
                    methodOpen && 'rounded-b-none',
                )}
            >
                {/* Checkbox */}
                <div
                    className={cn(
                        'flex items-center justify-center w-5 h-5 rounded border transition-colors mr-3 shrink-0',
                        isSelected
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900',
                    )}
                >
                    {isSelected && (
                        <Check data-testid="check-icon" size={14} strokeWidth={3} />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate pr-2">
                            {assay.name}
                        </span>
                        {specialty && (
                            <span
                                className={cn(
                                    'px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap shrink-0',
                                    SPECIALTY_BADGE_CLASSES[specialty.code] ||
                                        'bg-slate-100 text-slate-700',
                                )}
                            >
                                {specialty.name}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                        {isSelected && hasMultipleMethods ? (
                            <button
                                type="button"
                                data-testid={`method-toggle-${assay.id}`}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setMethodOpen((prev) => !prev)
                                }}
                                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                <span>{methodLabel}</span>
                                <ChevronDown
                                    size={12}
                                    className={cn(
                                        'transition-transform',
                                        methodOpen && 'rotate-180',
                                    )}
                                />
                            </button>
                        ) : (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {methodLabel}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Inline method picker */}
            {methodOpen && isSelected && hasMultipleMethods && (
                <div
                    data-testid={`method-picker-${assay.id}`}
                    className="border border-t-0 border-blue-200 dark:border-blue-800 rounded-b-lg bg-blue-50/30 dark:bg-blue-900/5 px-3 py-2"
                >
                    {assay.methods.map((m) => (
                        <button
                            key={m.method_id}
                            type="button"
                            onClick={() => onMethodChange(assay.id, m.method_id)}
                            className={cn(
                                'flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-xs transition-colors',
                                selectedTest?.methodId === m.method_id
                                    ? 'bg-blue-100 dark:bg-blue-800/30 text-blue-800 dark:text-blue-200 font-medium'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-blue-100/50 dark:hover:bg-blue-800/20',
                            )}
                        >
                            <div
                                className={cn(
                                    'w-3.5 h-3.5 rounded-full border-2 shrink-0',
                                    selectedTest?.methodId === m.method_id
                                        ? 'border-blue-500 bg-blue-500'
                                        : 'border-slate-300 dark:border-slate-600',
                                )}
                            >
                                {selectedTest?.methodId === m.method_id && (
                                    <div className="w-full h-full rounded-full border-2 border-white dark:border-slate-900" />
                                )}
                            </div>
                            {m.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ---------- Helpers ----------

interface GroupSection {
    key: string
    label: string
    badgeClass?: string
    count: number
    assays: AssayDefinitionWithMethods[]
}

function buildGroups(rows: GridRow[]): GroupSection[] {
    const groups: GroupSection[] = []
    let current: GroupSection | null = null

    for (const row of rows) {
        if (row.type === 'group') {
            current = {
                key: row.key,
                label: row.label,
                badgeClass: row.badgeClass,
                count: row.count,
                assays: [],
            }
            groups.push(current)
        } else if (row.type === 'assay' && current) {
            current.assays.push(row.assay)
        }
    }

    return groups
}

'use client'

/**
 * TestCatalogAccordion — Shared accordion-based test catalog
 *
 * Renders assay definitions as collapsible specialty groups.
 * - variant="mobile": single-expand, compact styling
 * - variant="desktop": multi-expand, spacious styling with units display
 * - Falls back to virtualized flat list when searchQuery is active
 * - Extracted from accession-mobile-test-list.tsx for cross-layout reuse
 */

import { cn } from '@/lib/utils'
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import type { AssayDefinitionWithMethods, SelectedTest } from '@/types'
import type { GridRow } from '@/types/test-assignment'
import { TestRow, VirtualizedFlatList } from './test-catalog-assay-list'

// ---------- Public Types ----------

export interface TestCatalogAccordionProps {
    groupedRows: GridRow[]
    selected: SelectedTest[]
    toggleTestSelection: (assay: AssayDefinitionWithMethods) => void
    toggleGroupSelection: (assays: AssayDefinitionWithMethods[]) => void
    handleMethodChange: (assayId: string, methodId: string) => void
    disabledSet: Set<string>
    specialtiesMap: Map<string, { id: string; name: string; code: string }>
    searchQuery: string
    isLoading: boolean
    /** mobile = single-expand compact, desktop = multi-expand spacious */
    variant: 'mobile' | 'desktop'
}

// ---------- Main Component ----------

export function TestCatalogAccordion({
    groupedRows,
    selected,
    toggleTestSelection,
    toggleGroupSelection,
    handleMethodChange,
    disabledSet,
    specialtiesMap,
    searchQuery,
    isLoading,
    variant,
}: TestCatalogAccordionProps) {
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
                variant={variant}
            />
        )
    }

    // Group the rows into sections
    const groups = buildGroups(groupedRows)
    const isDesktop = variant === 'desktop'
    const desktopDefaultValue = groups.length > 0 ? [groups[0].key] : []

    if (isDesktop) {
        return (
            <Accordion type="multiple" className="w-full" defaultValue={desktopDefaultValue}>
                {groups.map((group) => (
                    <AccordionItem key={group.key} value={group.key}>
                        <AccordionTrigger
                            className="px-4 py-3 hover:no-underline"
                            leadingAction={
                                <GroupSelectionCheckbox
                                    group={group}
                                    selectedSet={selectedSet}
                                    disabledSet={disabledSet}
                                    onToggle={toggleGroupSelection}
                                    className="ml-4"
                                />
                            }
                        >
                            <GroupHeader group={group} variant={variant} />
                        </AccordionTrigger>
                        <AccordionContent className="px-2 pb-2">
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
                                            variant={variant}
                                            showSpecialtyBadge={false}
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

    // Mobile variant: single-expand
    return (
        <Accordion type="single" collapsible className="w-full">
            {groups.map((group) => (
                <AccordionItem key={group.key} value={group.key}>
                    <AccordionTrigger
                        className="px-3 py-2.5 hover:no-underline"
                        leadingAction={
                            <GroupSelectionCheckbox
                                group={group}
                                selectedSet={selectedSet}
                                disabledSet={disabledSet}
                                onToggle={toggleGroupSelection}
                                className="ml-3"
                            />
                        }
                    >
                        <GroupHeader group={group} variant={variant} />
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
                                        variant={variant}
                                        showSpecialtyBadge
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

function GroupSelectionCheckbox({
    group,
    selectedSet,
    disabledSet,
    onToggle,
    className,
}: {
    group: GroupSection
    selectedSet: Set<string>
    disabledSet: Set<string>
    onToggle: (assays: AssayDefinitionWithMethods[]) => void
    className: string
}) {
    const eligibleAssays = group.assays.filter((assay) => !disabledSet.has(assay.id))
    const selectedCount = eligibleAssays.filter((assay) => selectedSet.has(assay.id)).length
    const checked = selectedCount === 0
        ? false
        : selectedCount === eligibleAssays.length
            ? true
            : 'indeterminate'

    return (
        <Checkbox
            aria-label={`Chọn nhóm ${group.label}`}
            checked={checked}
            disabled={eligibleAssays.length === 0}
            onCheckedChange={() => onToggle(group.assays)}
            className={className}
        />
    )
}

function GroupHeader({
    group,
    variant,
}: {
    group: GroupSection
    variant: 'mobile' | 'desktop'
}) {
    const usePlainDesktopLabel = variant === 'desktop'

    return (
        <div className="flex items-center justify-between w-full pr-2">
            <div className="flex items-center gap-2">
                {group.badgeClass && !usePlainDesktopLabel ? (
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
    )
}

// ---------- Helpers ----------

export interface GroupSection {
    key: string
    label: string
    badgeClass?: string
    count: number
    assays: AssayDefinitionWithMethods[]
}

export function buildGroups(rows: GridRow[]): GroupSection[] {
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

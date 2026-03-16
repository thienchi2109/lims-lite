/**
 * DesktopGrid — Desktop center pane for test assignment
 *
 * Renders toolbar (search, filters, count) + accordion-based test catalog.
 * Previously a flat virtualized tabular grid; now uses TestCatalogAccordion
 * for cleaner grouped browsing by specialty.
 */

import React from 'react'
import type { AssayDefinitionWithMethods, SelectedTest } from '@/types'
import type { GridRow } from '@/types/test-assignment'
import {
    Search,
    Filter,
} from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { TestCatalogAccordion } from './test-catalog-accordion'

interface DesktopGridProps {
    // Search & Filters
    searchQuery: string
    setSearchQuery: (query: string) => void
    selectedMethodId: string
    setSelectedMethodId: (id: string) => void
    selectedSpecialtyId: string
    setSelectedSpecialtyId: (id: string) => void
    methods: Array<{ id: string; name: string }>
    specialties: Array<{ id: string; name: string; code: string }>

    // Data
    groupedRows: GridRow[]
    processedAssays: AssayDefinitionWithMethods[]
    isLoading: boolean
    disabledSet: Set<string>
    specialtiesMap: Map<string, { id: string; name: string; code: string }>

    // Selection
    selected: SelectedTest[]
    toggleTestSelection: (assay: AssayDefinitionWithMethods) => void
    handleMethodChange: (assayId: string, methodId: string) => void
}

export function DesktopGrid({
    searchQuery,
    setSearchQuery,
    selectedMethodId,
    setSelectedMethodId,
    selectedSpecialtyId,
    setSelectedSpecialtyId,
    methods,
    specialties,
    groupedRows,
    processedAssays,
    isLoading,
    disabledSet,
    specialtiesMap,
    selected,
    toggleTestSelection,
    handleMethodChange,
}: DesktopGridProps) {
    return (
        <main className="h-full flex flex-col min-w-0 bg-white dark:bg-slate-950">
            {/* Toolbar — unchanged */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 justify-between bg-white dark:bg-slate-950 z-20 relative">
                <div className="flex items-center gap-2 flex-1">
                    <div className="relative w-full max-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm tên, nhóm KT, phương pháp..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 transition-all outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="w-[200px]">
                        <Select value={selectedMethodId} onValueChange={setSelectedMethodId}>
                            <SelectTrigger className="h-9 bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                    <Filter size={14} />
                                    <span className="truncate">
                                        {selectedMethodId === 'all'
                                            ? 'Tất cả phương pháp'
                                            : methods.find(m => m.id === selectedMethodId)?.name || 'Phương pháp'}
                                    </span>
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả phương pháp</SelectItem>
                                {methods.map(method => (
                                    <SelectItem key={method.id} value={method.id}>
                                        {method.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-[220px]">
                        <Select value={selectedSpecialtyId} onValueChange={setSelectedSpecialtyId}>
                            <SelectTrigger className="h-9 bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                    <Filter size={14} />
                                    <span className="truncate">
                                        {selectedSpecialtyId === 'all'
                                            ? 'Tất cả Nhóm kỹ thuật'
                                            : specialtiesMap.get(selectedSpecialtyId)?.name || 'Nhóm kỹ thuật'}
                                    </span>
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
                </div>
                <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
                    {processedAssays.length} chỉ tiêu
                </div>
            </div>

            {/* Accordion-based Test Catalog */}
            <div className="flex-1 overflow-auto">
                <TestCatalogAccordion
                    groupedRows={groupedRows}
                    selected={selected}
                    toggleTestSelection={toggleTestSelection}
                    handleMethodChange={handleMethodChange}
                    disabledSet={disabledSet}
                    specialtiesMap={specialtiesMap}
                    searchQuery={searchQuery}
                    isLoading={isLoading}
                    variant="desktop"
                />
            </div>
        </main>
    )
}

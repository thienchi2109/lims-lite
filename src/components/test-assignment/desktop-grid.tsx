import React, { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { AssayDefinitionWithMethods, SelectedTest } from '@/types'
import type { SortKey, SortConfig, GridRow } from '@/types/test-assignment'
import { SPECIALTY_BADGE_CLASSES } from '@/lib/specialty-badges'
import { cn } from '@/lib/utils'
import {
    Search,
    CheckCircle2,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    CheckSquare,
    Square,
    Filter,
    Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

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

    // Sorting
    sortConfig: SortConfig
    requestSort: (key: SortKey) => void

    // Selection
    selected: SelectedTest[]
    toggleTestSelection: (assay: AssayDefinitionWithMethods) => void
    handleMethodChange: (assayId: string, methodId: string) => void
}

const SortIcon = ({ column, sortConfig }: { column: SortKey, sortConfig: SortConfig }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown size={14} className="text-slate-300 opacity-0 group-hover:opacity-50" />
    return sortConfig.direction === 'asc'
        ? <ArrowUp size={14} className="text-sky-600" />
        : <ArrowDown size={14} className="text-sky-600" />
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
    sortConfig,
    requestSort,
    selected,
    toggleTestSelection,
    handleMethodChange
}: DesktopGridProps) {
    const parentRef = useRef<HTMLDivElement>(null)

    const rowVirtualizer = useVirtualizer({
        count: groupedRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => {
            const row = groupedRows[index]
            return row?.type === 'group' ? 40 : 54
        },
        overscan: 20,
    })

    return (
        <main className="h-full flex flex-col min-w-0 bg-white dark:bg-slate-950">
            {/* Toolbar */}
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

            {/* Grid Header */}
            <div className="grid grid-cols-[48px_1fr_180px_190px_100px] bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 select-none z-10 shadow-sm relative">
                <div className="p-3 bg-slate-50 dark:bg-slate-900"></div>
                <div
                    onClick={() => requestSort('name')}
                    className="group p-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
                >
                    Tên chỉ tiêu <SortIcon column="name" sortConfig={sortConfig} />
                </div>
                <div className="p-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Nhóm kỹ thuật
                </div>
                <div className="p-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Phương pháp
                </div>
                <div
                    onClick={() => requestSort('units')}
                    className="group p-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
                >
                    ĐVT <SortIcon column="units" sortConfig={sortConfig} />
                </div>
            </div>

            {/* Virtualized Grid List */}
            <div
                ref={parentRef}
                className="flex-1 overflow-auto w-full relative"
            >
                <div
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {isLoading && processedAssays.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-muted-foreground z-50 bg-white/50 dark:bg-slate-950/50">
                            <div className="flex justify-center items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Đang tải dữ liệu...
                            </div>
                        </div>
                    ) : groupedRows.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-muted-foreground">
                            Không tìm thấy chỉ tiêu nào
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
                                            height: `${virtualRow.size}px`,
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                        className="grid grid-cols-[48px_1fr_180px_190px_100px] border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 box-border"
                                    >
                                        <div className="p-3" />
                                        <div className="p-3 col-span-4 flex items-center justify-between">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {row.badgeClass ? (
                                                    <Badge
                                                        variant="outline"
                                                        className={cn("px-2.5 py-0.5 rounded-full font-medium transition-colors", row.badgeClass)}
                                                    >
                                                        {row.label}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
                                                        {row.label}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
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
                                        height: `${virtualRow.size}px`,
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                    className={`
                                        grid grid-cols-[48px_1fr_180px_190px_100px] border-b border-slate-100 dark:border-slate-800 box-border
                                        ${isDisabled ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900' : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900'}
                                        ${isSelected ? 'bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30' : virtualRow.index % 2 === 0 ? 'bg-white dark:bg-slate-950' : 'bg-slate-50/30 dark:bg-slate-900/30'}
                                    `}
                                    onClick={() => !isDisabled && toggleTestSelection(test)}
                                >
                                    <div className="p-3 flex items-center justify-center">
                                        {isDisabled ? (
                                            <CheckCircle2 size={18} className="text-slate-300 dark:text-slate-600 inline-block" />
                                        ) : isSelected ? (
                                            <CheckSquare size={18} className="text-sky-600 dark:text-sky-400 inline-block" />
                                        ) : (
                                            <Square size={18} className="text-slate-300 dark:text-slate-600 inline-block" />
                                        )}
                                    </div>
                                    <div className="p-3 flex items-center">
                                        <span className={`text-sm font-medium ${isSelected ? 'text-sky-900 dark:text-sky-100' : 'text-slate-800 dark:text-slate-200'}`}>{test.name}</span>
                                    </div>
                                    <div className="p-3 flex items-center">
                                        {specialty ? (
                                            <Badge
                                                variant="outline"
                                                className={`px-2.5 py-0.5 rounded-full font-medium transition-colors ${specialty.code && SPECIALTY_BADGE_CLASSES[specialty.code] ? SPECIALTY_BADGE_CLASSES[specialty.code] : ''}`}
                                            >
                                                {specialty.name}
                                            </Badge>
                                        ) : (
                                            <span className="text-xs text-muted-foreground/50 italic">-</span>
                                        )}
                                    </div>
                                    <div className="p-3 flex items-center" onClick={(e) => e.stopPropagation()}>
                                        {isSelected && test.methods.length > 1 ? (
                                            <Select
                                                value={selectedTest.methodId}
                                                onValueChange={(value) => handleMethodChange(test.id, value)}
                                            >
                                                <SelectTrigger className="h-8 w-full text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {test.methods.map(m => (
                                                        <SelectItem key={m.method_id} value={m.method_id} className="text-xs">
                                                            {m.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <span className="text-xs text-slate-600 dark:text-slate-400">
                                                {isSelected ? selectedTest.methodName : test.methods[0]?.name || 'N/A'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-3 flex items-center text-xs text-slate-600 dark:text-slate-400">
                                        {test.units || '-'}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </main>
    )
}

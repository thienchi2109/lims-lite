'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { fetchAssayDefinitionsClient, fetchMethodsClient } from '@/lib/api-client'
import type { LabSpecialty, AssayDefinitionWithMethods, SelectedTest } from '@/types'
import { SPECIALTY_BADGE_CLASSES } from '@/lib/specialty-badges'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import {
    Search,
    CheckCircle2,
    X,
    Plus,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    CheckSquare,
    Square,
    FlaskConical,
    Loader2,
    Filter,
    User,
    ChevronDown,
    Check,
    ArrowRight
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    ResizablePanelGroup,
    ResizablePanel,
    ResizableHandle,
} from "@/components/ui/resizable"
import {
    Sheet,
    SheetContent,
    SheetTrigger,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'

// --- Types ---



interface TestAssignmentGridProps {
    selected: SelectedTest[]
    onChange: (tests: SelectedTest[]) => void
    context?: React.ReactNode
    disabledAssayIds?: string[]
    specialties?: LabSpecialty[]
    onSave?: () => void
    isSaving?: boolean
    saveLabel?: string
    summaryInfo?: {
        clientName?: string
        sampleType?: string
        receivedAt?: string
    }
}

// --- Components ---

const SortIcon = ({ column, sortConfig }: { column: string, sortConfig: any }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown size={14} className="text-slate-300 opacity-0 group-hover:opacity-50" />
    return sortConfig.direction === 'asc'
        ? <ArrowUp size={14} className="text-sky-600" />
        : <ArrowDown size={14} className="text-sky-600" />
}

export function TestAssignmentGrid({
    selected,
    onChange,
    context,
    disabledAssayIds = [],
    specialties = [],
    onSave = () => { },
    isSaving = false,
    saveLabel = 'Lưu thay đổi',
    summaryInfo
}: TestAssignmentGridProps) {
    // --- Responsive State ---
    const isDesktop = useMediaQuery("(min-width: 1280px)")

    // State
    const [availableAssays, setAvailableAssays] = useState<AssayDefinitionWithMethods[]>([])
    const [isContextOpen, setIsContextOpen] = useState(true)
    const [methods, setMethods] = useState<{ id: string, name: string }[]>([])
    const [selectedMethodId, setSelectedMethodId] = useState<string>('all')
    const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>('all')
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortConfig, setSortConfig] = useState<{ key: keyof AssayDefinitionWithMethods, direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' })
    const [showToast, setShowToast] = useState(false)

    // Virtualization Ref
    const parentRef = useRef<HTMLDivElement>(null)

    // Initial Load
    useEffect(() => {
        loadMethods()
        // loadAssays is called by the debounce effect below
    }, [])

    // Reload assays when method filter changes
    useEffect(() => {
        const controller = new AbortController()
        loadAssays(searchQuery, controller.signal)
        return () => controller.abort()
    }, [selectedMethodId, selectedSpecialtyId])

    // Debounce Search
    useEffect(() => {
        const controller = new AbortController()
        const timer = setTimeout(() => {
            loadAssays(searchQuery, controller.signal)
        }, 300)

        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [searchQuery])

    const loadMethods = async () => {
        const result = await fetchMethodsClient()
        if (result.data) {
            setMethods(result.data)
        }
    }

    const loadAssays = async (search: string = '', signal?: AbortSignal) => {
        setIsLoading(true)
        try {
            // Fetch assays with method filter and search
            // Use large pageSize to simulate infinite scroll data availability for virtualization
            const result = await fetchAssayDefinitionsClient({
                pageSize: 2000,
                methodId: selectedMethodId,
                specialtyId: selectedSpecialtyId,
                search: search
            })

            if (signal?.aborted) return

            if (result.data) {
                setAvailableAssays(result.data as AssayDefinitionWithMethods[])
            } else {
                setAvailableAssays([])
            }
        } catch (error) {
            if (signal?.aborted) return
            console.error('Failed to load assays', error)
            setAvailableAssays([])
        } finally {
            if (!signal?.aborted) {
                setIsLoading(false)
            }
        }
    }

    // Sorting Handler
    const requestSort = (key: keyof AssayDefinitionWithMethods) => {
        let direction: 'asc' | 'desc' = 'asc'
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    // Derived State
    const processedTests = useMemo(() => {
        // Filter by search is now done on server
        // Just apply sorting here
        let data = [...availableAssays]

        if (sortConfig) {
            data.sort((a, b) => {
                // Handle null values safely
                const aValue = a[sortConfig.key] || ''
                const bValue = b[sortConfig.key] || ''

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
                return 0
            })
        }
        return data
    }, [availableAssays, sortConfig])

    const disabledSet = useMemo(() => new Set(disabledAssayIds), [disabledAssayIds])
    const specialtiesMap = useMemo(() => {
        return new Map(specialties.map((s) => [s.id, s]))
    }, [specialties])

    // Virtualizer
    const rowVirtualizer = useVirtualizer({
        count: processedTests.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => isDesktop ? 54 : 88, // Taller rows on mobile
        overscan: 20,
    })

    // Handlers
    const toggleTestSelection = (assay: AssayDefinitionWithMethods) => {
        if (disabledSet.has(assay.id)) return

        const existingIndex = selected.findIndex(t => t.assayId === assay.id)

        if (existingIndex >= 0) {
            // Remove
            const newSelected = [...selected]
            newSelected.splice(existingIndex, 1)
            onChange(newSelected)
        } else {
            // Add with default method
            let methodToSelect = assay.methods.find(m => m.is_default) || assay.methods[0]

            if (selectedMethodId !== 'all') {
                const filteredMethod = assay.methods.find(m => m.method_id === selectedMethodId)
                if (filteredMethod) {
                    methodToSelect = filteredMethod
                }
            }

            onChange([...selected, {
                assayId: assay.id,
                methodId: methodToSelect?.method_id || '',
                assayName: assay.name,
                methodName: methodToSelect?.name || 'Không có', // Vietnamese for "None"
                units: assay.units
            }])
        }
    }

    const handleMethodChange = (assayId: string, methodId: string) => {
        const newSelected = selected.map(t => {
            if (t.assayId === assayId) {
                const assay = availableAssays.find(a => a.id === assayId)
                const method = assay?.methods.find(m => m.method_id === methodId)
                if (method) {
                    return {
                        ...t,
                        methodId: method.method_id,
                        methodName: method.name
                    }
                }
            }
            return t
        })
        onChange(newSelected)
    }

    const handleRemove = (assayId: string) => {
        onChange(selected.filter(t => t.assayId !== assayId))
    }

    // --- MOBILE LAYOUT ---
    if (!isDesktop) {
        return (
            <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 gap-4 overflow-hidden">
                {/* 1. Context Cards (QR & Info) - Scrollable container for the whole form? 
                    Actually, if we want the Test Card to be scrollable internally, we should keep the main container static 
                    and let the components flex. But if Context is too tall, we might have issues. 
                    Let's make the MAIN container scrollable, and the card just part of the flow?
                    No, specifically requested the Test Card to have sticky header. So Test Card must be the scroll container or have internal scroll.
                    We will use flex-col. Context is top. Test Card is flex-1.
                    If context text is tall, we rely on min-height of test card or page scroll?
                    Let's use a wrapper that allows scrolling if needed, but tries to fit.
                */}
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

                {/* 2. Test Selection Card */}
                <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden relative">
                    {/* Sticky Header inside Card */}
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

                    {/* Virtualized List Container */}
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
                            {isLoading && processedTests.length === 0 ? (
                                <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-muted-foreground pt-10">
                                    <div className="flex justify-center items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Đang tải...
                                    </div>
                                </div>
                            ) : processedTests.length === 0 ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center pt-10">
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Không tìm thấy</h3>
                                </div>
                            ) : (
                                rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                    const test = processedTests[virtualRow.index]
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
                                                        e.preventDefault() // prevent double toggle if label handles it
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

                    {/* Bottom Bar integrated - Actually let's use the existing MobileBottomBar but styled or positioned?
                        If we use parent component's positioning, we need to leave padding.
                        The MobileBottomBar in current code is sticky bottom. 
                        We can keep it. The padding pb-20 in virtual list ensures we can scroll to bottom.
                    */}
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

    // --- DESKTOP LAYOUT (Original 3-Panel) ---
    return (
        <div className="flex flex-col h-[calc(100vh-200px)] min-h-[600px]">
            <ResizablePanelGroup
                direction="horizontal"
                className="h-full border rounded-lg shadow-sm bg-white dark:bg-slate-950"
            >
                {/* -------------------------------------------------------------
                    LEFT PANE: CONTEXT
                ----------------------------------------------------------------- */}
                <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                    <aside className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col z-20">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 mb-1">
                                <FlaskConical size={18} />
                                <span className="font-bold tracking-tight text-sm">CDC<span className="text-slate-900 dark:text-slate-100"> LIMS</span> Pro</span>
                            </div>
                        </div>

                        <div className="p-5 flex-1 overflow-y-auto">
                            {context}
                        </div>

                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-[10px] text-slate-500 text-center">
                            Workflow: Test Assignment
                        </div>
                    </aside>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* -------------------------------------------------------------
                    CENTER PANE: DATA GRID (VIRTUALIZED)
                ----------------------------------------------------------------- */}
                <ResizablePanel defaultSize={55}>
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
                                {processedTests.length} chỉ tiêu
                            </div>
                        </div>

                        {/* Virtualized Grid Header */}
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
                            {/* Inner Container for total height */}
                            <div
                                style={{
                                    height: `${rowVirtualizer.getTotalSize()}px`,
                                    width: '100%',
                                    position: 'relative',
                                }}
                            >
                                {isLoading && processedTests.length === 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-muted-foreground z-50 bg-white/50 dark:bg-slate-950/50">
                                        <div className="flex justify-center items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Đang tải dữ liệu...
                                        </div>
                                    </div>
                                ) : processedTests.length === 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-muted-foreground">
                                        Không tìm thấy chỉ tiêu nào
                                    </div>
                                ) : (
                                    rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                        const test = processedTests[virtualRow.index]
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
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* -------------------------------------------------------------
                    RIGHT PANE: STAGING AREA
                ----------------------------------------------------------------- */}
                <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
                    <aside className="h-full bg-white dark:bg-slate-950 flex flex-col z-30">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                    {selected.length}
                                </div>
                                <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Đã chọn</h2>
                            </div>
                            <button
                                onClick={() => onChange([])}
                                className="text-[10px] uppercase font-bold text-slate-400 hover:text-red-600 tracking-wider"
                                disabled={selected.length === 0}
                            >
                                Xóa hết
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-0">
                            {selected.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                                    <div className="w-10 h-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-center mb-2">
                                        <Plus size={16} className="text-slate-300 dark:text-slate-600" />
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Chọn chỉ tiêu từ danh sách</p>
                                </div>
                            ) : (
                                <table className="w-full text-left">
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {selected.map((test) => (
                                            <tr key={test.assayId} className="group hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-colors">
                                                <td className="p-3">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm text-slate-800 dark:text-slate-200 font-medium leading-tight">{test.assayName}</span>
                                                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">PP: {test.methodName}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemove(test.assayId)}
                                                            className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                            {onSave && (
                                <Button
                                    onClick={onSave}
                                    disabled={isSaving}
                                    className="w-full"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Đang xử lý...
                                        </>
                                    ) : (
                                        saveLabel
                                    )}
                                </Button>
                            )}
                        </div>
                    </aside>
                </ResizablePanel>
            </ResizablePanelGroup>

            {/* Toast Notification */}
            <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded shadow-lg flex items-center gap-3 transition-all duration-300 z-50 ${showToast ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
                <CheckCircle2 size={18} className="text-green-400" />
                <span className="text-sm font-medium">Đã lưu thay đổi</span>
            </div>

        </div>
    )
}

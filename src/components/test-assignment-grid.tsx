'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { fetchAssayDefinitionsClient, fetchMethodsClient } from '@/lib/api-client'
import type { LabSpecialty } from '@/types'
import {
    Search,
    Beaker,
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
    Filter
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

// --- Types ---

type AssayMethod = {
    id: string
    method_id: string
    name: string
    is_default: boolean
    notes: string | null
}

type AssayDefinitionWithMethods = {
    id: string
    name: string
    specialty_id: string | null
    units: string | null
    methods: AssayMethod[]
}

export type SelectedTest = {
    assayId: string
    methodId: string
    assayName: string
    methodName: string
    units: string | null
}

interface TestAssignmentGridProps {
    selected: SelectedTest[]
    onChange: (tests: SelectedTest[]) => void
    context?: React.ReactNode
    disabledAssayIds?: string[]
    specialties?: LabSpecialty[]
    onSave?: () => void
    isSaving?: boolean
    saveLabel?: string
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
    onSave,
    isSaving = false,
    saveLabel = 'Lưu thay đổi'
}: TestAssignmentGridProps) {
    // State
    const [availableAssays, setAvailableAssays] = useState<AssayDefinitionWithMethods[]>([])
    const [methods, setMethods] = useState<{ id: string, name: string }[]>([])
    const [selectedMethodId, setSelectedMethodId] = useState<string>('all')
    const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>('all')
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortConfig, setSortConfig] = useState<{ key: keyof AssayDefinitionWithMethods, direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' })
    const [showToast, setShowToast] = useState(false)

    // Initial Load
    useEffect(() => {
        loadMethods()
        // loadAssays is called by the debounce effect below
    }, [])

    // Reload assays when method filter changes
    useEffect(() => {
        loadAssays(searchQuery)
    }, [selectedMethodId, selectedSpecialtyId])

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            loadAssays(searchQuery)
        }, 300)

        return () => clearTimeout(timer)
    }, [searchQuery])

    const loadMethods = async () => {
        const result = await fetchMethodsClient()
        if (result.data) {
            setMethods(result.data)
        }
    }

    const loadAssays = async (search: string = '') => {
        setIsLoading(true)
        try {
            // Fetch assays with method filter and search
            const result = await fetchAssayDefinitionsClient({
                pageSize: 100,
                methodId: selectedMethodId,
                specialtyId: selectedSpecialtyId,
                search: search
            })
            if (result.data) {
                setAvailableAssays(result.data as AssayDefinitionWithMethods[])
            } else {
                setAvailableAssays([])
            }
        } catch (error) {
            console.error('Failed to load assays', error)
            setAvailableAssays([])
        } finally {
            setIsLoading(false)
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
    const specialtyColorMap: Record<string, string> = {
        'HEM': 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
        'BIO': 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
        'IMM': 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
        'MIC': 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
        'MOL': 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
        'PAT': 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
    }

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
            // If a specific method is filtered, try to select that one first
            let methodToSelect = assay.methods.find(m => m.is_default) || assay.methods[0]

            if (selectedMethodId !== 'all') {
                const filteredMethod = assay.methods.find(m => m.method_id === selectedMethodId)
                if (filteredMethod) {
                    methodToSelect = filteredMethod
                }
            }

            if (methodToSelect) {
                onChange([...selected, {
                    assayId: assay.id,
                    methodId: methodToSelect.method_id,
                    assayName: assay.name,
                    methodName: methodToSelect.name,
                    units: assay.units
                }])
            }
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
                    CENTER PANE: DATA GRID
                ----------------------------------------------------------------- */}
                <ResizablePanel defaultSize={55}>
                    <main className="h-full flex flex-col min-w-0 bg-white dark:bg-slate-950">

                        {/* Toolbar */}
                        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 justify-between bg-white dark:bg-slate-950">
                            <div className="flex items-center gap-2 flex-1">
                                <div className="relative w-full max-w-[240px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Tìm kiếm chỉ tiêu..."
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
                                                        ? 'Tất cả nhóm xét nghiệm'
                                                        : specialtiesMap.get(selectedSpecialtyId)?.name || 'Nhóm xét nghiệm'}
                                                </span>
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tất cả nhóm xét nghiệm</SelectItem>
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

                        {/* The Grid Header */}
                        <div className="flex-1 overflow-hidden flex flex-col">
                            <div className="overflow-auto flex-1">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-100/5">
                                        <tr>
                                            <th className="p-3 w-12 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                                            </th>
                                            <th onClick={() => requestSort('name')} className="group p-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 border-b border-slate-200 dark:border-slate-800 select-none">
                                                <div className="flex items-center gap-1">Tên chỉ tiêu <SortIcon column="name" sortConfig={sortConfig} /></div>
                                            </th>
                                            <th className="p-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 w-44 select-none">
                                                Nhóm xét nghiệm
                                            </th>
                                            <th className="p-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 w-48 select-none">
                                                Phương pháp
                                            </th>
                                            <th onClick={() => requestSort('units')} className="group p-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 border-b border-slate-200 dark:border-slate-800 w-24 select-none">
                                                <div className="flex items-center gap-1">ĐVT <SortIcon column="units" sortConfig={sortConfig} /></div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-slate-950">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                                    <div className="flex justify-center items-center gap-2">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Đang tải dữ liệu...
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : processedTests.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                                    Không tìm thấy chỉ tiêu nào
                                                </td>
                                            </tr>
                                        ) : (
                                            processedTests.map((test, index) => {
                                                const selectedTest = selected.find(t => t.assayId === test.id)
                                                const isSelected = !!selectedTest
                                                const isDisabled = disabledSet.has(test.id)
                                                const specialty = test.specialty_id ? specialtiesMap.get(test.specialty_id) : null

                                                return (
                                                    <tr
                                                        key={test.id}
                                                        onClick={() => !isDisabled && toggleTestSelection(test)}
                                                        className={`
                                                            transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 
                                                            ${isDisabled ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900'}
                                                            ${isSelected ? 'bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30' : index % 2 === 0 ? 'bg-white dark:bg-slate-950' : 'bg-slate-50/30 dark:bg-slate-900/30'}
                                                        `}
                                                    >
                                                        <td className="p-3 text-center">
                                                            {isDisabled ? (
                                                                <CheckCircle2 size={18} className="text-slate-300 dark:text-slate-600 inline-block" />
                                                            ) : isSelected ? (
                                                                <CheckSquare size={18} className="text-sky-600 dark:text-sky-400 inline-block" />
                                                            ) : (
                                                                <Square size={18} className="text-slate-300 dark:text-slate-600 inline-block" />
                                                            )}
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex flex-col">
                                                                <span className={`text-sm font-medium ${isSelected ? 'text-sky-900 dark:text-sky-100' : 'text-slate-800 dark:text-slate-200'}`}>{test.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-3">
                                                            {specialty ? (
                                                                <Badge
                                                                    variant="outline"
                                                                    className={`px-2.5 py-0.5 rounded-full font-medium transition-colors ${specialty.code && specialtyColorMap[specialty.code] ? specialtyColorMap[specialty.code] : ''}`}
                                                                >
                                                                    {specialty.name}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground/50 italic">-</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
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
                                                        </td>
                                                        <td className="p-3 text-xs text-slate-600 dark:text-slate-400">
                                                            {test.units || '-'}
                                                        </td>
                                                    </tr>
                                                )
                                            })
                                        )}
                                    </tbody>
                                </table>
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

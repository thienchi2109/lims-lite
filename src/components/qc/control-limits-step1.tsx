'use client'

import { useState, useEffect } from 'react'
import { Search, X, FlaskConical, TestTube } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { searchAssays } from '@/app/actions/search'
import { createClient } from '@/lib/supabase/client'
import { searchQCMaterials } from '@/app/actions/qc-setup'
import type { AssayOption, MaterialOption } from './control-limits-types'

// ============================================================================
// TYPES
// ============================================================================

interface Step1SelectionProps {
    selectedAssay: AssayOption | null
    selectedMaterial: MaterialOption | null
    onAssayChange: (assay: AssayOption | null) => void
    onMaterialChange: (material: MaterialOption | null) => void
}

// ============================================================================
// SELECTED CARDS
// ============================================================================

function SelectedAssayCard({
    assay,
    onClear,
}: {
    assay: AssayOption
    onClear: () => void
}) {
    return (
        <div className="bg-sky-50/50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-800 rounded-lg p-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <div>
                    <div className="font-medium text-sky-900 dark:text-sky-100">
                        {assay.name}
                    </div>
                    {assay.units && (
                        <div className="text-xs text-sky-600 dark:text-sky-400">
                            {assay.units}
                        </div>
                    )}
                </div>
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50"
                onClick={onClear}
            >
                <X className="h-3 w-3" />
            </Button>
        </div>
    )
}

function SelectedMaterialCard({
    material,
    onClear,
}: {
    material: MaterialOption
    onClear: () => void
}) {
    return (
        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-lg p-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
                <TestTube className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                    <div className="font-medium text-emerald-900 dark:text-emerald-100">
                        {material.name}
                    </div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400">
                        {material.level} - Lô: {material.lot_number}
                    </div>
                </div>
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50"
                onClick={onClear}
            >
                <X className="h-3 w-3" />
            </Button>
        </div>
    )
}

// ============================================================================
// ASSAY SEARCH POPOVER
// ============================================================================

function AssaySearchPopover({
    onSelect,
}: {
    onSelect: (assay: AssayOption) => void
}) {
    const [open, setOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [assays, setAssays] = useState<AssayOption[]>([])
    const [loading, setLoading] = useState(false)

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (open) {
                fetchAssays(searchQuery)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery, open])

    const fetchAssays = async (query: string) => {
        setLoading(true)
        try {
            if (!query.trim()) {
                // Empty search - get first 20 assays directly (search_assays doesn't support empty query)
                const supabase = createClient()
                const { data, error } = await supabase
                    .from('assay_definitions')
                    .select('id, name, units')
                    .is('deleted_at', null)
                    .order('name')
                    .limit(20)

                if (!error && data) {
                    setAssays(
                        data.map((a) => ({
                            id: a.id,
                            name: a.name,
                            units: a.units || undefined,
                        }))
                    )
                }
            } else {
                // Use text search for non-empty query
                const result = await searchAssays(query, 20)
                if (result.data) {
                    // Map search result to AssayOption format
                    setAssays(
                        result.data.map((a) => ({
                            id: a.id,
                            name: a.name,
                            units: a.units || undefined,
                        }))
                    )
                }
            }
        } catch (error) {
            console.error('Failed to fetch assays', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between shadow-sm border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 h-11 px-3 text-sm font-normal"
                >
                    <div className="flex items-center gap-2 truncate">
                        <Search className="h-4 w-4 text-slate-400" />
                        <span className="truncate text-slate-500">
                            Tìm xét nghiệm...
                        </span>
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input
                        placeholder="Tìm xét nghiệm..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus-visible:ring-0 px-0 shadow-none"
                    />
                </div>
                <div
                    className="max-h-[200px] overflow-y-auto p-1 overscroll-contain"
                    onWheel={(e) => e.stopPropagation()}
                >
                    {loading ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                            Đang tìm kiếm...
                        </div>
                    ) : assays.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                            {searchQuery ? 'Không tìm thấy' : 'Nhập để tìm kiếm'}
                        </div>
                    ) : (
                        assays.map((assay) => (
                            <div
                                key={assay.id}
                                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                                onClick={() => {
                                    onSelect(assay)
                                    setOpen(false)
                                    setSearchQuery('')
                                }}
                            >
                                <div className="flex flex-col w-full">
                                    <span className="font-medium">{assay.name}</span>
                                    {assay.units && (
                                        <span className="text-xs text-muted-foreground">
                                            {assay.units}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}

// ============================================================================
// MATERIAL SEARCH POPOVER
// ============================================================================

function MaterialSearchPopover({
    onSelect,
}: {
    onSelect: (material: MaterialOption) => void
}) {
    const [open, setOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [materials, setMaterials] = useState<MaterialOption[]>([])
    const [loading, setLoading] = useState(false)

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (open) {
                fetchMaterials(searchQuery)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery, open])

    const fetchMaterials = async (query: string) => {
        setLoading(true)
        try {
            const result = await searchQCMaterials(query, 20)
            if (result.data) {
                // Map search result to MaterialOption format
                setMaterials(
                    result.data.map((m) => ({
                        id: m.id,
                        name: m.name,
                        lot_number: m.lot_number,
                        level: m.level,
                    }))
                )
            }
        } catch (error) {
            console.error('Failed to fetch materials', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between shadow-sm border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 h-11 px-3 text-sm font-normal"
                >
                    <div className="flex items-center gap-2 truncate">
                        <Search className="h-4 w-4 text-slate-400" />
                        <span className="truncate text-slate-500">
                            Tìm vật liệu QC...
                        </span>
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input
                        placeholder="Tìm vật liệu QC..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus-visible:ring-0 px-0 shadow-none"
                    />
                </div>
                <div
                    className="max-h-[200px] overflow-y-auto p-1 overscroll-contain"
                    onWheel={(e) => e.stopPropagation()}
                >
                    {loading ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                            Đang tìm kiếm...
                        </div>
                    ) : materials.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                            {searchQuery ? 'Không tìm thấy' : 'Nhập để tìm kiếm'}
                        </div>
                    ) : (
                        materials.map((material) => (
                            <div
                                key={material.id}
                                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                                onClick={() => {
                                    onSelect(material)
                                    setOpen(false)
                                    setSearchQuery('')
                                }}
                            >
                                <div className="flex flex-col w-full">
                                    <span className="font-medium">{material.name}</span>
                                    <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                                        <span>{material.level}</span>
                                        <span>Lô: {material.lot_number}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function Step1Selection({
    selectedAssay,
    selectedMaterial,
    onAssayChange,
    onMaterialChange,
}: Step1SelectionProps) {
    return (
        <div className="space-y-4">
            {/* Assay Combobox */}
            <div className="space-y-2">
                <Label>Xét nghiệm</Label>
                {selectedAssay ? (
                    <SelectedAssayCard
                        assay={selectedAssay}
                        onClear={() => onAssayChange(null)}
                    />
                ) : (
                    <AssaySearchPopover onSelect={onAssayChange} />
                )}
            </div>

            {/* Material Combobox */}
            <div className="space-y-2">
                <Label>Vật liệu QC</Label>
                {selectedMaterial ? (
                    <SelectedMaterialCard
                        material={selectedMaterial}
                        onClear={() => onMaterialChange(null)}
                    />
                ) : (
                    <MaterialSearchPopover onSelect={onMaterialChange} />
                )}
            </div>
        </div>
    )
}

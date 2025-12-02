'use client'

import { useEffect, useMemo, useState } from 'react'
import { getAssayDefinitions } from '@/app/actions/assays'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Search, Beaker, CheckCircle2, Plus, ArrowLeft, X } from 'lucide-react'

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

type TestAssignmentSelectorProps = {
    selected: SelectedTest[]
    onChange: (tests: SelectedTest[]) => void
    disabledAssayIds?: string[]
    heading?: string
    subheading?: string
}

/**
 * POS-style selector for picking assays and methods.
 * Fetches assays with search, supports multi-method drill down, and shows a cart of selections.
 */
export function TestAssignmentSelector({
    selected,
    onChange,
    disabledAssayIds = [],
    heading = 'Chọn xét nghiệm',
    subheading = 'Tìm kiếm chỉ tiêu và chọn phương pháp',
}: TestAssignmentSelectorProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [availableAssays, setAvailableAssays] = useState<AssayDefinitionWithMethods[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [selectedAssayForMethod, setSelectedAssayForMethod] = useState<AssayDefinitionWithMethods | null>(null)
    const [error, setError] = useState<string | null>(null)

    const disabledSet = useMemo(() => new Set(disabledAssayIds), [disabledAssayIds])
    const selectedSet = useMemo(() => new Set(selected.map((t) => t.assayId)), [selected])

    useEffect(() => {
        handleSearch('')
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => handleSearch(searchTerm), 250)
        return () => clearTimeout(timer)
    }, [searchTerm])

    const handleSearch = async (term: string) => {
        setIsSearching(true)
        try {
            const result = await getAssayDefinitions({ search: term, pageSize: 100 })
            if (result.error) {
                setError(result.error)
            } else {
                setError(null)
                setAvailableAssays(result.data as AssayDefinitionWithMethods[])
            }
        } catch (err) {
            console.error('Search assays failed', err)
            setError('Không thể tải danh sách chỉ tiêu')
        } finally {
            setIsSearching(false)
        }
    }

    const handleAddTest = (assay: AssayDefinitionWithMethods, method: AssayMethod) => {
        if (disabledSet.has(assay.id) || selectedSet.has(assay.id)) return

        onChange([
            ...selected,
            {
                assayId: assay.id,
                assayName: assay.name,
                methodId: method.method_id,
                methodName: method.name,
                units: assay.units,
            },
        ])
        setSelectedAssayForMethod(null)
    }

    const handleAssayClick = (assay: AssayDefinitionWithMethods) => {
        if (disabledSet.has(assay.id) || selectedSet.has(assay.id)) return

        if (assay.methods.length <= 1) {
            const method = assay.methods[0]
            if (method) {
                handleAddTest(assay, method)
            } else {
                setError(`Chỉ tiêu "${assay.name}" chưa có phương pháp.`)
            }
        } else {
            setSelectedAssayForMethod(assay)
        }
    }

    const handleRemove = (assayId: string) => {
        onChange(selected.filter((t) => t.assayId !== assayId))
    }

    const renderAssayList = () => (
        <ScrollArea className="flex-1 p-4">
            {isSearching && availableAssays.length === 0 ? (
                <div className="flex justify-center py-8 text-muted-foreground">Đang tải...</div>
            ) : availableAssays.length === 0 ? (
                <div className="flex justify-center py-8 text-muted-foreground">
                    Không tìm thấy chỉ tiêu
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {availableAssays.map((assay) => {
                        const isDisabled = disabledSet.has(assay.id) || selectedSet.has(assay.id)
                        return (
                            <button
                                key={assay.id}
                                onClick={() => handleAssayClick(assay)}
                                disabled={isDisabled}
                                className={`flex flex-col items-start justify-between p-3 rounded-lg border transition-all text-left group h-full min-h-[92px] relative
                                    ${isDisabled
                                        ? 'bg-slate-100 dark:bg-slate-800 opacity-60 cursor-not-allowed'
                                        : 'bg-background hover:border-primary hover:shadow-sm'
                                    }`}
                            >
                                <div className="space-y-1 w-full">
                                    <div className="font-medium text-sm line-clamp-2 pr-4">{assay.name}</div>
                                    <div className="flex flex-wrap gap-1">
                                        {assay.units && (
                                            <div className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-md w-fit">
                                                {assay.units}
                                            </div>
                                        )}
                                        {assay.methods.length > 1 && (
                                            <div className="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-md w-fit flex items-center gap-1">
                                                <Beaker className="h-3 w-3" />
                                                {assay.methods.length} PP
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {!isDisabled && (
                                    <Plus className="h-4 w-4 text-muted-foreground absolute top-2 right-2 opacity-70 group-hover:text-primary" />
                                )}
                                {isDisabled && (
                                    <CheckCircle2 className="h-4 w-4 text-green-500 absolute top-2 right-2" />
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </ScrollArea>
    )

    const renderMethodPicker = (assay: AssayDefinitionWithMethods) => (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b bg-background flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedAssayForMethod(null)}
                    className="h-8 w-8 p-0"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h3 className="font-semibold">{assay.name}</h3>
                    <p className="text-xs text-muted-foreground">Chọn phương pháp xét nghiệm</p>
                </div>
            </div>
            <ScrollArea className="flex-1 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {assay.methods.map((method) => (
                        <button
                            key={method.id}
                            onClick={() => handleAddTest(assay, method)}
                            className="flex flex-col items-start p-4 rounded-lg border bg-background hover:border-primary hover:shadow-md transition-all text-left group"
                        >
                            <div className="flex items-center justify-between w-full mb-2">
                                <span className="font-medium">{method.name}</span>
                                {method.is_default && (
                                    <Badge variant="secondary" className="text-[10px]">Mặc định</Badge>
                                )}
                            </div>
                            {method.notes && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{method.notes}</p>
                            )}
                        </button>
                    ))}
                </div>
            </ScrollArea>
        </div>
    )

    return (
        <div className="flex flex-col lg:flex-row gap-4 w-full">
            <div className="flex-1 flex flex-col border rounded-lg bg-slate-50/50 dark:bg-slate-900/40">
                <div className="p-4 border-b bg-background">
                    <p className="text-sm font-semibold">{heading}</p>
                    <p className="text-xs text-muted-foreground">{subheading}</p>
                    <div className="relative mt-3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Tìm kiếm chỉ tiêu..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                <div className="flex-1 min-h-[320px]">
                    {selectedAssayForMethod
                        ? renderMethodPicker(selectedAssayForMethod)
                        : renderAssayList()}
                </div>
            </div>

            <div className="w-full lg:w-[360px] flex flex-col border rounded-lg bg-background">
                <div className="p-4 border-b bg-slate-50 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Đã chọn</p>
                        <Badge variant="secondary">{selected.length}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Có thể đổi phương pháp hoặc bỏ chọn tại đây
                    </p>
                </div>
                <ScrollArea className="flex-1 p-4">
                    {selected.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-2 py-10">
                            <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800">
                                <Plus className="h-5 w-5" />
                            </div>
                            <p className="text-sm">Chưa có xét nghiệm nào được chọn</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {selected.map((test) => (
                                <div
                                    key={test.assayId}
                                    className="flex items-start justify-between p-3 rounded-lg border bg-white dark:bg-slate-900"
                                >
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{test.assayName}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            <span className="font-medium">PP:</span> {test.methodName}
                                        </div>
                                        {test.units && (
                                            <div className="text-[11px] text-muted-foreground mt-1">
                                                ĐVT: {test.units}
                                            </div>
                                        )}
                                        {selectedAssayForMethod?.id === test.assayId && (
                                            <p className="text-[11px] text-blue-600 mt-1">Đang chọn phương pháp...</p>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleRemove(test.assayId)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const assay = availableAssays.find((a) => a.id === test.assayId)
                                                if (assay && assay.methods.length > 1) {
                                                    setSelectedAssayForMethod(assay)
                                                }
                                            }}
                                            disabled={
                                                !(availableAssays.find((a) => a.id === test.assayId)?.methods.length > 1)
                                            }
                                        >
                                            Đổi phương pháp
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                {error && (
                    <div className="p-3 text-sm text-destructive bg-destructive/10 border-t">{error}</div>
                )}
            </div>
        </div>
    )
}

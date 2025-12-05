'use client'

import { useEffect, useState, useMemo } from 'react'
import {
    Search,
    FlaskConical,
    Plus,
    X,
    CheckCircle,
    Beaker,
    Microscope,
    Dna,
    Loader2,
    Filter,
    AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { getAssayDefinitions, assignTests } from '@/app/actions/samples'
import { toast } from 'sonner'

interface TestAssignmentModuleProps {
    sampleId: string
    onClose: () => void
    onSuccess: () => void
}

interface Assay {
    id: string
    name: string
    method_name: string | null
    default_method_id: string | null
    units: string | null
    category?: string // Optional category for filtering
}

// Mock categories for now since they aren't in the DB schema yet
const CATEGORIES = [
    { id: 'all', label: 'Tất cả', icon: FlaskConical },
    { id: 'microbio', label: 'Vi sinh', icon: Microscope },
    { id: 'chem', label: 'Hóa lý', icon: Beaker },
    { id: 'molecular', label: 'Sinh học phân tử', icon: Dna },
]

export function TestAssignmentModule({ sampleId, onClose, onSuccess }: TestAssignmentModuleProps) {
    const [assays, setAssays] = useState<Assay[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [selectedAssayIds, setSelectedAssayIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        async function fetchAssays() {
            try {
                const { data, error } = await getAssayDefinitions()
                if (error) {
                    toast.error('Không thể tải danh sách xét nghiệm')
                    console.error(error)
                } else if (data) {
                    setAssays(data as Assay[])
                }
            } catch (err) {
                console.error(err)
                toast.error('Lỗi kết nối')
            } finally {
                setLoading(false)
            }
        }
        fetchAssays()
    }, [])

    const filteredAssays = useMemo(() => {
        return assays.filter((assay) => {
            const matchesSearch = assay.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (assay.method_name && assay.method_name.toLowerCase().includes(searchQuery.toLowerCase()))

            // Mock category logic: Randomly assign for demo purposes if not present
            // In real app, this would check assay.category_id
            const matchesCategory = selectedCategory === 'all' || true

            return matchesSearch && matchesCategory
        })
    }, [assays, searchQuery, selectedCategory])

    const selectedAssaysList = useMemo(() => {
        return assays.filter((a) => selectedAssayIds.has(a.id))
    }, [assays, selectedAssayIds])

    const toggleAssay = (id: string) => {
        const next = new Set(selectedAssayIds)
        if (next.has(id)) {
            next.delete(id)
        } else {
            next.add(id)
        }
        setSelectedAssayIds(next)
    }

    const handleConfirm = async () => {
        if (selectedAssayIds.size === 0) return

        setSubmitting(true)
        try {
            const testsToAssign = selectedAssaysList.map(a => {
                if (!a.default_method_id) {
                    throw new Error(`Xét nghiệm "${a.name}" chưa có phương pháp mặc định`)
                }
                return {
                    assayId: a.id,
                    methodId: a.default_method_id,
                }
            })

            const result = await assignTests({
                sampleId,
                tests: testsToAssign
            })

            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Đã chỉ định xét nghiệm thành công')
                onSuccess()
                onClose()
            }
        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : 'Có lỗi xảy ra')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex h-[600px] w-[900px] overflow-hidden rounded-lg border bg-white shadow-xl">
            {/* Left Panel: Catalog */}
            <div className="flex w-2/3 flex-col border-r bg-slate-50/50">
                <div className="flex flex-col gap-4 p-4">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Tìm kiếm xét nghiệm theo tên hoặc mã..."
                            className="pl-9 bg-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {CATEGORIES.map((cat) => {
                            const Icon = cat.icon
                            const isSelected = selectedCategory === cat.id
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={cn(
                                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap border",
                                        isSelected
                                            ? "bg-indigo-600 text-white border-indigo-600"
                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                                    )}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {cat.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <Separator />

                <ScrollArea className="flex-1 p-4">
                    {loading ? (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : filteredAssays.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-slate-500">
                            <Search className="mb-2 h-8 w-8 opacity-20" />
                            <p>Không tìm thấy xét nghiệm phù hợp</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {filteredAssays.map((assay) => {
                                const isSelected = selectedAssayIds.has(assay.id)
                                return (
                                    <div
                                        key={assay.id}
                                        onClick={() => toggleAssay(assay.id)}
                                        className={cn(
                                            "group relative flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-all hover:shadow-md",
                                            isSelected
                                                ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                                                : "border-slate-200 bg-white hover:border-indigo-200"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className={cn(
                                                "font-medium text-sm line-clamp-2",
                                                isSelected ? "text-indigo-700" : "text-slate-700"
                                            )}>
                                                {assay.name}
                                            </h4>
                                            {isSelected && (
                                                <CheckCircle className="h-4 w-4 shrink-0 text-indigo-600" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Badge variant="secondary" className="bg-slate-100 font-normal text-slate-500">
                                                {assay.method_name || 'Chưa có PP'}
                                            </Badge>
                                            {assay.units && (
                                                <span>{assay.units}</span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Right Panel: Summary */}
            <div className="flex w-1/3 flex-col bg-white">
                <div className="flex items-center justify-between border-b p-4">
                    <h3 className="font-semibold text-slate-800">Đã chọn</h3>
                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
                        {selectedAssayIds.size}
                    </Badge>
                </div>

                <ScrollArea className="flex-1 p-4">
                    {selectedAssaysList.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                            <FlaskConical className="mb-3 h-10 w-10 opacity-20" />
                            <p className="text-sm">Chưa chọn xét nghiệm nào</p>
                            <p className="text-xs mt-1">Chọn từ danh sách bên trái</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {selectedAssaysList.map((assay) => (
                                <div
                                    key={assay.id}
                                    className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 p-2 text-sm group hover:border-red-200 hover:bg-red-50 transition-colors"
                                >
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="truncate font-medium text-slate-700 group-hover:text-red-700">
                                            {assay.name}
                                        </span>
                                        <span className="truncate text-xs text-slate-500 group-hover:text-red-500">
                                            {assay.method_name}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => toggleAssay(assay.id)}
                                        className="rounded-full p-1 text-slate-400 hover:bg-red-100 hover:text-red-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <div className="border-t bg-slate-50 p-4">
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={onClose}>
                            Hủy
                        </Button>
                        <Button
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                            disabled={selectedAssayIds.size === 0 || submitting}
                            onClick={handleConfirm}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Đang lưu...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Chỉ định ({selectedAssayIds.size})
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

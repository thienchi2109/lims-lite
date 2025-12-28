'use client'

import { useEffect, useState, useMemo, useCallback, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { sampleKeys, invalidateSampleQueries } from '@/types/query-keys'
import {
    Search,
    FlaskConical,
    Plus,
    X,
    CheckCircle,
    Loader2,
    Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { assignTestsClient, fetchAssayDefinitionsClient } from '@/lib/api-client'
import { toast } from 'sonner'
import type { LabSpecialty, SampleStatus } from '@/types'
import { SPECIALTY_BADGE_CLASSES } from '@/lib/specialty-badges'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    getMethodForAssay,
    validateAssignments,
    prepareAssignmentData,
    type AssayWithMethods,
} from '@/lib/test-assignment-logic'

interface TestAssignmentModuleProps {
    sampleId: string
    sampleStatus?: SampleStatus | null
    onClose: () => void
    onSuccess: () => void
    onRefocus?: (sampleId: string) => void // Optional callback to refocus on the sample
    specialties?: LabSpecialty[]
}

export function TestAssignmentModule({ sampleId, sampleStatus, onClose, onSuccess, onRefocus, specialties = [] }: TestAssignmentModuleProps) {
    const queryClient = useQueryClient()
    const [assays, setAssays] = useState<AssayWithMethods[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedSpecialtyId, setSelectedSpecialtyId] = useState('all')
    const [selectedAssayIds, setSelectedAssayIds] = useState<Set<string>>(new Set())
    const [isPending, startTransition] = useTransition()

    const specialtiesMap = useMemo(() => new Map(specialties.map((s) => [s.id, s])), [specialties])

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchAssays(searchQuery)
        }, 300)

        return () => clearTimeout(timer)
    }, [searchQuery])

    useEffect(() => {
        fetchAssays(searchQuery)
    }, [selectedSpecialtyId])

    async function fetchAssays(search: string) {
        setLoading(true)
        try {
            const { data, error } = await fetchAssayDefinitionsClient({
                search,
                pageSize: 100,
                specialtyId: selectedSpecialtyId,
            })
            if (error) {
                toast.error('Không thể tải danh sách xét nghiệm')
                console.error(error)
            } else if (data) {
                // Transform data to match AssayWithMethods interface
                const transformedAssays: AssayWithMethods[] = data.map((a: any) => {
                    // Map all methods with proper structure
                    const methods = a.methods.map((m: { method_id: string; name: string; is_default: boolean }) => ({
                        id: m.method_id,
                        name: m.name,
                        is_default: m.is_default || false,
                    }))

                    // Find default method ID
                    const defaultMethod = methods.find((m: { id: string; name: string; is_default: boolean }) => m.is_default)

                    return {
                        id: a.id,
                        name: a.name,
                        code: a.code,
                        specialty_id: a.specialty_id ?? null,
                        default_method_id: defaultMethod?.id ?? null,
                        methods: methods,
                    }
                })
                setAssays(transformedAssays)
            }
        } catch (err) {
            console.error(err)
            toast.error('Lỗi kết nối')
        } finally {
            setLoading(false)
        }
    }

    const selectedAssaysList = useMemo(() => {
        // Only filter from currently loaded assays (which might be incomplete if searched)
        // Ideally, we should keep a separate list of selected assays to persist them across searches
        // For now, we assume the user selects from the current view
        // But to be safe, we should probably keep selected items in a separate map or fetch them if missing
        // However, simple implementation:
        return assays.filter((a) => selectedAssayIds.has(a.id))
    }, [assays, selectedAssayIds])

    // To persist selected items across searches, we need to store the full assay object when selected
    const [selectedAssayObjects, setSelectedAssayObjects] = useState<Map<string, AssayWithMethods>>(new Map())

    const toggleAssay = useCallback((assay: AssayWithMethods) => {
        startTransition(() => {
            setSelectedAssayObjects((prev) => {
                const next = new Map(prev)
                if (next.has(assay.id)) {
                    next.delete(assay.id)
                    setSelectedAssayIds(prevIds => {
                        const nextIds = new Set(prevIds)
                        nextIds.delete(assay.id)
                        return nextIds
                    })
                } else {
                    next.set(assay.id, assay)
                    setSelectedAssayIds(prevIds => {
                        const nextIds = new Set(prevIds)
                        nextIds.add(assay.id)
                        return nextIds
                    })
                }
                return next
            })
        })
    }, [])

    // Update selectedAssayIds to be in sync (actually we can derive it, but let's keep the set for O(1) lookup)
    // Actually, let's simplify. Just use selectedAssayObjects map.

    const handleConfirm = async () => {
        if (selectedAssayObjects.size === 0) return

        setSubmitting(true)
        try {
            // Prepare assignments using shared logic
            const assignments = Array.from(selectedAssayObjects.values()).map(assay => {
                const methodSelection = getMethodForAssay(assay)

                // Show warning if exists
                if (methodSelection.warning) {
                    console.warn(methodSelection.warning)
                }

                return {
                    assay,
                    methodId: methodSelection.methodId,
                }
            })

            // Validate assignments
            const validation = validateAssignments(assignments)

            if (!validation.valid) {
                toast.error(validation.errors[0])
                setSubmitting(false)
                return
            }

            // Show warnings if any
            if (validation.warnings.length > 0) {
                validation.warnings.forEach(warning => toast.warning(warning))
            }

            // Prepare data for RPC
            const testsToAssign = prepareAssignmentData(
                assignments.map(a => ({
                    assayId: a.assay.id,
                    methodId: a.methodId,
                }))
            )

            const result = await assignTestsClient({
                sampleId,
                tests: testsToAssign
            })

            if (result.error) {
                toast.error(result.error)
                return
            }

            const insertedCount = result.data?.inserted_count ?? 0

            if (insertedCount === 0) {
                toast.info('Các xét nghiệm này đã được chỉ định trước đó, không có thay đổi mới')
                return
            }

            const message = insertedCount === 1
                ? 'Đã chỉ định 1 xét nghiệm mới'
                : `Đã chỉ định ${insertedCount} xét nghiệm mới`

            toast.success(message)

            // Invalidate all sample queries to trigger refetch
            await invalidateSampleQueries(queryClient, sampleId, { includeResults: false })

            onSuccess()
            onClose()

            // Refocus on the sample after successful assignment
            if (onRefocus) {
                onRefocus(sampleId)
            }
        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : 'Có lỗi xảy ra')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex h-[80vh] w-full overflow-hidden rounded-lg border bg-white shadow-xl">
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

                    <div className="flex flex-wrap gap-2">
                        <Select value={selectedSpecialtyId} onValueChange={setSelectedSpecialtyId}>
                            <SelectTrigger className="h-8 w-[220px] bg-white text-xs">
                                <Filter className="mr-2 h-3.5 w-3.5 text-slate-400" />
                                <SelectValue placeholder="Nhóm kỹ thuật" />
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

                <Separator />

                <div className="flex-1 p-4 overflow-y-auto">
                    {loading ? (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : assays.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-slate-500">
                            <Search className="mb-2 h-8 w-8 opacity-20" />
                            <p>Không tìm thấy xét nghiệm phù hợp</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3" style={{ willChange: isPending ? 'contents' : 'auto' }}>
                            {assays.map((assay) => {
                                const isSelected = selectedAssayObjects.has(assay.id)
                                const specialty = assay.specialty_id ? specialtiesMap.get(assay.specialty_id) : null
                                return (
                                    <div
                                        key={assay.id}
                                        onClick={() => toggleAssay(assay)}
                                        className={cn(
                                            "group relative flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-all hover:shadow-md",
                                            isSelected
                                                ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                                                : "border-slate-200 bg-white hover:border-indigo-200"
                                        )}
                                        style={{ willChange: 'transform' }}
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
                                            {(() => {
                                                const methodSelection = getMethodForAssay(assay)
                                                const methodLabel = methodSelection.methodId
                                                    ? assay.methods.find(m => m.id === methodSelection.methodId)?.name || 'Chưa có PP'
                                                    : 'Không có PP'
                                                const hasWarning = !!methodSelection.warning

                                                return (
                                                    <Badge
                                                        variant="secondary"
                                                        className={cn(
                                                            "font-normal",
                                                            hasWarning
                                                                ? "bg-amber-100 text-amber-700"
                                                                : "bg-slate-100 text-slate-500"
                                                        )}
                                                    >
                                                        {methodLabel}
                                                    </Badge>
                                                )
                                            })()}
                                            {specialty && (
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "px-2.5 py-0.5 rounded-full font-medium transition-colors text-[10px]",
                                                        specialty.code && SPECIALTY_BADGE_CLASSES[specialty.code] ? SPECIALTY_BADGE_CLASSES[specialty.code] : ''
                                                    )}
                                                >
                                                    {specialty.name}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Summary */}
            <div className="flex w-1/3 flex-col bg-white">
                <div className="flex items-center justify-between border-b p-4 pr-12">
                    <h3 className="font-semibold text-slate-800">Đã chọn</h3>
                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
                        {selectedAssayObjects.size}
                    </Badge>
                </div>

                <div className="flex-1 p-4 overflow-y-auto">
                    {selectedAssayObjects.size === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                            <FlaskConical className="mb-3 h-10 w-10 opacity-20" />
                            <p className="text-sm">Chưa chọn xét nghiệm nào</p>
                            <p className="text-xs mt-1">Chọn từ danh sách bên trái</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {Array.from(selectedAssayObjects.values()).map((assay) => (
                                <div
                                    key={assay.id}
                                    className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 p-2 text-sm group hover:border-red-200 hover:bg-red-50 transition-colors"
                                >
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="truncate font-medium text-slate-700 group-hover:text-red-700">
                                            {assay.name}
                                        </span>
                                        {(() => {
                                            const methodSelection = getMethodForAssay(assay)
                                            const methodLabel = methodSelection.methodId
                                                ? assay.methods.find(m => m.id === methodSelection.methodId)?.name || 'Chưa có PP'
                                                : 'Không có PP'

                                            return (
                                                <span className={cn(
                                                    "truncate text-xs group-hover:text-red-500",
                                                    methodSelection.warning ? "text-amber-600" : "text-slate-500"
                                                )}>
                                                    {methodLabel}
                                                    {methodSelection.warning && ' ⚠'}
                                                </span>
                                            )
                                        })()}
                                        {assay.specialty_id && specialtiesMap.get(assay.specialty_id) && (
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "mt-1 w-fit px-2 py-0.5 rounded-full font-medium transition-colors text-[10px]",
                                                    (() => {
                                                        const spec = specialtiesMap.get(assay.specialty_id)
                                                        return spec?.code && SPECIALTY_BADGE_CLASSES[spec.code] ? SPECIALTY_BADGE_CLASSES[spec.code] : ''
                                                    })()
                                                )}
                                            >
                                                {specialtiesMap.get(assay.specialty_id)?.name}
                                            </Badge>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => toggleAssay(assay)}
                                        className="rounded-full p-1 text-slate-400 hover:bg-red-100 hover:text-red-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="border-t bg-slate-50 p-4">
                    {sampleStatus === 'completed' && (
                        <div className="mb-3 flex items-center gap-2 rounded-md bg-yellow-50 p-2 text-xs text-yellow-700 border border-yellow-200">
                            <span className="font-medium">Lưu ý:</span> Mẫu đã hoàn thành không thể chỉ định thêm xét nghiệm.
                        </div>
                    )}
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={onClose}>
                            Hủy
                        </Button>
                        <Button
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                            disabled={selectedAssayObjects.size === 0 || submitting || sampleStatus === 'completed'}
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
                                    Chỉ định ({selectedAssayObjects.size})
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

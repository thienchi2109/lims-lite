'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateSampleWithAssignmentsSchema, type CreateSampleWithAssignments } from '@/types'
import { accessionAndAssignTests } from '@/app/actions/samples'
import { getAssayDefinitions } from '@/app/actions/assays'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QRScanner } from '@/components/qr-scanner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Loader2, CheckCircle2, Scan, Search, X, Beaker } from 'lucide-react'

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

type SelectedTest = {
    assayId: string
    assayName: string
    methodId: string
    methodName: string
    units: string | null
}

export function SampleAccessionForm() {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
    const [showScanner, setShowScanner] = useState(false)
    const [assaySearch, setAssaySearch] = useState('')
    const [isLoadingAssays, setIsLoadingAssays] = useState(false)
    const [assays, setAssays] = useState<AssayDefinitionWithMethods[]>([])
    const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([])
    const [assayPickerOpen, setAssayPickerOpen] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
        setValue,
    } = useForm<CreateSampleWithAssignments>({
        resolver: zodResolver(CreateSampleWithAssignmentsSchema),
        defaultValues: {
            client_name: '',
            received_at: undefined,
            tests: [],
        },
    })

    // Keep form value in sync with selected tests
    useEffect(() => {
        setValue(
            'tests',
            selectedTests.map((t) => ({
                assayId: t.assayId,
                methodId: t.methodId,
            }))
        )
    }, [selectedTests, setValue])

    const loadAssays = async (searchTerm: string) => {
        setIsLoadingAssays(true)
        try {
            const result = await getAssayDefinitions({ search: searchTerm, pageSize: 100 })
            if (!result.error && Array.isArray(result.data)) {
                setAssays(result.data as AssayDefinitionWithMethods[])
            }
        } catch (err) {
            console.error('Failed to load assays', err)
        } finally {
            setIsLoadingAssays(false)
        }
    }

    // Initial load + debounced search
    useEffect(() => {
        loadAssays('')
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => {
            loadAssays(assaySearch)
        }, 300)
        return () => clearTimeout(timer)
    }, [assaySearch])

    const onSubmit = async (data: CreateSampleWithAssignments) => {
        setIsSubmitting(true)
        setSubmitError(null)
        setSubmitSuccess(null)

        const result = await accessionAndAssignTests(data)

        if (result.error) {
            setSubmitError(result.error)
        } else {
            const sampleCode = result.data?.sample?.sample_id
            const assignedCount = result.data?.results?.length || data.tests.length
            setSubmitSuccess(`Mẫu ${sampleCode || ''} đã được tạo và chỉ định ${assignedCount} xét nghiệm.`.trim())
            reset()
            setSelectedTests([])
            // Clear success message after 5 seconds
            setTimeout(() => setSubmitSuccess(null), 5000)
        }

        setIsSubmitting(false)
    }

    const handleQRScan = (decodedText: string) => {
        setValue('client_name', decodedText)
        setShowScanner(false)
    }

    const handleAddAssay = (assay: AssayDefinitionWithMethods) => {
        const alreadySelected = selectedTests.some((t) => t.assayId === assay.id)
        if (alreadySelected) return

        const defaultMethod = assay.methods.find((m) => m.is_default) || assay.methods[0]
        if (!defaultMethod) {
            setSubmitError(`Chỉ tiêu "${assay.name}" chưa có phương pháp. Vui lòng chọn chỉ tiêu khác.`)
            return
        }

        setSelectedTests((prev) => [
            ...prev,
            {
                assayId: assay.id,
                assayName: assay.name,
                methodId: defaultMethod.method_id,
                methodName: defaultMethod.name,
                units: assay.units,
            },
        ])
    }

    const handleRemoveTest = (assayId: string) => {
        setSelectedTests((prev) => prev.filter((t) => t.assayId !== assayId))
    }

    const handleMethodChange = (assayId: string, methodId: string) => {
        const assay = assays.find((a) => a.id === assayId)
        const method = assay?.methods.find((m) => m.method_id === methodId)
        if (!assay || !method) return

        setSelectedTests((prev) =>
            prev.map((t) =>
                t.assayId === assayId ? { ...t, methodId: method.method_id, methodName: method.name } : t
            )
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tiếp nhận mẫu mới</CardTitle>
                <CardDescription>
                    Tiếp nhận mẫu mới và chỉ định xét nghiệm. Mã mẫu sẽ được tạo tự động.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Client Name Field */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="client_name">Tên khách hàng *</Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowScanner(!showScanner)}
                            >
                                <Scan className="h-4 w-4 mr-2" />
                                {showScanner ? 'Ẩn máy quét' : 'Quét QR'}
                            </Button>
                        </div>
                        <Input
                            id="client_name"
                            {...register('client_name')}
                            placeholder="Nhập tên khách hàng"
                            autoFocus
                        />
                        {errors.client_name && (
                            <p className="text-sm text-destructive">{errors.client_name.message}</p>
                        )}
                    </div>

                    {/* QR Scanner */}
                    {showScanner && (
                        <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900">
                            <QRScanner
                                onScan={handleQRScan}
                                onError={(error) => setSubmitError(error)}
                            />
                        </div>
                    )}

                    {/* Received At Field (Optional) */}
                    <div className="space-y-2">
                        <Label htmlFor="received_at">Thời gian nhận (Tùy chọn)</Label>
                        <Input
                            id="received_at"
                            type="datetime-local"
                            {...register('received_at')}
                        />
                        <p className="text-xs text-muted-foreground">
                            Để trống để sử dụng ngày giờ hiện tại
                        </p>
                        {errors.received_at && (
                            <p className="text-sm text-destructive">{errors.received_at.message}</p>
                        )}
                    </div>

                    {/* Test Assignment Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label>Chỉ định xét nghiệm *</Label>
                            <span className="text-xs text-muted-foreground">
                                Chọn ít nhất một chỉ tiêu và phương pháp
                            </span>
                        </div>
                        <div className="rounded-lg border p-4 space-y-4">
                            <Popover open={assayPickerOpen} onOpenChange={setAssayPickerOpen}>
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-medium">Thêm chỉ tiêu</p>
                                        <p className="text-xs text-muted-foreground">
                                            Tìm kiếm và chọn chỉ tiêu kèm phương pháp
                                        </p>
                                    </div>
                                    <PopoverTrigger asChild>
                                        <Button type="button" variant="outline" size="sm">
                                            Chọn xét nghiệm
                                        </Button>
                                    </PopoverTrigger>
                                </div>
                                <PopoverContent className="w-[min(960px,90vw)] max-h-[480px] p-4" align="end">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                value={assaySearch}
                                                onChange={(e) => setAssaySearch(e.target.value)}
                                                placeholder="Tìm kiếm chỉ tiêu..."
                                                className="pl-9"
                                            />
                                        </div>
                                        {isLoadingAssays && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                    </div>
                                    <ScrollArea className="h-[360px] border rounded-md p-3">
                                        {assays.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-4">
                                                Không tìm thấy chỉ tiêu nào
                                            </p>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                {assays.map((assay) => {
                                                    const isSelected = selectedTests.some((t) => t.assayId === assay.id)
                                                    return (
                                                        <button
                                                            key={assay.id}
                                                            type="button"
                                                            onClick={() => handleAddAssay(assay)}
                                                            disabled={isSelected}
                                                            className={`w-full text-left p-3 rounded-md border transition hover:shadow-sm ${isSelected ? 'opacity-60 cursor-not-allowed bg-muted' : 'bg-background'
                                                                }`}
                                                        >
                                                            <div className="font-medium text-sm line-clamp-2">{assay.name}</div>
                                                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                                                                {assay.units && <span>{assay.units}</span>}
                                                                {assay.methods?.length > 1 && (
                                                                    <span className="inline-flex items-center gap-1 text-blue-600">
                                                                        <Beaker className="h-3 w-3" />
                                                                        {assay.methods.length} PP
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {isSelected && (
                                                                <p className="text-[11px] text-green-600 mt-1">Đã chọn</p>
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </PopoverContent>
                            </Popover>

                            <div className="space-y-2">
                                {selectedTests.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        Chưa có chỉ tiêu nào được chọn.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedTests.map((test) => {
                                            const assay = assays.find((a) => a.id === test.assayId)
                                            return (
                                                <div
                                                    key={test.assayId}
                                                    className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-md border p-3"
                                                >
                                                    <div className="flex-1">
                                                        <div className="font-semibold">{test.assayName}</div>
                                                        {test.units && (
                                                            <p className="text-xs text-muted-foreground">ĐVT: {test.units}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Select
                                                            value={test.methodId}
                                                            onValueChange={(value) => handleMethodChange(test.assayId, value)}
                                                        >
                                                            <SelectTrigger className="min-w-[180px]">
                                                                <SelectValue placeholder="Chọn phương pháp" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {assay?.methods.map((method) => (
                                                                    <SelectItem key={method.method_id} value={method.method_id}>
                                                                        {method.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleRemoveTest(test.assayId)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                                {errors.tests && (
                                    <p className="text-sm text-destructive">
                                        {errors.tests?.message as string || 'Vui lòng chọn ít nhất một xét nghiệm'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {submitError && (
                        <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                            {submitError}
                        </div>
                    )}

                    {/* Success Message */}
                    {submitSuccess && (
                        <div className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 p-3 rounded-md text-sm flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            {submitSuccess}
                        </div>
                    )}

                    {/* Submit Button */}
                    <Button type="submit" disabled={isSubmitting} className="w-full">
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Đang tạo mẫu...
                            </>
                        ) : (
                            'Tạo mẫu và chỉ định'
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}

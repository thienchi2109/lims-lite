'use client'

import { useState, useMemo } from 'react'
import { createQCDefinition } from '@/app/actions/qc-setup'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    ArrowLeft,
    ArrowRight,
    Calculator,
    CheckCircle2,
    Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

import {
    type AssayOption,
    type MaterialOption,
    type DataPoint,
    calculateStatistics,
    MINIMUM_DATA_POINTS,
} from './control-limits-types'
import { Step1Selection } from './control-limits-step1'
import { Step2DataEntry } from './control-limits-step2'
import { Step3Review } from './control-limits-step3'

// ============================================================================
// TYPES
// ============================================================================

interface ControlLimitsWizardProps {
    onSuccess?: () => void
    onCancel?: () => void
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ControlLimitsWizard({
    onSuccess,
    onCancel,
}: ControlLimitsWizardProps) {
    const [step, setStep] = useState(1)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Step 1: Selection - store full objects, not just IDs
    const [selectedAssay, setSelectedAssay] = useState<AssayOption | null>(null)
    const [selectedMaterial, setSelectedMaterial] = useState<MaterialOption | null>(null)

    // Step 2: Data points
    const [dataPoints, setDataPoints] = useState<DataPoint[]>([])
    const [newValue, setNewValue] = useState('')
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])

    // Calculated statistics
    const stats = useMemo(() => {
        const values = dataPoints.map(dp => dp.value)
        return calculateStatistics(values)
    }, [dataPoints])

    const hasMinimumPoints = dataPoints.length >= MINIMUM_DATA_POINTS

    // ========================================================================
    // HANDLERS
    // ========================================================================

    const handleAddDataPoint = () => {
        const value = parseFloat(newValue)
        if (isNaN(value) || value <= 0) {
            toast.error('Giá trị không hợp lệ')
            return
        }

        const newPoint: DataPoint = {
            id: crypto.randomUUID(),
            value,
            date: newDate,
        }

        setDataPoints(prev => [...prev, newPoint])
        setNewValue('')
        setNewDate(new Date().toISOString().split('T')[0])
    }

    const handleRemoveDataPoint = (id: string) => {
        setDataPoints(prev => prev.filter(dp => dp.id !== id))
    }

    const handleNext = () => {
        if (step === 1) {
            if (!selectedAssay || !selectedMaterial) {
                toast.error('Vui lòng chọn xét nghiệm và vật liệu QC')
                return
            }
        }
        setStep(prev => Math.min(prev + 1, 3))
    }

    const handleBack = () => {
        setStep(prev => Math.max(prev - 1, 1))
    }

    const handleSubmit = async () => {
        if (!stats || !hasMinimumPoints) {
            toast.error('Cần ít nhất 20 điểm dữ liệu')
            return
        }

        if (!selectedAssay || !selectedMaterial) {
            toast.error('Vui lòng chọn xét nghiệm và vật liệu QC')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await createQCDefinition({
                assay_id: selectedAssay.id,
                material_id: selectedMaterial.id,
                mean: stats.mean,
                sd: stats.sd,
                cv_percent: stats.cv,
                active_from: new Date().toISOString().split('T')[0],
                data_points_count: stats.count,
            })

            if ('error' in result) {
                toast.error(result.error)
                return
            }

            toast.success('Đã thiết lập giới hạn kiểm soát thành công')
            onSuccess?.()
        } catch (error) {
            toast.error('Không thể thiết lập giới hạn kiểm soát')
            console.error('Create definition error:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    // ========================================================================
    // MAIN RENDER
    // ========================================================================

    return (
        <Card className="w-full max-w-2xl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Thiết lập giới hạn kiểm soát
                </CardTitle>
                <CardDescription>
                    Bước {step}/3:{' '}
                    {step === 1 && 'Chọn xét nghiệm và vật liệu QC'}
                    {step === 2 && 'Nhập dữ liệu (20 điểm trong 10+ ngày)'}
                    {step === 3 && 'Xác nhận và phê duyệt'}
                </CardDescription>
            </CardHeader>

            <CardContent>
                {step === 1 && (
                    <Step1Selection
                        selectedAssay={selectedAssay}
                        selectedMaterial={selectedMaterial}
                        onAssayChange={setSelectedAssay}
                        onMaterialChange={setSelectedMaterial}
                    />
                )}
                {step === 2 && (
                    <Step2DataEntry
                        dataPoints={dataPoints}
                        stats={stats}
                        newValue={newValue}
                        newDate={newDate}
                        onValueChange={setNewValue}
                        onDateChange={setNewDate}
                        onAddDataPoint={handleAddDataPoint}
                        onRemoveDataPoint={handleRemoveDataPoint}
                    />
                )}
                {step === 3 && (
                    <Step3Review
                        selectedAssay={selectedAssay ?? undefined}
                        selectedMaterial={selectedMaterial ?? undefined}
                        stats={stats}
                    />
                )}
            </CardContent>

            <CardFooter className="flex justify-between">
                <div>
                    {step > 1 && (
                        <Button variant="outline" onClick={handleBack}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Quay lại
                        </Button>
                    )}
                    {step === 1 && onCancel && (
                        <Button variant="outline" onClick={onCancel}>
                            Hủy
                        </Button>
                    )}
                </div>

                <div>
                    {step < 3 && (
                        <Button onClick={handleNext}>
                            Tiếp theo
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    )}
                    {step === 3 && (
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting || !hasMinimumPoints}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Đang xử lý...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Phê duyệt giới hạn
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </CardFooter>
        </Card>
    )
}

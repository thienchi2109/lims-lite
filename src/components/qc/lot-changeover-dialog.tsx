'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { completeLotChangeover } from '@/app/actions/qc-setup'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    AlertTriangle,
    CheckCircle2,
    Loader2,
    Package,
    RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

import {
    type CrossoverDataPoint,
    type LotChangeoverDialogProps,
    type NewLotForm,
    NewLotFormSchema,
    MINIMUM_CROSSOVER_POINTS,
    calculateStats,
} from './lot-changeover-types'
import { LotComparison } from './lot-comparison'
import { CrossoverDataEntry } from './crossover-data-entry'

// ============================================================================
// COMPONENT
// ============================================================================

export function LotChangeoverDialog({
    currentMaterial,
    definitions,
    onSuccess,
    trigger,
}: LotChangeoverDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [crossoverData, setCrossoverData] = useState<CrossoverDataPoint[]>([])

    // New data point inputs
    const [oldValue, setOldValue] = useState('')
    const [newValue, setNewValue] = useState('')
    const [dataDate, setDataDate] = useState(new Date().toISOString().split('T')[0])

    // Get first definition's CV% to transfer
    const currentCV = definitions[0]?.cv_percent ||
        (definitions[0]?.sd && definitions[0]?.mean
            ? (definitions[0].sd / definitions[0].mean) * 100
            : 0)

    const form = useForm<NewLotForm>({
        resolver: zodResolver(NewLotFormSchema),
        defaultValues: {
            name: currentMaterial.name,
            manufacturer: currentMaterial.manufacturer,
            lot_number: '',
            expiry_date: '',
            level: currentMaterial.level as 'low' | 'normal' | 'high',
            notes: '',
        },
    })

    // Calculate statistics from crossover data
    const crossoverStats = useMemo(() => {
        const oldValues = crossoverData.map(dp => dp.oldLotValue)
        const newValues = crossoverData.map(dp => dp.newLotValue)
        return {
            oldLot: calculateStats(oldValues),
            newLot: calculateStats(newValues),
            count: crossoverData.length,
        }
    }, [crossoverData])

    const hasMinimumPoints = crossoverData.length >= MINIMUM_CROSSOVER_POINTS

    // ========================================================================
    // HANDLERS
    // ========================================================================

    const handleAddDataPoint = () => {
        const oldVal = parseFloat(oldValue)
        const newVal = parseFloat(newValue)

        if (isNaN(oldVal) || oldVal <= 0 || isNaN(newVal) || newVal <= 0) {
            toast.error('Giá trị không hợp lệ')
            return
        }

        const newPoint: CrossoverDataPoint = {
            id: crypto.randomUUID(),
            oldLotValue: oldVal,
            newLotValue: newVal,
            date: dataDate,
        }

        setCrossoverData(prev => [...prev, newPoint])
        setOldValue('')
        setNewValue('')
        setDataDate(new Date().toISOString().split('T')[0])
    }

    const handleRemoveDataPoint = (id: string) => {
        setCrossoverData(prev => prev.filter(dp => dp.id !== id))
    }

    const handleSubmit = async (formData: NewLotForm) => {
        if (!hasMinimumPoints) {
            toast.error(`Cần ít nhất ${MINIMUM_CROSSOVER_POINTS} điểm dữ liệu chéo`)
            return
        }

        if (!crossoverStats.newLot) {
            toast.error('Không thể tính toán thống kê từ dữ liệu chéo')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await completeLotChangeover({
                old_material_id: currentMaterial.id,
                new_material: {
                    name: formData.name,
                    manufacturer: formData.manufacturer,
                    lot_number: formData.lot_number,
                    expiry_date: formData.expiry_date,
                    level: formData.level,
                },
                new_mean: crossoverStats.newLot.mean,
                transfer_cv_percent: currentCV,
                crossover_data_points: crossoverData.length,
                notes: formData.notes,
            })

            if ('error' in result) {
                toast.error(result.error)
                return
            }

            toast.success('Chuyển lô QC thành công')
            setIsOpen(false)
            form.reset()
            setCrossoverData([])
            onSuccess?.()
        } catch (error) {
            toast.error('Không thể hoàn thành chuyển lô')
            console.error('Lot changeover error:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    // ========================================================================
    // RENDER
    // ========================================================================

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button variant="outline" size="sm">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Chuyển lô
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Chuyển lô QC Material
                    </DialogTitle>
                    <DialogDescription>
                        Chuyển giới hạn kiểm soát từ lô cũ sang lô mới. CV% được giữ nguyên, Mean mới tính từ dữ liệu chéo.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(handleSubmit)}>
                    <div className="space-y-6 py-4">
                        {/* Current vs New Lot Comparison */}
                        <LotComparison
                            currentMaterial={currentMaterial}
                            definitions={definitions}
                            currentCV={currentCV}
                            form={form}
                        />

                        {/* Crossover Data Collection */}
                        <CrossoverDataEntry
                            crossoverData={crossoverData}
                            oldValue={oldValue}
                            newValue={newValue}
                            dataDate={dataDate}
                            crossoverStats={crossoverStats}
                            currentCV={currentCV}
                            onOldValueChange={setOldValue}
                            onNewValueChange={setNewValue}
                            onDateChange={setDataDate}
                            onAddDataPoint={handleAddDataPoint}
                            onRemoveDataPoint={handleRemoveDataPoint}
                        />

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="notes">Ghi chú</Label>
                            <Textarea
                                id="notes"
                                {...form.register('notes')}
                                placeholder="Ghi chú về việc chuyển lô (tùy chọn)..."
                                rows={2}
                            />
                        </div>

                        {/* Warning */}
                        {!hasMinimumPoints && (
                            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                Cần ít nhất {MINIMUM_CROSSOVER_POINTS} điểm dữ liệu chéo để hoàn thành chuyển lô.
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsOpen(false)}
                        >
                            Hủy
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !hasMinimumPoints}
                            className="gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Đang xử lý...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-4 w-4" />
                                    Phê duyệt chuyển lô
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

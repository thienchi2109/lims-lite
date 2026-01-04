'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
    CreateQCResultSchema,
    type CreateQCResult,
    type QCSession,
    type QCDefinition,
} from '@/types/qc'
import { calculateZScore, evaluateWestgardRules, type WestgardEvaluation } from '@/lib/qc/westgard-rules'
import { enterQCResult } from '@/app/actions/qc-operations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
    Loader2,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Activity,
} from 'lucide-react'
import { toast } from 'sonner'

// Form schema with validation
const QCEntryFormSchema = z.object({
    definition_id: z.string().uuid('Vui lòng chọn vật liệu QC'),
    value: z.number({ message: 'Giá trị phải là số' }),
    notes: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
})

type QCEntryFormData = z.infer<typeof QCEntryFormSchema>

interface QCDefinitionOption {
    id: string
    materialName: string
    level: string
    lotNumber: string
    mean: number
    sd: number
}

interface QCEntryFormProps {
    /** Active QC session */
    session: QCSession
    /** Available QC definitions for this assay */
    definitions: QCDefinitionOption[]
    /** Assay name for display */
    assayName: string
    /** Assay units for display */
    assayUnits?: string | null
    /** Historical Z-scores for trend rules (most recent first) */
    historyZScores?: number[]
    /** Callback when entry is successful */
    onSuccess?: () => void
}

/**
 * QC Entry Form for entering daily quality control results
 * Implements Westgard rule evaluation with real-time feedback
 */
export function QCEntryForm({
    session,
    definitions,
    assayName,
    assayUnits,
    historyZScores = [],
    onSuccess,
}: QCEntryFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [evaluation, setEvaluation] = useState<WestgardEvaluation | null>(null)
    const [selectedDefId, setSelectedDefId] = useState<string>('')
    const [inputValue, setInputValue] = useState<string>('')

    const form = useForm<QCEntryFormData>({
        resolver: zodResolver(QCEntryFormSchema),
        defaultValues: {
            definition_id: '',
            value: undefined,
            notes: '',
        },
    })

    // Memoize selected definition to prevent unnecessary recalculations
    const selectedDef = useMemo(() => {
        return definitions.find(d => d.id === selectedDefId) || null
    }, [selectedDefId, definitions])

    // Handle definition selection
    const handleDefinitionChange = (defId: string) => {
        setSelectedDefId(defId)
        form.setValue('definition_id', defId)
        setEvaluation(null)
    }

    // Handle value input change with real-time Westgard evaluation
    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const strValue = e.target.value
        setInputValue(strValue)

        const numValue = parseFloat(strValue)
        if (!isNaN(numValue)) {
            form.setValue('value', numValue)

            // Real-time Westgard evaluation
            if (selectedDef) {
                const result = evaluateWestgardRules({
                    value: numValue,
                    mean: selectedDef.mean,
                    sd: selectedDef.sd,
                    history: historyZScores,
                })
                setEvaluation(result)
            }
        } else {
            setEvaluation(null)
        }
    }

    const handleSubmit = async (data: QCEntryFormData) => {
        setIsSubmitting(true)
        try {
            const result = await enterQCResult({
                session_id: session.id,
                definition_id: data.definition_id,
                value: data.value,
                notes: data.notes,
            })

            if ('error' in result) {
                toast.error(result.error)
                return
            }

            const status = result.evaluation?.status
            if (status === 'reject') {
                toast.error('QC KHÔNG ĐẠT - Dừng xét nghiệm và thực hiện khắc phục', {
                    duration: 8000,
                })
            } else if (status === 'warning') {
                toast.warning('QC Cảnh báo - Theo dõi chặt chẽ', {
                    duration: 5000,
                })
            } else {
                toast.success('QC Đạt')
            }

            form.reset()
            setSelectedDefId('')
            setInputValue('')
            setEvaluation(null)
            onSuccess?.()
        } catch (error) {
            toast.error('Không thể lưu kết quả QC')
            console.error('QC entry error:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    // Status badge component
    const StatusBadge = ({ status }: { status: 'pass' | 'warning' | 'reject' }) => {
        const variants = {
            pass: { variant: 'default' as const, icon: CheckCircle2, text: 'ĐẠT', className: 'bg-green-600' },
            warning: { variant: 'secondary' as const, icon: AlertTriangle, text: 'CẢNH BÁO', className: 'bg-yellow-500 text-black' },
            reject: { variant: 'destructive' as const, icon: XCircle, text: 'KHÔNG ĐẠT', className: '' },
        }
        const config = variants[status]
        const Icon = config.icon

        return (
            <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
                <Icon className="h-3 w-3" />
                {config.text}
            </Badge>
        )
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Nhập kết quả QC
                        </CardTitle>
                        <CardDescription>
                            {assayName} {assayUnits && `(${assayUnits})`}
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="gap-1">
                        Phiên: {session.session_mode}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    {/* Material/Level Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="definition_id">Vật liệu QC / Mức</Label>
                        <Select
                            value={selectedDefId || undefined}
                            onValueChange={handleDefinitionChange}
                        >
                            <SelectTrigger id="definition_id">
                                <SelectValue placeholder="Chọn vật liệu QC..." />
                            </SelectTrigger>
                            <SelectContent>
                                {definitions.map((def) => (
                                    <SelectItem key={def.id} value={def.id}>
                                        {def.materialName} - {def.level} (Lô: {def.lotNumber})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {form.formState.errors.definition_id && (
                            <p className="text-sm text-destructive">
                                {form.formState.errors.definition_id.message}
                            </p>
                        )}
                    </div>

                    {/* Control Limits Display */}
                    {selectedDef && (
                        <div className="rounded-md bg-muted p-3 text-sm">
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                    <span className="text-muted-foreground">Mean</span>
                                    <p className="font-mono font-medium">{selectedDef.mean.toFixed(2)}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">SD</span>
                                    <p className="font-mono font-medium">{selectedDef.sd.toFixed(2)}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">±2SD</span>
                                    <p className="font-mono font-medium">
                                        {(selectedDef.mean - 2 * selectedDef.sd).toFixed(2)} - {(selectedDef.mean + 2 * selectedDef.sd).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Value Input */}
                    <div className="space-y-2">
                        <Label htmlFor="value">Giá trị đo được</Label>
                        <Input
                            id="value"
                            type="number"
                            step="any"
                            placeholder="Nhập giá trị..."
                            value={inputValue}
                            onChange={handleValueChange}
                            className="font-mono text-lg"
                        />
                        {form.formState.errors.value && (
                            <p className="text-sm text-destructive">
                                {form.formState.errors.value.message}
                            </p>
                        )}
                    </div>

                    {/* Real-time Evaluation Display */}
                    {evaluation && (
                        <Alert
                            id="tour-iqc-westgard-feedback"
                            variant={evaluation.status === 'reject' ? 'destructive' : 'default'}
                            className={evaluation.status === 'warning' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950' : ''}
                        >
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                    <StatusBadge status={evaluation.status} />
                                </div>
                                <div className="flex-1">
                                    <AlertTitle className="flex items-center gap-2">
                                        Z-score: <span className="font-mono">{evaluation.zScore.toFixed(2)}</span>
                                    </AlertTitle>
                                    <AlertDescription className="mt-1">
                                        {evaluation.recommendation}
                                    </AlertDescription>
                                    {evaluation.triggeredRules.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {evaluation.triggeredRules.map((rule, idx) => (
                                                <p key={idx} className="text-sm">
                                                    <Badge
                                                        variant={rule.isWarning ? 'secondary' : 'destructive'}
                                                        className="mr-2"
                                                    >
                                                        {rule.rule}
                                                    </Badge>
                                                    {rule.message}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Alert>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Ghi chú (tùy chọn)</Label>
                        <Textarea
                            id="notes"
                            placeholder="Ghi chú về kết quả QC..."
                            {...form.register('notes')}
                            rows={2}
                        />
                    </div>

                    {/* Submit Button */}
                    <Button
                        id="tour-iqc-save-button"
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting || !selectedDef}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Đang lưu...
                            </>
                        ) : (
                            'Lưu kết quả QC'
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}

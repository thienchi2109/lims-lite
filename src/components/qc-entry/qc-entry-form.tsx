'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'

// ============================================================================
// SCHEMA
// ============================================================================

const QCEntryFormSchema = z.object({
    value: z.number({ message: 'Giá trị đo là bắt buộc và phải là số' }),
    notes: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
})

type QCEntryFormData = z.infer<typeof QCEntryFormSchema>

// ============================================================================
// TYPES
// ============================================================================

interface QCEntryFormProps {
    /** Assay ID for which to enter QC value */
    assayId: string
    /** Callback when entry is successful */
    onSuccess?: () => void
}

// ============================================================================
// PLACEHOLDER ACTION
// ============================================================================

// TODO: Replace with actual server action import
async function saveQCResult(data: { assayId: string; value: number; notes?: string }) {
    // Simulate server delay
    await new Promise((resolve) => setTimeout(resolve, 500))
    console.log('Saving QC result:', data)
    return { success: true }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Simplified QC Entry Form for the detail sheet.
 * Allows entering a measured value and optional notes.
 */
export function QCEntryForm({ assayId, onSuccess }: QCEntryFormProps) {
    const form = useForm<QCEntryFormData>({
        resolver: zodResolver(QCEntryFormSchema),
        defaultValues: {
            value: undefined,
            notes: '',
        },
    })

    const isSubmitting = form.formState.isSubmitting

    const handleSubmit = async (data: QCEntryFormData) => {
        try {
            const result = await saveQCResult({
                assayId,
                value: data.value,
                notes: data.notes,
            })

            if (result.success) {
                toast.success('Lưu kết quả QC thành công')
                form.reset()
                onSuccess?.()
            }
        } catch (error) {
            console.error('QC entry error:', error)
            toast.error('Không thể lưu kết quả QC')
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                {/* Value Input */}
                <FormField
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Giá trị đo</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    step="any"
                                    placeholder="Nhập giá trị..."
                                    className="font-mono text-lg"
                                    {...field}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        field.onChange(val === '' ? undefined : parseFloat(val))
                                    }}
                                    value={field.value ?? ''}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Notes Textarea */}
                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Ghi chú</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Ghi chú về kết quả QC..."
                                    rows={3}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Submit Button */}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Đang lưu...
                        </>
                    ) : (
                        'Lưu'
                    )}
                </Button>
            </form>
        </Form>
    )
}

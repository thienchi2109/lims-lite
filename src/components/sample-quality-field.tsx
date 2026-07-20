'use client'

import { useId } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface SampleQualityFieldProps {
    value: boolean | null
    onChange: (value: boolean | null) => void
    className?: string
}

const QUALITY_OPTIONS = [
    { label: 'Đạt', value: true },
    { label: 'Không đạt', value: false },
] as const

export function SampleQualityField({
    value,
    onChange,
    className,
}: SampleQualityFieldProps) {
    const fieldId = useId()
    const labelId = `${fieldId}-label`
    const descriptionId = `${fieldId}-description`

    return (
        <div className={cn('space-y-2', className)}>
            <Label
                id={labelId}
                className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
            >
                Chất lượng mẫu *
            </Label>
            <div
                role="group"
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
                className="grid grid-cols-2 gap-3"
            >
                {QUALITY_OPTIONS.map((option) => {
                    const optionId = `${fieldId}-${option.value ? 'acceptable' : 'unacceptable'}`
                    const checked = value === option.value

                    return (
                        <div
                            key={option.label}
                            className={cn(
                                'flex min-h-11 items-center gap-3 rounded-md border px-3 py-2',
                                checked
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border bg-background',
                            )}
                        >
                            <Checkbox
                                id={optionId}
                                checked={checked}
                                onCheckedChange={(nextChecked) => {
                                    onChange(nextChecked === true ? option.value : null)
                                }}
                            />
                            <Label
                                htmlFor={optionId}
                                className="flex-1 cursor-pointer text-sm font-medium"
                            >
                                {option.label}
                            </Label>
                        </div>
                    )
                })}
            </div>
            <p id={descriptionId} className="sr-only">
                Bắt buộc chọn một trong hai giá trị.
            </p>
        </div>
    )
}

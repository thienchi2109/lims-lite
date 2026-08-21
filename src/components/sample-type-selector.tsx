'use client'

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type { PublishedCatalogSampleType } from '@/types'

interface SampleTypeSelectorProps {
    value: string | null
    options: PublishedCatalogSampleType[]
    onChange: (sampleTypeId: string) => void
    disabled?: boolean
}

export function SampleTypeSelector({
    value,
    options,
    onChange,
    disabled,
}: SampleTypeSelectorProps) {
    return (
        <Select
            value={value ?? undefined}
            onValueChange={onChange}
            disabled={disabled}
        >
            <SelectTrigger className="w-full shadow-sm border-slate-200 dark:border-slate-800">
                <SelectValue placeholder="Chọn loại mẫu" />
            </SelectTrigger>
            <SelectContent>
                {options.map((sampleType) => (
                    <SelectItem key={sampleType.id} value={sampleType.id}>
                        {sampleType.name} ({sampleType.importCode})
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

'use client'

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { SampleType } from '@/types'

interface SampleTypeSelectorProps {
    value: SampleType
    onChange: (value: SampleType) => void
    disabled?: boolean
}

const SAMPLE_TYPES: SampleType[] = [
    'Máu',
    'Dịch niệu đạo/âm đạo',
    'Nước tiểu',
    'Phết tế bào âm đạo',
    'Ngoáy trực tràng/hậu môn',
    'Phân',
    'Nước',
    'Thực phẩm'
]

export function SampleTypeSelector({ value, onChange, disabled }: SampleTypeSelectorProps) {
    return (
        <Select
            value={value}
            onValueChange={(val) => onChange(val as SampleType)}
            disabled={disabled}
        >
            <SelectTrigger className="w-full shadow-sm border-slate-200 dark:border-slate-800">
                <SelectValue placeholder="Chọn loại mẫu" />
            </SelectTrigger>
            <SelectContent>
                {SAMPLE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                        {type}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

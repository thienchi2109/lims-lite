'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar } from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

const DATE_RANGES = [
    { value: '90', label: '90 ngày' },
    { value: '180', label: '180 ngày' },
    { value: '365', label: '1 năm' },
    { value: 'all', label: 'Tất cả' },
] as const

interface QCDateRangeSelectorProps {
    currentValue: string
}

export function QCDateRangeSelector({ currentValue }: QCDateRangeSelectorProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    function handleChange(value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value === '90') {
            // Default value - remove from URL to keep it clean
            params.delete('qc_days')
        } else {
            params.set('qc_days', value)
        }
        router.push(`?${params.toString()}`)
    }

    return (
        <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={currentValue} onValueChange={handleChange}>
                <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Chọn khoảng thời gian" />
                </SelectTrigger>
                <SelectContent>
                    {DATE_RANGES.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                            {range.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}

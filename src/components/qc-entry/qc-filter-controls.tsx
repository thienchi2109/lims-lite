'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useFilterParams } from './use-filter-params'

// ============================================================================
// TYPES
// ============================================================================

interface SpecialtyOption {
    id: string
    name: string
    count: number
}

interface QCFilterControlsProps {
    specialties: SpecialtyOption[]
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_OPTIONS = [
    { value: 'all', label: 'Tất cả trạng thái' },
    { value: 'pending', label: 'Chờ nhập' },
    { value: 'entered', label: 'Đã nhập' },
    { value: 'approved', label: 'Đã duyệt' },
] as const

// ============================================================================
// COMPONENT
// ============================================================================

export function QCFilterControls({ specialties }: QCFilterControlsProps) {
    const {
        specialty,
        status,
        searchValue,
        setSearchValue,
        updateParam,
        isPending,
    } = useFilterParams()

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search input */}
            <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Tìm xét nghiệm..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="pl-9"
                    aria-label="Tìm kiếm xét nghiệm"
                />
            </div>

            {/* Specialty dropdown */}
            <Select
                value={specialty ?? 'all'}
                onValueChange={(value) => updateParam('specialty', value)}
            >
                <SelectTrigger className="w-full sm:w-48" aria-label="Lọc theo chuyên khoa">
                    <SelectValue placeholder="Tất cả chuyên khoa" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Tất cả chuyên khoa</SelectItem>
                    {specialties.map((spec) => (
                        <SelectItem key={spec.id} value={spec.id}>
                            {spec.name} ({spec.count})
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Status dropdown */}
            <Select
                value={status ?? 'all'}
                onValueChange={(value) => updateParam('status', value)}
            >
                <SelectTrigger className="w-full sm:w-40" aria-label="Lọc theo trạng thái">
                    <SelectValue placeholder="Tất cả trạng thái" />
                </SelectTrigger>
                <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Loading indicator (subtle) */}
            {isPending && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            )}
        </div>
    )
}

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

const SEARCH_DEBOUNCE_MS = 300

interface QCMaterialsFilterBarProps {
    search: string
    level: string | null
    status: string | null
}

const levelOptions = [
    { value: 'all', label: 'Tất cả' },
    { value: 'low', label: 'Thấp' },
    { value: 'normal', label: 'Bình thường' },
    { value: 'high', label: 'Cao' },
]

const statusOptions = [
    { value: 'all', label: 'Tất cả' },
    { value: 'valid', label: 'Còn hạn' },
    { value: 'expiring_soon', label: 'Sắp hết hạn' },
    { value: 'expired', label: 'Hết hạn' },
]

export function QCMaterialsFilterBar({ search, level, status }: QCMaterialsFilterBarProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [searchValue, setSearchValue] = useState(search)

    const updateUrl = useCallback((updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString())
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === '' || value === 'all') {
                params.delete(key)
            } else {
                params.set(key, value)
            }
        })
        params.set('mat_page', '1')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname)
    }, [searchParams, router, pathname])

    // Debounced search - updates URL after delay
    useEffect(() => {
        const timer = setTimeout(() => {
            const currentSearch = searchParams.get('mat_search') || ''
            if (currentSearch !== searchValue) {
                updateUrl({ mat_search: searchValue || null })
            }
        }, SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [searchValue, searchParams, updateUrl])

    // Sync local search state with URL when navigating externally
    useEffect(() => { setSearchValue(search) }, [search])

    const hasFilters = useMemo(() => {
        return search !== '' || level !== null || status !== null
    }, [search, level, status])

    const clearFilters = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('mat_search')
        params.delete('mat_level')
        params.delete('mat_status')
        params.set('mat_page', '1')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname)
        setSearchValue('')
    }, [searchParams, router, pathname])

    return (
        <div className="flex flex-col sm:flex-row gap-3 w-full">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
                <Input
                    placeholder="Tìm theo tên, số lô, nhà sản xuất..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="pl-9 h-10 w-full"
                />
            </div>

            {/* Level Dropdown */}
            <Select value={level || 'all'} onValueChange={(val) => updateUrl({ mat_level: val })}>
                <SelectTrigger className="h-10 w-[140px]">
                    <SelectValue placeholder="Mức độ" />
                </SelectTrigger>
                <SelectContent>
                    {levelOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Status Dropdown */}
            <Select value={status || 'all'} onValueChange={(val) => updateUrl({ mat_status: val })}>
                <SelectTrigger className="h-10 w-[150px]">
                    <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                    {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Clear Filters Button */}
            {hasFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-10 gap-1.5 text-muted-foreground hover:text-destructive"
                >
                    <X className="h-4 w-4" />
                    Xóa bộ lọc
                </Button>
            )}
        </div>
    )
}

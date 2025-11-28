'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { type SampleStatus } from '@/types'
import { cn } from '@/lib/utils'
import { Search, Calendar } from 'lucide-react'

type SampleFiltersProps = {
    search?: string
    status?: SampleStatus | 'all'
    fromDate?: string
    toDate?: string
}

const statusOptions: Array<{ value: SampleStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Tất cả' },
    { value: 'received', label: 'Đã nhận' },
    { value: 'assigned', label: 'Đã giao' },
    { value: 'in_progress', label: 'Đang thực hiện' },
    { value: 'review', label: 'Chờ duyệt' },
    { value: 'completed', label: 'Hoàn thành' },
]

export function SampleFilters({
    search = '',
    status = 'all',
    fromDate = '',
    toDate = '',
}: SampleFiltersProps) {
    const [searchValue, setSearchValue] = useState(search)
    const [statusValue, setStatusValue] = useState<SampleStatus | 'all'>(status)
    const [fromDateValue, setFromDateValue] = useState(fromDate)
    const [toDateValue, setToDateValue] = useState(toDate)

    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const searchParamsString = useMemo(() => searchParams.toString(), [searchParams])

    // Keep inputs in sync with URL changes (e.g., back/forward nav)
    useEffect(() => {
        setSearchValue(search)
    }, [search])

    useEffect(() => {
        setStatusValue(status)
    }, [status])

    useEffect(() => {
        setFromDateValue(fromDate)
    }, [fromDate])

    useEffect(() => {
        setToDateValue(toDate)
    }, [toDate])

    // Debounce search updates (250ms) and push to URL for server rendering
    useEffect(() => {
        const timer = setTimeout(() => {
            const params = new URLSearchParams(searchParamsString)
            const currentSearch = params.get('search') || ''

            // Only update if the search value has actually changed compared to the URL
            if (currentSearch !== searchValue) {
                if (searchValue) {
                    params.set('search', searchValue)
                } else {
                    params.delete('search')
                }
                params.set('page', '1')
                const query = params.toString()
                router.replace(query ? `${pathname}?${query}` : pathname)
            }
        }, 250)

        return () => clearTimeout(timer)
    }, [searchValue, pathname, router, searchParamsString])

    const handleStatusChange = (value: SampleStatus | 'all') => {
        setStatusValue(value)
        const params = new URLSearchParams(searchParamsString)
        if (value === 'all') {
            params.delete('status')
        } else {
            params.set('status', value)
        }
        params.set('page', '1')
        const query = params.toString()
        if (query !== searchParamsString) {
            router.replace(query ? `${pathname}?${query}` : pathname)
        }
    }

    const handleFromDateChange = (value: string) => {
        setFromDateValue(value)
        const params = new URLSearchParams(searchParamsString)
        if (value) {
            params.set('fromDate', value)
        } else {
            params.delete('fromDate')
        }
        params.set('page', '1')
        const query = params.toString()
        if (query !== searchParamsString) {
            router.replace(query ? `${pathname}?${query}` : pathname)
        }
    }

    const handleToDateChange = (value: string) => {
        setToDateValue(value)
        const params = new URLSearchParams(searchParamsString)
        if (value) {
            params.set('toDate', value)
        } else {
            params.delete('toDate')
        }
        params.set('page', '1')
        const query = params.toString()
        if (query !== searchParamsString) {
            router.replace(query ? `${pathname}?${query}` : pathname)
        }
    }

    return (
        <div className="space-y-6">
            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-2">
                {statusOptions.map((option) => {
                    const isSelected = statusValue === option.value
                    return (
                        <button
                            key={option.value}
                            onClick={() => handleStatusChange(option.value)}
                            className={cn(
                                "inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                                isSelected
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            {option.label}
                        </button>
                    )
                })}
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                {/* Search */}
                <div className="relative w-full lg:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Tìm kiếm theo mã mẫu, khách hàng..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="pl-9 bg-background"
                    />
                </div>

                {/* Date Filters */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="flex items-center gap-2 bg-background p-1 rounded-md border">
                        <div className="px-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                        </div>
                        <Input
                            type="date"
                            value={fromDateValue}
                            onChange={(e) => handleFromDateChange(e.target.value)}
                            className="border-0 focus-visible:ring-0 w-auto h-8 p-0"
                        />
                        <span className="text-muted-foreground px-1">-</span>
                        <Input
                            type="date"
                            value={toDateValue}
                            onChange={(e) => handleToDateChange(e.target.value)}
                            className="border-0 focus-visible:ring-0 w-auto h-8 p-0"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

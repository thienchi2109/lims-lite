'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { type SampleStatus } from '@/types'
import { cn } from '@/lib/utils'
import { Search, Calendar, SlidersHorizontal } from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'

type SampleFiltersProps = {
    search?: string
    status?: SampleStatus | 'all'
    fromDate?: string
    toDate?: string
    pageSize?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
}

const statusOptions: Array<{ value: SampleStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Tất cả' },
    { value: 'received', label: 'Đã nhận' },
    { value: 'assigned', label: 'Đã chỉ định' },
    { value: 'in_progress', label: 'Đang thực hiện' },
    { value: 'review', label: 'Chờ duyệt' },
    { value: 'completed', label: 'Hoàn thành' },
]

const sortOptions = [
    { value: 'created_at-desc', label: 'Mới nhất' },
    { value: 'created_at-asc', label: 'Cũ nhất' },
    { value: 'received_at-desc', label: 'Ngày nhận (Mới nhất)' },
    { value: 'received_at-asc', label: 'Ngày nhận (Cũ nhất)' },
]

export function SampleFilters({
    search = '',
    status = 'all',
    fromDate = '',
    toDate = '',
    pageSize = 20,
    sortBy = 'created_at',
    sortOrder = 'desc',
}: SampleFiltersProps) {
    const [searchValue, setSearchValue] = useState(search)
    const [statusValue, setStatusValue] = useState<SampleStatus | 'all'>(status)
    const [fromDateValue, setFromDateValue] = useState(fromDate)
    const [toDateValue, setToDateValue] = useState(toDate)

    const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false)

    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const searchParamsString = useMemo(() => searchParams.toString(), [searchParams])

    // Keep inputs in sync with URL changes
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

    const updateUrl = (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParamsString)
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null) {
                params.delete(key)
            } else {
                params.set(key, value)
            }
        })
        // Always reset to page 1 when filters change
        params.set('page', '1')

        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname)
    }

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            const params = new URLSearchParams(searchParamsString)
            const currentSearch = params.get('search') || ''

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
        updateUrl({ status: value === 'all' ? null : value })
    }

    const handleDateChange = (key: 'fromDate' | 'toDate', value: string) => {
        if (key === 'fromDate') setFromDateValue(value)
        else setToDateValue(value)

        updateUrl({ [key]: value || null })
    }

    const handleSortChange = (value: string) => {
        const [newSortBy, newSortOrder] = value.split('-')
        updateUrl({ sortBy: newSortBy, sortOrder: newSortOrder })
    }

    const handlePageSizeChange = (value: string) => {
        updateUrl({ pageSize: value })
    }

    const isFiltered = statusValue !== 'all' || fromDateValue || toDateValue || searchValue

    const handleReset = () => {
        setSearchValue('')
        setStatusValue('all')
        setFromDateValue('')
        setToDateValue('')
        router.replace(pathname)
    }

    const setDateRange = (range: 'today' | 'yesterday' | 'week' | 'month') => {
        const today = new Date()
        let from = new Date()
        let to = new Date()

        switch (range) {
            case 'today':
                // from and to are already today
                break
            case 'yesterday':
                from.setDate(today.getDate() - 1)
                to.setDate(today.getDate() - 1)
                break
            case 'week':
                from.setDate(today.getDate() - 7)
                break
            case 'month':
                from.setDate(1) // First day of current month
                break
        }

        const fromStr = from.toISOString().split('T')[0]
        const toStr = to.toISOString().split('T')[0]

        setFromDateValue(fromStr)
        setToDateValue(toStr)
        updateUrl({ fromDate: fromStr, toDate: toStr })
        setIsDatePopoverOpen(false)
    }

    const currentSortValue = `${sortBy}-${sortOrder}`

    return (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-white dark:bg-slate-900 p-4 rounded-lg border shadow-sm">
            {/* Left: Search */}
            <div className="relative w-full lg:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Tìm kiếm..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="pl-9 bg-background"
                />
            </div>

            {/* Right: Filters & View Options */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter */}
                <Select value={statusValue} onValueChange={(val) => handleStatusChange(val as SampleStatus | 'all')}>
                    <SelectTrigger className="h-9 w-[160px] border-dashed data-[state=open]:border-solid data-[value=all]:border-dashed">
                        <div className="flex items-center gap-2">
                            <div className={cn("h-2 w-2 rounded-full",
                                statusValue === 'all' ? "bg-slate-400" :
                                    statusValue === 'completed' ? "bg-blue-400" :
                                        statusValue === 'received' ? "bg-yellow-400" :
                                            statusValue === 'assigned' ? "bg-green-400" :
                                                statusValue === 'review' ? "bg-sky-400" :
                                                    "bg-orange-400"
                            )} />
                            <span className="truncate">
                                {statusOptions.find(o => o.value === statusValue)?.label}
                            </span>
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Date Range Popover */}
                <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn(
                            "h-9 border-dashed",
                            (fromDateValue || toDateValue) && "border-solid border-primary text-primary bg-primary/5"
                        )}>
                            <Calendar className="mr-2 h-4 w-4" />
                            {fromDateValue || toDateValue ? 'Đã chọn ngày' : 'Ngày nhận'}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-4" align="end">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <h4 className="font-medium leading-none">Khoảng thời gian</h4>
                                <p className="text-sm text-muted-foreground">
                                    Lọc mẫu theo ngày nhận
                                </p>
                            </div>

                            {/* Quick Date Buttons */}
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" size="sm" onClick={() => setDateRange('today')}>
                                    Hôm nay
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setDateRange('yesterday')}>
                                    Hôm qua
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setDateRange('week')}>
                                    7 ngày qua
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setDateRange('month')}>
                                    Tháng này
                                </Button>
                            </div>

                            <div className="grid gap-2 pt-2 border-t">
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <label htmlFor="from" className="text-sm">Từ ngày</label>
                                    <Input
                                        id="from"
                                        type="date"
                                        value={fromDateValue}
                                        onChange={(e) => handleDateChange('fromDate', e.target.value)}
                                        className="col-span-2 h-8"
                                    />
                                </div>
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <label htmlFor="to" className="text-sm">Đến ngày</label>
                                    <Input
                                        id="to"
                                        type="date"
                                        value={toDateValue}
                                        onChange={(e) => handleDateChange('toDate', e.target.value)}
                                        className="col-span-2 h-8"
                                    />
                                </div>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                <div className="h-4 w-[1px] bg-border mx-1" />

                {/* Sort */}
                <Select value={currentSortValue} onValueChange={handleSortChange}>
                    <SelectTrigger className="h-9 w-[160px] border-dashed data-[state=open]:border-solid">
                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Sắp xếp" />
                    </SelectTrigger>
                    <SelectContent>
                        {sortOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Page Size */}
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                    <SelectTrigger className="h-9 w-[110px] border-dashed data-[state=open]:border-solid">
                        <SelectValue placeholder="Hiển thị" />
                    </SelectTrigger>
                    <SelectContent>
                        {[10, 20, 50, 100].map((size) => (
                            <SelectItem key={size} value={String(size)}>
                                {size} dòng
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Reset Button */}
                {isFiltered && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        className="h-9 px-2 lg:px-3 text-muted-foreground hover:text-foreground"
                    >
                        Xóa lọc
                    </Button>
                )}
            </div>
        </div>
    )
}

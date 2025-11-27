'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type SampleStatus } from '@/types'

type SampleFiltersProps = {
    search?: string
    status?: SampleStatus | 'all'
    fromDate?: string
    toDate?: string
}

const statusOptions: Array<{ value: SampleStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Tất cả trạng thái' },
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
            if (searchValue) {
                params.set('search', searchValue)
            } else {
                params.delete('search')
            }
            params.set('page', '1')
            const query = params.toString()
            if (query !== searchParamsString) {
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
        <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                    <Input
                        placeholder="Tìm kiếm theo mã mẫu hoặc tên khách hàng..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                    />
                </div>
                <Select
                    value={statusValue}
                    onValueChange={(value) => handleStatusChange(value as SampleStatus | 'all')}
                >
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Lọc theo trạng thái" />
                    </SelectTrigger>
                    <SelectContent>
                        {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium whitespace-nowrap">Từ ngày:</label>
                        <Input
                            type="date"
                            value={fromDateValue}
                            onChange={(e) => handleFromDateChange(e.target.value)}
                            className="flex-1"
                        />
                    </div>
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium whitespace-nowrap">Đến ngày:</label>
                        <Input
                            type="date"
                            value={toDateValue}
                            onChange={(e) => handleToDateChange(e.target.value)}
                            className="flex-1"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

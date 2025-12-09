'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { type SampleStatus } from '@/types'
import { cn } from '@/lib/utils'
import { Search, Calendar, SlidersHorizontal, X, Filter, QrCode } from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { QRScanner } from '@/components/qr-scanner'

type SampleFiltersProps = {
    search?: string
    status?: SampleStatus | 'all'
    fromDate?: string
    toDate?: string
    pageSize?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    receiverId?: string
    receiverOptions?: Array<{ id: string; name: string }>
}

const statusOptions: Array<{ value: SampleStatus | 'all'; label: string; color: string }> = [
    { value: 'all', label: 'Tất cả trạng thái', color: 'bg-slate-500' },
    { value: 'received', label: 'Đã nhận', color: 'bg-yellow-500' },
    { value: 'assigned', label: 'Đã chỉ định', color: 'bg-blue-500' },
    { value: 'in_progress', label: 'Đang thực hiện', color: 'bg-indigo-500' },
    { value: 'review', label: 'Chờ duyệt', color: 'bg-purple-500' },
    { value: 'completed', label: 'Hoàn thành', color: 'bg-green-500' },
    { value: 'discarded', label: 'Loại bỏ', color: 'bg-red-500' },
]

const sortOptions = [
    { value: 'created_at-desc', label: 'Mới nhất' },
    { value: 'created_at-asc', label: 'Cũ nhất' },
    { value: 'updated_at-desc', label: 'Mới cập nhật' },
    { value: 'updated_at-asc', label: 'Cập nhật cũ' },
    { value: 'received_at-desc', label: 'Ngày nhận (Mới)' },
    { value: 'received_at-asc', label: 'Ngày nhận (Cũ)' },
]

export function SampleFilters({
    search = '',
    status = 'all',
    fromDate = '',
    toDate = '',
    pageSize = 20,
    sortBy = 'updated_at',
    sortOrder = 'desc',
    receiverId = '',
    receiverOptions = [],
}: SampleFiltersProps) {
    const [searchValue, setSearchValue] = useState(search)
    const [statusValue, setStatusValue] = useState<SampleStatus | 'all'>(status)
    const [fromDateValue, setFromDateValue] = useState(fromDate)
    const [toDateValue, setToDateValue] = useState(toDate)
    const [receiverValue, setReceiverValue] = useState(receiverId || 'all')
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const searchInputRef = useRef<HTMLInputElement | null>(null)

    const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false)

    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const searchParamsString = useMemo(() => searchParams.toString(), [searchParams])

    // Keep inputs in sync with URL changes
    useEffect(() => {
        if (document.activeElement !== searchInputRef.current) {
            setSearchValue(search)
        }
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

    useEffect(() => {
        setReceiverValue(receiverId || 'all')
    }, [receiverId])

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

    const handleReceiverChange = (value: string) => {
        const nextValue = value === 'all' ? '' : value
        setReceiverValue(value)
        updateUrl({ receiverId: nextValue || null })
    }

    const handleQRScan = (decodedText: string) => {
        // Set search value and trigger immediate search
        setSearchValue(decodedText)
        setIsScannerOpen(false)

        // Immediately update URL (bypass debounce for instant results)
        const params = new URLSearchParams(searchParamsString)
        if (decodedText) {
            params.set('search', decodedText)
        } else {
            params.delete('search')
        }
        params.set('page', '1')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname)

        // Focus the search input to show the scanned value
        setTimeout(() => {
            searchInputRef.current?.focus()
        }, 100)
    }

    const isFiltered = statusValue !== 'all' || fromDateValue || toDateValue || searchValue || receiverValue !== 'all'

    const handleReset = () => {
        setSearchValue('')
        setStatusValue('all')
        setFromDateValue('')
        setToDateValue('')
        setReceiverValue('all')
        router.replace(pathname)
    }

    const setDateRange = (range: 'today' | 'yesterday' | 'week' | 'month') => {
        const today = new Date()
        let from = new Date()
        let to = new Date()

        switch (range) {
            case 'today':
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
        <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                {/* Search Bar - Prominent & Clean with QR Scanner */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
                    <Input
                        ref={searchInputRef}
                        placeholder="Tìm kiếm theo mã mẫu, khách hàng..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="pl-9 pr-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm h-10 focus-visible:ring-1 focus-visible:ring-sky-500/20 transition-all rounded-md"
                    />
                    {/* QR Scanner Button - Touch Friendly */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setIsScannerOpen(true)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:text-sky-400 dark:hover:bg-sky-900/20 transition-colors duration-200 rounded-md"
                        aria-label="Quét mã QR để tìm kiếm"
                        title="Quét mã QR"
                    >
                        <QrCode className="h-4 w-4" />
                    </Button>
                </div>

                {/* Filters Group */}
                <div className="flex flex-wrap items-center gap-2 flex-1 lg:justify-end">
                    {/* Status Filter */}
                    <Select value={statusValue} onValueChange={(val) => handleStatusChange(val as SampleStatus | 'all')}>
                        <SelectTrigger className={cn(
                            "h-9 min-w-[140px] border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors rounded-md",
                            statusValue !== 'all' && "border-sky-500/50 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400"
                        )}>
                            <div className="flex items-center gap-2">
                                {statusValue !== 'all' && (
                                    <div className={cn("h-1.5 w-1.5 rounded-full",
                                        statusOptions.find(o => o.value === statusValue)?.color
                                    )} />
                                )}
                                <span className="truncate text-sm">
                                    {statusOptions.find(o => o.value === statusValue)?.label}
                                </span>
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            {statusOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    <div className="flex items-center gap-2">
                                        <div className={cn("h-2 w-2 rounded-full", option.color)} />
                                        {option.label}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Receiver Filter */}
                    <Select value={receiverValue} onValueChange={handleReceiverChange}>
                        <SelectTrigger className={cn(
                            "h-9 min-w-[140px] border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-md",
                            receiverValue !== 'all' && "border-sky-500/50 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400"
                        )}>
                            <SelectValue placeholder="Người nhận" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tất cả người nhận</SelectItem>
                            {receiverOptions.map((receiver) => (
                                <SelectItem key={receiver.id} value={receiver.id}>
                                    {receiver.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Date Filter */}
                    <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                    "h-9 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm font-normal rounded-md",
                                    (fromDateValue || toDateValue) && "border-sky-500/50 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400"
                                )}
                            >
                                <Calendar className="mr-2 h-3.5 w-3.5" />
                                {fromDateValue || toDateValue ? 'Đã chọn ngày' : 'Ngày nhận'}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4" align="end">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <h4 className="font-medium text-sm">Khoảng thời gian</h4>
                                    <p className="text-xs text-muted-foreground">
                                        Lọc mẫu theo ngày nhận
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setDateRange('today')} className="text-xs h-8">
                                        Hôm nay
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setDateRange('yesterday')} className="text-xs h-8">
                                        Hôm qua
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setDateRange('week')} className="text-xs h-8">
                                        7 ngày qua
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setDateRange('month')} className="text-xs h-8">
                                        Tháng này
                                    </Button>
                                </div>
                                <Separator />
                                <div className="grid gap-3">
                                    <div className="grid grid-cols-3 items-center gap-2">
                                        <label htmlFor="from" className="text-xs font-medium">Từ ngày</label>
                                        <Input
                                            id="from"
                                            type="date"
                                            value={fromDateValue}
                                            onChange={(e) => handleDateChange('fromDate', e.target.value)}
                                            className="col-span-2 h-8 text-xs"
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 items-center gap-2">
                                        <label htmlFor="to" className="text-xs font-medium">Đến ngày</label>
                                        <Input
                                            id="to"
                                            type="date"
                                            value={toDateValue}
                                            onChange={(e) => handleDateChange('toDate', e.target.value)}
                                            className="col-span-2 h-8 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 hidden lg:block" />

                    {/* View Options */}
                    <div className="flex items-center gap-2">
                        <Select value={currentSortValue} onValueChange={handleSortChange}>
                            <SelectTrigger className="h-9 w-[130px] border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-xs rounded-md">
                                <SlidersHorizontal className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                <SelectValue placeholder="Sắp xếp" />
                            </SelectTrigger>
                            <SelectContent>
                                {sortOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value} className="text-xs">
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                            <SelectTrigger className="h-9 w-[70px] border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-xs rounded-md">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {[10, 20, 50, 100].map((size) => (
                                    <SelectItem key={size} value={String(size)} className="text-xs">
                                        {size}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Reset Button */}
                    {isFiltered && (
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={handleReset}
                            className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors rounded-md"
                            title="Xóa bộ lọc"
                            aria-label="Xóa tất cả bộ lọc"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* QR Scanner Dialog - Mobile Optimized */}
            <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
                <DialogContent className="sm:max-w-md max-w-[calc(100%-2rem)] p-0 gap-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 space-y-2">
                        <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                            Quét mã QR mẫu
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-600 dark:text-slate-400">
                            Hướng camera vào mã QR trên nhãn mẫu để tự động tìm kiếm
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-6 pt-0">
                        <QRScanner
                            onScan={handleQRScan}
                            onError={(error) => {
                                console.error('QR Scanner error:', error)
                            }}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

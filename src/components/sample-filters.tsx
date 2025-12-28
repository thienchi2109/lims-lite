'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { type SampleStatus, type LabSpecialty } from '@/types'
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
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { QRScanner } from '@/components/qr-scanner'
import { Label } from '@/components/ui/label'

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
    specialties?: LabSpecialty[]
    specialtyIds?: string[]
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
    specialties = [],
    specialtyIds = [],
}: SampleFiltersProps) {
    const [searchValue, setSearchValue] = useState(search)
    const [statusValue, setStatusValue] = useState<SampleStatus | 'all'>(status)
    const [fromDateValue, setFromDateValue] = useState(fromDate)
    const [toDateValue, setToDateValue] = useState(toDate)
    const [receiverValue, setReceiverValue] = useState(receiverId || 'all')
    const [selectedSpecialtyIds, setSelectedSpecialtyIds] = useState<string[]>(specialtyIds)
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const searchInputRef = useRef<HTMLInputElement | null>(null)

    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const popoverContentRef = useRef<HTMLDivElement | null>(null)

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

    useEffect(() => {
        setSelectedSpecialtyIds(specialtyIds)
    }, [specialtyIds])

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

    const toggleSpecialty = (id: string) => {
        const newIds = selectedSpecialtyIds.includes(id)
            ? selectedSpecialtyIds.filter(sid => sid !== id)
            : [...selectedSpecialtyIds, id]

        setSelectedSpecialtyIds(newIds)
        updateUrl({ specialtyIds: newIds.length > 0 ? newIds.join(',') : null })
    }

    const handleQRScan = (decodedText: string) => {
        setSearchValue(decodedText)
        setIsScannerOpen(false)

        const params = new URLSearchParams(searchParamsString)
        if (decodedText) {
            params.set('search', decodedText)
        } else {
            params.delete('search')
        }
        params.set('page', '1')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname)

        setTimeout(() => {
            searchInputRef.current?.focus()
        }, 100)
    }

    const activeFiltersCount = [
        statusValue !== 'all',
        receiverValue !== 'all' && receiverValue !== '',
        fromDateValue,
        toDateValue,
        selectedSpecialtyIds.length > 0
    ].filter(Boolean).length

    const handleReset = () => {
        setSearchValue('')
        setStatusValue('all')
        setFromDateValue('')
        setToDateValue('')
        setReceiverValue('all')
        setSelectedSpecialtyIds([])
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
    }

    const currentSortValue = `${sortBy}-${sortOrder}`
    const sortedSpecialties = [...specialties].sort((a, b) => a.display_order - b.display_order)

    return (
        <div className="flex flex-col gap-3 w-full">
            {/* Top Toolbar Row */}
            <div className="flex flex-col lg:flex-row gap-3 w-full">
                {/* Search Bar - Main Focus */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
                    <Input
                        ref={searchInputRef}
                        placeholder="Tìm kiếm mẫu, khách hàng, mã..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="pl-9 pr-12 h-10 w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm focus-visible:ring-1 focus-visible:ring-sky-500/20"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setIsScannerOpen(true)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:text-sky-400 dark:hover:bg-sky-900/20 rounded-md"
                        title="Quét mã QR"
                    >
                        <QrCode className="h-4 w-4" />
                    </Button>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Filter Button with Popover */}
                    <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant={activeFiltersCount > 0 ? "secondary" : "outline"}
                                className={cn(
                                    "h-10 gap-2 font-normal",
                                    activeFiltersCount > 0 && "bg-sky-100/50 text-sky-700 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-400"
                                )}
                            >
                                <Filter className="h-4 w-4" />
                                <span>Bộ lọc</span>
                                {activeFiltersCount > 0 && (
                                    <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-sky-200 dark:bg-sky-800 text-sky-800 dark:text-sky-200 text-[10px]">
                                        {activeFiltersCount}
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[340px] p-0" align="end" ref={popoverContentRef}>
                            <div className="flex flex-col h-[85vh] sm:h-auto overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                                    <h4 className="font-semibold text-sm">Bộ lọc nâng cao</h4>
                                    {activeFiltersCount > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleReset}
                                            className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive"
                                        >
                                            Xóa tất cả
                                        </Button>
                                    )}
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {/* Specialty Filter - Prominently Displayed */}
                                    {specialties.length > 0 && (
                                        <div className="space-y-2">
                                            <Label className="text-xs font-medium text-slate-500">Nhóm kỹ thuật</Label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {sortedSpecialties.map((specialty) => {
                                                    const isSelected = selectedSpecialtyIds.includes(specialty.id)
                                                    return (
                                                        <Tooltip key={specialty.id}>
                                                            <TooltipTrigger asChild>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleSpecialty(specialty.id)}
                                                                    className={cn(
                                                                        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                                                                        isSelected
                                                                            ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                                                                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                                                                    )}
                                                                >
                                                                    {specialty.code}
                                                                </button>
                                                            </TooltipTrigger>
                                                            <TooltipContent container={popoverContentRef.current}>
                                                                <p>{specialty.name}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="h-[1px] bg-slate-100 dark:bg-slate-800" />

                                    {/* Status Filter */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-500">Trạng thái</Label>
                                        <Select value={statusValue} onValueChange={(val) => handleStatusChange(val as SampleStatus | 'all')}>
                                            <SelectTrigger className="w-full h-9 text-sm">
                                                <SelectValue />
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
                                    </div>

                                    {/* Receiver Filter */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-500">Người nhận</Label>
                                        <Select value={receiverValue} onValueChange={handleReceiverChange}>
                                            <SelectTrigger className="w-full h-9 text-sm">
                                                <SelectValue placeholder="Chọn người nhận" />
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
                                    </div>

                                    {/* Date Filter */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-slate-500">Ngày nhận mẫu</Label>
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <Button variant="outline" size="sm" onClick={() => setDateRange('today')} className="text-xs h-7">Hôm nay</Button>
                                            <Button variant="outline" size="sm" onClick={() => setDateRange('week')} className="text-xs h-7">Tuần này</Button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <span className="text-[10px] text-muted-foreground">Từ ngày</span>
                                                <Input
                                                    type="date"
                                                    value={fromDateValue}
                                                    onChange={(e) => handleDateChange('fromDate', e.target.value)}
                                                    className="h-8 text-xs"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[10px] text-muted-foreground">Đến ngày</span>
                                                <Input
                                                    type="date"
                                                    value={toDateValue}
                                                    onChange={(e) => handleDateChange('toDate', e.target.value)}
                                                    className="h-8 text-xs"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

                    {/* Sort */}
                    <Select value={currentSortValue} onValueChange={handleSortChange}>
                        <SelectTrigger className="h-10 w-[140px] text-sm hidden sm:flex">
                            <SlidersHorizontal className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                            <SelectValue placeholder="Sắp xếp" />
                        </SelectTrigger>
                        <SelectContent side="bottom" align="end">
                            {sortOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Page Size */}
                    <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                        <SelectTrigger className="h-10 w-[70px] text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent side="bottom" align="end">
                            {[10, 20, 50, 100].map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Active Filters Row */}
            {activeFiltersCount > 0 && (
                <div className="flex flex-wrap gap-2 items-center pt-1">
                    <span className="text-xs font-medium text-slate-500 mr-1">Đang lọc:</span>

                    {/* Specialty Badges - NEW */}
                    {selectedSpecialtyIds.map(id => {
                        const specialty = specialties.find(s => s.id === id)
                        if (!specialty) return null
                        return (
                            <TooltipProvider key={id}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="cursor-help inline-flex">
                                            <Badge variant="outline" className="h-7 gap-1 bg-white dark:bg-slate-900 border-dashed border-sky-400 dark:border-sky-800 pl-2 pr-1">
                                                <span className="font-normal text-muted-foreground">Nhóm:</span>
                                                <span className="font-medium text-sky-700 dark:text-sky-400">{specialty.code}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={(e) => {
                                                        toggleSpecialty(id)
                                                    }}
                                                    className="h-4 w-4 ml-1 hover:bg-transparent text-muted-foreground hover:text-foreground"
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </Badge>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{specialty.name}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )
                    })}

                    {/* Status Badge */}
                    {statusValue !== 'all' && (
                        <Badge variant="outline" className="h-7 gap-1 bg-white dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-700 pl-2 pr-1">
                            <span className="font-normal text-muted-foreground">Trạng thái:</span>
                            <span className="font-medium text-foreground">
                                {statusOptions.find(o => o.value === statusValue)?.label}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleStatusChange('all')}
                                className="h-4 w-4 ml-1 hover:bg-transparent text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    )}

                    {/* Receiver Badge */}
                    {receiverValue !== 'all' && receiverValue !== '' && (
                        <Badge variant="outline" className="h-7 gap-1 bg-white dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-700 pl-2 pr-1">
                            <span className="font-normal text-muted-foreground">Người nhận:</span>
                            <span className="font-medium text-foreground">
                                {receiverOptions.find(r => r.id === receiverValue)?.name || 'Unknown'}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleReceiverChange('all')}
                                className="h-4 w-4 ml-1 hover:bg-transparent text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    )}

                    {/* Date Badge */}
                    {(fromDateValue || toDateValue) && (
                        <Badge variant="outline" className="h-7 gap-1 bg-white dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-700 pl-2 pr-1">
                            <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
                            <span className="font-medium text-foreground">
                                {fromDateValue ? new Date(fromDateValue).toLocaleDateString('vi-VN') : '...'} - {toDateValue ? new Date(toDateValue).toLocaleDateString('vi-VN') : '...'}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                    setFromDateValue('')
                                    setToDateValue('')
                                    updateUrl({ fromDate: null, toDate: null })
                                }}
                                className="h-4 w-4 ml-1 hover:bg-transparent text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    )}

                    {/* Clear All Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        className="h-7 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 px-2"
                    >
                        Xóa tất cả
                    </Button>
                </div>
            )}

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

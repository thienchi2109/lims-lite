'use client'

import { useRef, useState } from 'react'
import { Search, SlidersHorizontal, QrCode } from 'lucide-react'
import { type LabSpecialty } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { QRScanner } from '@/components/qr-scanner'
import { useFilterParams } from './use-filter-params'
import { FilterPopover } from './FilterPopover'
import { ActiveFilterBadges } from './ActiveFilterBadges'
import { sortOptions, pageSizeOptions } from './constants'

const EMPTY_SPECIALTIES: LabSpecialty[] = []
const EMPTY_RECEIVERS: Array<{ id: string; name: string }> = []

type SampleFiltersProps = {
    specialties?: LabSpecialty[]
    receiverOptions?: Array<{ id: string; name: string }>
    completedOnly?: boolean
}

export function SampleFilters({
    specialties = EMPTY_SPECIALTIES,
    receiverOptions = EMPTY_RECEIVERS,
    completedOnly = false,
}: SampleFiltersProps) {
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const searchInputRef = useRef<HTMLInputElement | null>(null)

    const { filters, handlers, sort, activeFiltersCount } = useFilterParams()

    const handleQRScan = (decodedText: string) => {
        handlers.setSearch(decodedText)
        setIsScannerOpen(false)
        setTimeout(() => searchInputRef.current?.focus(), 100)
    }

    return (
        <div className="flex flex-col gap-3 w-full">
            {/* Top Toolbar Row */}
            <div className="flex flex-col lg:flex-row gap-3 w-full">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
                    <Input
                        ref={searchInputRef}
                        data-search-input="true"
                        placeholder={completedOnly ? 'Tìm kiếm mẫu đã hoàn thành...' : 'Tìm kiếm mẫu, khách hàng, mã...'}
                        value={filters.search}
                        onChange={(e) => handlers.setSearch(e.target.value)}
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
                    {completedOnly ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                            Chỉ mẫu đã hoàn thành
                        </div>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant={filters.scope === 'all' ? 'secondary' : 'outline'}
                                onClick={() => handlers.setScope(filters.scope === 'all' ? 'active' : 'all')}
                                className="h-10 gap-2 font-normal"
                                aria-pressed={filters.scope === 'all'}
                            >
                                <span>Hiển thị tất cả</span>
                            </Button>

                            <FilterPopover
                                isOpen={isFilterOpen}
                                onOpenChange={setIsFilterOpen}
                                specialties={specialties}
                                receiverOptions={receiverOptions}
                                selectedSpecialtyIds={filters.selectedSpecialtyIds}
                                status={filters.status}
                                receiverId={filters.receiverId}
                                fromDate={filters.fromDate}
                                toDate={filters.toDate}
                                onToggleSpecialty={handlers.toggleSpecialty}
                                onStatusChange={handlers.setStatus}
                                onReceiverChange={handlers.setReceiver}
                                onFromDateChange={handlers.setFromDate}
                                onToDateChange={handlers.setToDate}
                                onDateRangePreset={handlers.setDateRange}
                                onReset={handlers.resetFilters}
                                activeFiltersCount={activeFiltersCount}
                            />
                        </>
                    )}

                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

                    {/* Sort */}
                    <Select value={sort.currentSortValue} onValueChange={sort.setSortValue}>
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
                    <Select value={String(sort.pageSize)} onValueChange={sort.setPageSize}>
                        <SelectTrigger className="h-10 w-[70px] text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent side="bottom" align="end">
                            {pageSizeOptions.map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Active Filters Row */}
            {!completedOnly && (
                <ActiveFilterBadges
                    specialties={specialties}
                    selectedSpecialtyIds={filters.selectedSpecialtyIds}
                    scope={filters.scope}
                    status={filters.status}
                    receiverId={filters.receiverId}
                    receiverOptions={receiverOptions}
                    fromDate={filters.fromDate}
                    toDate={filters.toDate}
                    onRemoveSpecialty={handlers.toggleSpecialty}
                    onClearStatus={() => handlers.setStatus('all')}
                    onClearReceiver={() => handlers.setReceiver('all')}
                    onClearDates={handlers.clearDates}
                    onResetAll={handlers.resetFilters}
                />
            )}

            {/* QR Scanner Dialog */}
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
                            onError={(error) => console.error('QR Scanner error:', error)}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

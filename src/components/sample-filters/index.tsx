'use client'

import { useRef, useState } from 'react'
import { Search, SlidersHorizontal, QrCode, ShieldAlert } from 'lucide-react'
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
import { PendingStatePill } from '@/components/pending-state-pill'
import { useFilterParams } from './use-filter-params'
import { FilterPopover } from './FilterPopover'
import { ActiveFilterBadges } from './ActiveFilterBadges'
import { sortOptions, pageSizeOptions } from './constants'
import type { PendingQueryAction } from '@/components/sample-grid/hooks/usePendingQueryNavigation'

const EMPTY_SPECIALTIES: LabSpecialty[] = []
const EMPTY_RECEIVERS: Array<{ id: string; name: string }> = []

type SampleFiltersProps = {
    specialties?: LabSpecialty[]
    receiverOptions?: Array<{ id: string; name: string }>
    completedOnly?: boolean
    canAccessConfidential?: boolean
    updateQuery?: (
        updates: Record<string, string | null>,
        action: PendingQueryAction,
    ) => void
    isPending?: boolean
}

export function SampleFilters({
    specialties = EMPTY_SPECIALTIES,
    receiverOptions = EMPTY_RECEIVERS,
    completedOnly = false,
    canAccessConfidential = false,
    updateQuery,
    isPending = false,
}: SampleFiltersProps) {
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const searchInputRef = useRef<HTMLInputElement | null>(null)

    const {
        filters,
        handlers,
        sort,
        activeFiltersCount,
        isPending: isRefreshing,
    } = useFilterParams({ updateQuery, isPending })

    const handleQRScan = (decodedText: string) => {
        handlers.setSearch(decodedText)
        setIsScannerOpen(false)
        setTimeout(() => searchInputRef.current?.focus(), 100)
    }

    const visibleActiveFiltersCount =
        !canAccessConfidential && filters.confidentialOnly
            ? Math.max(activeFiltersCount - 1, 0)
            : activeFiltersCount

    return (
        <div className="flex w-full flex-col gap-2">
            <div
                data-testid="sample-filters-controls-toolbar"
                className="flex w-full flex-wrap items-center justify-start gap-2 rounded-2xl border border-slate-200 bg-slate-50/85 p-2 shadow-sm shadow-slate-200/60"
            >
                <div
                    data-testid="sample-filters-search-shell"
                    className="relative flex h-10 min-w-0 flex-1 basis-full items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-slate-950/5 transition-all duration-200 focus-within:border-sky-300 focus-within:shadow-sky-100/80 focus-within:ring-sky-100 sm:basis-72 md:max-w-md"
                >
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
                    <Input
                        ref={searchInputRef}
                        data-search-input="true"
                        placeholder={completedOnly ? 'Tìm kiếm mẫu đã hoàn thành...' : 'Tìm kiếm mẫu, khách hàng, mã...'}
                        value={filters.search}
                        onChange={(e) => handlers.setSearch(e.target.value)}
                        disabled={isRefreshing}
                        className="h-10 w-full border-0 bg-transparent pl-11 pr-12 text-sm font-medium text-slate-700 placeholder:text-slate-400 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setIsScannerOpen(true)}
                        disabled={isRefreshing}
                        className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-xl text-slate-500 transition-colors hover:bg-sky-50 hover:text-sky-600"
                        title="Quét mã QR"
                    >
                        <QrCode className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {completedOnly ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-2.5 text-sm font-medium text-emerald-700 shadow-sm shadow-emerald-100/70">
                            Chỉ mẫu đã hoàn thành
                        </div>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant={filters.scope === 'all' ? 'secondary' : 'outline'}
                                onClick={() => handlers.setScope(filters.scope === 'all' ? 'active' : 'all')}
                                disabled={isRefreshing}
                                className="h-10 rounded-xl border-slate-200 bg-white px-4 font-medium text-slate-700 shadow-none hover:bg-slate-100"
                                aria-pressed={filters.scope === 'all'}
                            >
                                <span>Hiển thị tất cả</span>
                            </Button>

                            {canAccessConfidential && (
                                <Button
                                    type="button"
                                    variant={filters.confidentialOnly ? 'secondary' : 'outline'}
                                    onClick={() => handlers.setConfidentialOnly(!filters.confidentialOnly)}
                                    disabled={isRefreshing}
                                    className="h-10 rounded-xl border-slate-200 bg-white px-4 font-medium text-slate-700 shadow-none hover:bg-slate-100"
                                    aria-pressed={filters.confidentialOnly}
                                >
                                    <ShieldAlert className="mr-2 h-4 w-4" aria-hidden="true" />
                                    <span>Mẫu nhạy cảm</span>
                                </Button>
                            )}

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
                                activeFiltersCount={visibleActiveFiltersCount}
                                disabled={isRefreshing}
                            />
                        </>
                    )}
                </div>

                {isRefreshing && <PendingStatePill label="Đang cập nhật danh sách..." />}

                <div data-testid="sample-filters-sort-group" className="flex shrink-0 flex-wrap items-center gap-2">
                    <Select value={sort.currentSortValue} onValueChange={sort.setSortValue} disabled={isRefreshing}>
                        <SelectTrigger
                            data-testid="sample-filters-sort-trigger"
                            className="hidden h-10 min-w-[13rem] justify-between rounded-xl border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-none sm:flex"
                            disabled={isRefreshing}
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                                <span className="truncate">Sắp xếp</span>
                            </div>
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

                    <Select value={String(sort.pageSize)} onValueChange={sort.setPageSize} disabled={isRefreshing}>
                        <SelectTrigger className="h-10 min-w-[5.5rem] rounded-xl border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-none" disabled={isRefreshing}>
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
                    status={filters.status}
                    rejectedOnly={filters.rejectedOnly}
                    confidentialOnly={canAccessConfidential && filters.confidentialOnly}
                    receiverId={filters.receiverId}
                    receiverOptions={receiverOptions}
                    fromDate={filters.fromDate}
                    toDate={filters.toDate}
                    onRemoveSpecialty={handlers.toggleSpecialty}
                    onClearStatus={() => handlers.setStatus('all')}
                    onClearRejectedOnly={() => handlers.setRejectedOnly(false)}
                    onClearConfidentialOnly={() => handlers.setConfidentialOnly(false)}
                    onClearReceiver={() => handlers.setReceiver('all')}
                    onClearDates={handlers.clearDates}
                    onResetAll={handlers.resetFilters}
                    disabled={isRefreshing}
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

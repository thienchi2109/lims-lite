'use client'

/**
 * AccessionWizardStepTests
 *
 * Wizard Step 2: Test selection using the existing accordion test list.
 * Wraps AccessionMobileTestList with search bar, filter pills,
 * selected tests chip strip, and navigation bottom bar.
 */

import { cn } from '@/lib/utils'
import { AccessionMobileTestList } from '@/components/accession-mobile-test-list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, ArrowLeft, ArrowRight, X } from 'lucide-react'
import type { AssayDefinitionWithMethods, SelectedTest } from '@/types'
import type { GridRow } from '@/types/test-assignment'

interface StepTestsProps {
    searchQuery: string
    setSearchQuery: (q: string) => void
    selectedSpecialtyId: string
    setSelectedSpecialtyId: (id: string) => void
    specialties: Array<{ id: string; name: string; code: string }>
    groupedRows: GridRow[]
    isLoading: boolean
    disabledSet: Set<string>
    specialtiesMap: Map<string, { id: string; name: string; code: string }>
    selected: SelectedTest[]
    onChange: (tests: SelectedTest[]) => void
    toggleTestSelection: (assay: AssayDefinitionWithMethods) => void
    handleMethodChange: (assayId: string, methodId: string) => void
    onNext: () => void
    onBack: () => void
}

export function AccessionWizardStepTests({
    searchQuery,
    setSearchQuery,
    selectedSpecialtyId,
    setSelectedSpecialtyId,
    specialties,
    groupedRows,
    isLoading,
    disabledSet,
    specialtiesMap,
    selected,
    onChange,
    toggleTestSelection,
    handleMethodChange,
    onNext,
    onBack,
}: StepTestsProps) {
    const handleRemoveTest = (assayId: string) => {
        onChange(selected.filter((t) => t.assayId !== assayId))
    }

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            {/* Sticky header: Search + Filter */}
            <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-background px-4 py-3">
                {/* Search */}
                <div className="relative w-full">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                        <Search className="size-[18px]" />
                    </span>
                    <input
                        type="text"
                        placeholder="Tìm kiếm chỉ tiêu (ALT, Glucose...)"
                        className="w-full rounded-lg border-border bg-muted/50 py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition-all focus:ring-2 focus:ring-primary"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Filter pills */}
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                    <button
                        type="button"
                        onClick={() => setSelectedSpecialtyId('all')}
                        className={cn(
                            'min-h-[36px] cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200',
                            selectedSpecialtyId === 'all'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-muted text-muted-foreground hover:bg-accent',
                        )}
                    >
                        Tất cả
                    </button>
                    {specialties.map((spec) => (
                        <button
                            type="button"
                            key={spec.id}
                            onClick={() => setSelectedSpecialtyId(spec.id)}
                            className={cn(
                                'min-h-[36px] cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200',
                                selectedSpecialtyId === spec.id
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-muted text-muted-foreground hover:bg-accent',
                            )}
                        >
                            {spec.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable test list */}
            <div
                className={cn(
                    'flex-1 overflow-auto scroll-smooth px-2 pt-2',
                    selected.length > 0 ? 'pb-36' : 'pb-24',
                )}
            >
                <AccessionMobileTestList
                    groupedRows={groupedRows}
                    selected={selected}
                    toggleTestSelection={toggleTestSelection}
                    handleMethodChange={handleMethodChange}
                    disabledSet={disabledSet}
                    specialtiesMap={specialtiesMap}
                    searchQuery={searchQuery}
                    isLoading={isLoading}
                />
            </div>

            {/* Selected tests chip strip */}
            {selected.length > 0 && (
                <div className="absolute inset-x-0 bottom-[60px] z-20 border-t border-border bg-background/95 px-2.5 py-1.5 backdrop-blur-sm">
                    <div className="no-scrollbar flex gap-2 overflow-x-auto">
                        {selected.map((test) => (
                            <Badge
                                key={test.assayId}
                                variant="secondary"
                                className="shrink-0 gap-1 whitespace-nowrap text-[11px]"
                            >
                                {test.assayName}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveTest(test.assayId)}
                                    className="ml-0.5 cursor-pointer rounded-full p-0.5 transition-colors hover:bg-muted"
                                    aria-label={`Xóa ${test.assayName}`}
                                >
                                    <X className="size-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Bottom bar */}
            <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-border bg-background/80 px-4 py-3 backdrop-blur-md">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    className="min-h-11 flex-1 gap-1"
                >
                    <ArrowLeft className="size-4" />
                    Quay lại
                </Button>
                <div className="flex flex-col items-center">
                    <span className="text-sm font-bold text-foreground">
                        {selected.length}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        đã chọn
                    </span>
                </div>
                <Button
                    type="button"
                    onClick={onNext}
                    className="min-h-11 flex-[1.5] gap-1"
                >
                    Tiếp theo
                    <ArrowRight className="size-4" />
                </Button>
            </div>
        </div>
    )
}

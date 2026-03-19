import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseFilterParams = vi.fn()

vi.mock('@/components/sample-filters/use-filter-params', () => ({
    useFilterParams: () => mockUseFilterParams(),
}))

vi.mock('@/components/qr-scanner', () => ({
    QRScanner: () => null,
}))

vi.mock('@/components/sample-filters/FilterPopover', () => ({
    FilterPopover: () => <div data-testid="filter-popover" />,
}))

import { SampleFilters } from '../sample-filters'

const defaultHandlers = {
    setSearch: vi.fn(),
    setStatus: vi.fn(),
    setScope: vi.fn(),
    setDateRange: vi.fn(),
    setFromDate: vi.fn(),
    setToDate: vi.fn(),
    setReceiver: vi.fn(),
    toggleSpecialty: vi.fn(),
    resetFilters: vi.fn(),
    clearDates: vi.fn(),
}

describe('SampleFilters scope toolbar', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows the visible Hiển thị tất cả control and the hidden-completed hint when active scope is effective', () => {
        mockUseFilterParams.mockReturnValue({
            filters: {
                search: '',
                scope: 'active',
                status: 'all',
                fromDate: '',
                toDate: '',
                receiverId: '',
                selectedSpecialtyIds: [],
            },
            handlers: defaultHandlers,
            sort: {
                sortBy: 'updated_at',
                sortOrder: 'desc',
                pageSize: 20,
                currentSortValue: 'updated_at-desc',
                setSortValue: vi.fn(),
                setPageSize: vi.fn(),
            },
            activeFiltersCount: 0,
        })

        render(<SampleFilters specialties={[]} receiverOptions={[]} />)

        expect(screen.getByRole('button', { name: 'Hiển thị tất cả' })).toBeDefined()
        expect(screen.getByText('Mặc định ẩn mẫu hoàn thành')).toBeDefined()
    })

    it('keeps the scope control visible while a concrete status filter is selected and hides the active-scope hint', () => {
        mockUseFilterParams.mockReturnValue({
            filters: {
                search: '',
                scope: 'active',
                status: 'completed',
                fromDate: '',
                toDate: '',
                receiverId: '',
                selectedSpecialtyIds: [],
            },
            handlers: defaultHandlers,
            sort: {
                sortBy: 'updated_at',
                sortOrder: 'desc',
                pageSize: 20,
                currentSortValue: 'updated_at-desc',
                setSortValue: vi.fn(),
                setPageSize: vi.fn(),
            },
            activeFiltersCount: 1,
        })

        render(<SampleFilters specialties={[]} receiverOptions={[]} />)

        expect(screen.getByRole('button', { name: 'Hiển thị tất cả' })).toBeDefined()
        expect(screen.queryByText('Mặc định ẩn mẫu hoàn thành')).toBeNull()
    })
})

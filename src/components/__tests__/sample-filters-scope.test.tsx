import { render, screen } from '@testing-library/react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseFilterParams = vi.fn()

vi.mock('@/components/sample-filters/use-filter-params', () => ({
    useFilterParams: () => mockUseFilterParams(),
}))

vi.mock('@/components/scanner/use-scanner', () => ({
    useScannerConsumer: vi.fn(),
}))

vi.mock('@/components/qr-scanner', () => ({
    QRScanner: () => null,
}))

vi.mock('@/components/ui/input', () => ({
    Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/button', () => ({
    Button: ({
        children,
        className,
        ...props
    }: ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button className={className} {...props}>
            {children}
        </button>
    ),
}))

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    DialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    DialogDescription: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/select', () => ({
    Select: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    SelectTrigger: ({
        children,
        className,
        ...props
    }: ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button className={className} {...props}>
            {children}
        </button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder ?? 'value'}</span>,
    SelectContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/sample-filters/FilterPopover', () => ({
    FilterPopover: () => <div data-testid="filter-popover" />,
}))

import { SampleFilters } from '../sample-filters'

const defaultHandlers = {
    commitSearch: vi.fn(),
    setSearch: vi.fn(),
    setStatus: vi.fn(),
    setScope: vi.fn(),
    setDateRange: vi.fn(),
    setConfidentialOnly: vi.fn(),
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

    it('shows the visible Hiển thị tất cả control without the hidden-completed hint when active scope is effective', () => {
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
            isPending: false,
        })

        render(<SampleFilters specialties={[]} receiverOptions={[]} />)

        expect(screen.getByRole('button', { name: 'Hiển thị tất cả' })).toBeDefined()
        expect(screen.queryByText('Mặc định ẩn mẫu hoàn thành')).toBeNull()
        expect(screen.queryByRole('button', { name: 'Xóa tất cả' })).toBeNull()
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
            isPending: false,
        })

        render(<SampleFilters specialties={[]} receiverOptions={[]} />)

        expect(screen.getByRole('button', { name: 'Hiển thị tất cả' })).toBeDefined()
        expect(screen.queryByText('Mặc định ẩn mẫu hoàn thành')).toBeNull()
    })

    it('switches back to the active default when the toolbar toggle is clicked from all scope', () => {
        const setScope = vi.fn()

        mockUseFilterParams.mockReturnValue({
            filters: {
                search: 'ABC',
                scope: 'all',
                status: 'completed',
                fromDate: '2026-01-01',
                toDate: '',
                receiverId: '11111111-1111-4111-8111-111111111111',
                selectedSpecialtyIds: [],
            },
            handlers: {
                ...defaultHandlers,
                setScope,
            },
            sort: {
                sortBy: 'updated_at',
                sortOrder: 'desc',
                pageSize: 20,
                currentSortValue: 'updated_at-desc',
                setSortValue: vi.fn(),
                setPageSize: vi.fn(),
            },
            activeFiltersCount: 3,
            isPending: false,
        })

        render(<SampleFilters specialties={[]} receiverOptions={[]} />)

        screen.getByRole('button', { name: 'Hiển thị tất cả' }).click()

        expect(setScope).toHaveBeenCalledWith('active')
    })

    it('switches to all scope when the toolbar toggle is clicked from the active default', () => {
        const setScope = vi.fn()

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
            handlers: {
                ...defaultHandlers,
                setScope,
            },
            sort: {
                sortBy: 'updated_at',
                sortOrder: 'desc',
                pageSize: 20,
                currentSortValue: 'updated_at-desc',
                setSortValue: vi.fn(),
                setPageSize: vi.fn(),
            },
            activeFiltersCount: 0,
            isPending: false,
        })

        render(<SampleFilters specialties={[]} receiverOptions={[]} />)

        screen.getByRole('button', { name: 'Hiển thị tất cả' }).click()

        expect(setScope).toHaveBeenCalledWith('all')
    })

    it('hides the confidential samples control when the user cannot access confidential samples', () => {
        mockUseFilterParams.mockReturnValue({
            filters: {
                search: '',
                scope: 'active',
                status: 'all',
                confidentialOnly: false,
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
            isPending: false,
        })

        render(<SampleFilters specialties={[]} receiverOptions={[]} />)

        expect(screen.queryByRole('button', { name: 'Mẫu nhạy cảm' })).toBeNull()
    })

    it('shows and toggles the confidential samples control for authorized users', () => {
        const setConfidentialOnly = vi.fn()

        mockUseFilterParams.mockReturnValue({
            filters: {
                search: '',
                scope: 'active',
                status: 'all',
                confidentialOnly: false,
                fromDate: '',
                toDate: '',
                receiverId: '',
                selectedSpecialtyIds: [],
            },
            handlers: {
                ...defaultHandlers,
                setConfidentialOnly,
            },
            sort: {
                sortBy: 'updated_at',
                sortOrder: 'desc',
                pageSize: 20,
                currentSortValue: 'updated_at-desc',
                setSortValue: vi.fn(),
                setPageSize: vi.fn(),
            },
            activeFiltersCount: 0,
            isPending: false,
        })

        render(<SampleFilters specialties={[]} receiverOptions={[]} canAccessConfidential />)

        screen.getByRole('button', { name: 'Mẫu nhạy cảm' }).click()

        expect(setConfidentialOnly).toHaveBeenCalledWith(true)
    })

    it('keeps sample search, filters, sorting, and page size in one left-aligned toolbar', () => {
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
            isPending: false,
        })

        render(<SampleFilters specialties={[]} receiverOptions={[]} />)

        const searchShell = screen.getByTestId('sample-filters-search-shell')
        const controlsToolbar = screen.getByTestId('sample-filters-controls-toolbar')
        const sortGroup = screen.getByTestId('sample-filters-sort-group')
        const sortTrigger = screen.getByTestId('sample-filters-sort-trigger')

        expect(screen.queryByTestId('sample-filters-search-row')).toBeNull()
        expect(controlsToolbar.contains(searchShell)).toBe(true)
        expect(controlsToolbar.className).toContain('justify-start')
        expect(searchShell.className).toContain('min-w-0')
        expect(searchShell.className).toContain('flex-1')
        expect(searchShell.className).not.toContain('max-w-sm')
        expect(controlsToolbar.className).toContain('w-full')
        expect(controlsToolbar.className).toContain('flex-wrap')
        expect(sortGroup.className).not.toContain('ml-auto')
        expect(sortTrigger.className).toContain('min-w-')
        expect(sortTrigger.className).not.toContain('w-[140px]')
    })

    it('shows a pending label and disables the search input while filters are refreshing', () => {
        mockUseFilterParams.mockReturnValue({
            filters: {
                search: 'ABC',
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
            isPending: true,
        })

        render(<SampleFilters specialties={[]} receiverOptions={[]} />)

        expect(screen.getByText('Đang cập nhật danh sách...')).toBeDefined()
        expect(screen.getByPlaceholderText('Tìm kiếm mẫu, khách hàng, mã...')).toHaveProperty('disabled', true)
    })
})

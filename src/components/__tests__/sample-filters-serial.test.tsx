import { act, fireEvent, render, screen } from '@testing-library/react'
import type {
    ButtonHTMLAttributes,
    InputHTMLAttributes,
    ReactNode,
} from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ScannerContext } from '@/components/scanner/use-scanner'
import { createScannerDispatcher } from '@/lib/scanner/scanner-dispatcher'

const filterMocks = vi.hoisted(() => ({
    commitSearch: vi.fn(),
    setSearch: vi.fn(),
    useFilterParams: vi.fn(),
}))

vi.mock('@/components/sample-filters/use-filter-params', () => ({
    useFilterParams: () => filterMocks.useFilterParams(),
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
    Dialog: ({
        children,
        open,
    }: {
        children?: ReactNode
        open?: boolean
    }) => open ? <div role="dialog">{children}</div> : null,
    DialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    DialogDescription: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/select', () => ({
    Select: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    SelectTrigger: ({
        children,
        className,
        ...props
    }: ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button className={className} {...props}>
            {children}
        </button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => (
        <span>{placeholder ?? 'value'}</span>
    ),
    SelectContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/sample-filters/FilterPopover', () => ({
    FilterPopover: () => null,
}))

vi.mock('@/components/sample-filters/ActiveFilterBadges', () => ({
    ActiveFilterBadges: () => null,
}))

vi.mock('@/components/pending-state-pill', () => ({
    PendingStatePill: () => null,
}))

vi.mock('@/components/qr-scanner', () => ({
    QRScanner: ({ onScan }: { onScan: (decodedText: string) => void }) => (
        <button
            type="button"
            onClick={() => onScan('CDC-XN-22072026-0099')}
        >
            Camera scan
        </button>
    ),
}))

import { SampleFilters } from '../sample-filters'

const defaultHandlers = {
    commitSearch: filterMocks.commitSearch,
    setSearch: filterMocks.setSearch,
    setStatus: vi.fn(),
    setScope: vi.fn(),
    setRejectedOnly: vi.fn(),
    setConfidentialOnly: vi.fn(),
    setDateRange: vi.fn(),
    setFromDate: vi.fn(),
    setToDate: vi.fn(),
    setReceiver: vi.fn(),
    toggleSpecialty: vi.fn(),
    resetFilters: vi.fn(),
    clearDates: vi.fn(),
}

describe('SampleFilters serial search', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        filterMocks.useFilterParams.mockReturnValue({
            filters: {
                search: '',
                scope: 'active',
                status: 'all',
                rejectedOnly: false,
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
    })

    it('registers priority 100 for its lifetime and shares commitSearch with camera', () => {
        const dispatcher = createScannerDispatcher()
        const registerConsumer = vi.fn(dispatcher.registerConsumer)
        const { unmount } = render(
            <ScannerContext.Provider
                value={{
                    state: 'connected',
                    error: null,
                    connect: vi.fn(),
                    disconnect: vi.fn(),
                    registerConsumer,
                }}
            >
                <SampleFilters specialties={[]} receiverOptions={[]} />
            </ScannerContext.Provider>,
        )

        expect(registerConsumer).toHaveBeenCalledTimes(1)
        expect(registerConsumer).toHaveBeenCalledWith(
            expect.objectContaining({
                kinds: ['sample-code'],
                priority: 100,
            }),
        )

        act(() => {
            dispatcher.dispatch({
                kind: 'sample-code',
                code: 'CDC-XN-22072026-0001',
            })
            dispatcher.dispatch({ kind: 'unknown' })
            dispatcher.dispatch({
                kind: 'identity-qr',
                identity: {
                    idCardNum: '001234567890',
                    name: 'NGUYEN VAN A',
                    dateOfBirth: '1990-01-01',
                    gender: 'male',
                    address: 'Ha Noi',
                },
            })
        })

        expect(filterMocks.commitSearch).toHaveBeenCalledTimes(1)
        expect(filterMocks.commitSearch).toHaveBeenCalledWith(
            'CDC-XN-22072026-0001',
        )

        fireEvent.click(screen.getByTitle('Quét mã QR'))
        fireEvent.click(screen.getByRole('button', { name: 'Camera scan' }))

        expect(filterMocks.commitSearch).toHaveBeenCalledTimes(2)
        expect(filterMocks.commitSearch).toHaveBeenLastCalledWith(
            'CDC-XN-22072026-0099',
        )
        expect(filterMocks.setSearch).not.toHaveBeenCalled()

        unmount()
        act(() => {
            dispatcher.dispatch({
                kind: 'sample-code',
                code: 'CDC-XN-22072026-0100',
            })
        })
        expect(filterMocks.commitSearch).toHaveBeenCalledTimes(2)
    })
})

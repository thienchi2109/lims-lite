import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

const mockUseSamples = vi.fn()
const mockUseSampleSelectionCore = vi.fn()
const mockUsePendingQueryNavigation = vi.fn()
const mockSampleFilters = vi.fn()
const mockSampleListTable = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('@/hooks/use-samples', () => ({
    useSamples: (...args: unknown[]) => mockUseSamples(...args),
}))

vi.mock('@/hooks/use-sample-selection-core', () => ({
    useSampleSelectionCore: (...args: unknown[]) => mockUseSampleSelectionCore(...args),
}))

vi.mock('@/components/sample-grid/hooks/usePendingQueryNavigation', () => ({
    usePendingQueryNavigation: (...args: unknown[]) => mockUsePendingQueryNavigation(...args),
}))

vi.mock('next/navigation', () => ({
    useSearchParams: () => mockSearchParams,
    usePathname: () => '/manager/samples',
    useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('@/components/sample-filters', () => ({
    SampleFilters: (props: Record<string, unknown>) => {
        mockSampleFilters(props)
        return null
    },
}))

vi.mock('@/components/sample-list-table', () => ({
    SampleListTable: (props: Record<string, unknown>) => {
        mockSampleListTable(props)
        return null
    },
}))

const mockSampleInspectorColumn = vi.fn()
vi.mock('@/components/sample-inspector-column', () => ({
    SampleInspectorColumn: (props: Record<string, unknown>) => {
        mockSampleInspectorColumn(props)
        return null
    },
}))

vi.mock('@/components/sample-bottom-row', () => ({
    SampleBottomRow: () => null,
}))

vi.mock('next/link', () => ({
    default: ({ children }: { children: React.ReactNode }) => children,
}))

import { SamplesPageClient } from '../samples-page-client'

describe('SamplesPageClient scope contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSearchParams = new URLSearchParams()

        mockUseSamples.mockReturnValue({
            data: {
                data: [],
                totalPages: 1,
                count: 0,
                page: 1,
                pageSize: 20,
            },
            isLoading: false,
            error: null,
        })
        mockUseSampleSelectionCore.mockReturnValue({
            data: null,
            isLoading: false,
            isFetching: false,
            error: null,
        })
        mockUsePendingQueryNavigation.mockReturnValue({
            pendingAction: null,
            isPending: false,
            isPagePending: false,
            isFilterPending: false,
            updateQuery: vi.fn(),
        })
    })

    it('passes the default active scope into the samples query contract', () => {
        render(
            <SamplesPageClient
                role="analyst"
                permissions={{
                    canDiscard: false,
                    canEdit: false,
                    canViewResults: false,
                    canEnterResults: false,
                }}
                homeHref="/"
                receiverOptions={[]}
                specialties={[]}
            />,
        )

        expect(mockUseSamples).toHaveBeenCalledWith(
            expect.objectContaining({
                params: expect.objectContaining({
                    scope: 'active',
                    status: undefined,
                    page: 1,
                    pageSize: 20,
                }),
            }),
        )
    })

    it('passes scope=all and an explicit status override through the samples query contract', () => {
        mockSearchParams = new URLSearchParams(
            'scope=all&status=completed&page=3&pageSize=50&sortBy=received_at&sortOrder=asc',
        )

        render(
            <SamplesPageClient
                role="analyst"
                permissions={{
                    canDiscard: false,
                    canEdit: false,
                    canViewResults: false,
                    canEnterResults: false,
                }}
                homeHref="/"
                receiverOptions={[]}
                specialties={[]}
            />,
        )

        expect(mockUseSamples).toHaveBeenCalledWith(
            expect.objectContaining({
                params: expect.objectContaining({
                    scope: 'all',
                    status: 'completed',
                    page: 3,
                    pageSize: 50,
                    sortBy: 'received_at',
                    sortOrder: 'asc',
                }),
            }),
        )
    })

    it('forces doctor sample queries to completed-only regardless of URL scope/status filters', () => {
        mockSearchParams = new URLSearchParams('scope=all&status=review&page=2')

        render(
            <SamplesPageClient
                role="doctor"
                permissions={{
                    canDiscard: false,
                    canEdit: false,
                    canViewResults: false,
                    canEnterResults: false,
                }}
                homeHref="/samples"
                receiverOptions={[]}
                specialties={[]}
            />,
        )

        expect(mockUseSamples).toHaveBeenCalledWith(
            expect.objectContaining({
                params: expect.objectContaining({
                    scope: 'all',
                    status: 'completed',
                    page: 2,
                }),
            }),
        )
        expect(mockSampleInspectorColumn).toHaveBeenCalledWith(
            expect.objectContaining({
                userRole: 'doctor',
            }),
        )
    })

    it('threads shared pending navigation state into filters and the sample grid', () => {
        const updateQuery = vi.fn()

        mockUsePendingQueryNavigation.mockReturnValue({
            pendingAction: 'filter',
            isPending: true,
            isPagePending: false,
            isFilterPending: true,
            updateQuery,
        })

        render(
            <SamplesPageClient
                role="analyst"
                permissions={{
                    canDiscard: false,
                    canEdit: false,
                    canViewResults: false,
                    canEnterResults: false,
                }}
                homeHref="/"
                receiverOptions={[]}
                specialties={[]}
            />,
        )

        expect(mockSampleFilters).toHaveBeenCalledWith(
            expect.objectContaining({
                isPending: true,
                updateQuery,
            }),
        )
        expect(mockSampleListTable).toHaveBeenCalledWith(
            expect.objectContaining({
                pendingAction: 'filter',
                onQueryUpdate: updateQuery,
            }),
        )
    })
})

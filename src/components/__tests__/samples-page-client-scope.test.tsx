import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

const mockUseSamples = vi.fn()
const mockUseSampleDetail = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('@/hooks/use-samples', () => ({
    useSamples: (...args: unknown[]) => mockUseSamples(...args),
}))

vi.mock('@/hooks/use-sample-detail', () => ({
    useSampleDetail: (...args: unknown[]) => mockUseSampleDetail(...args),
}))

vi.mock('next/navigation', () => ({
    useSearchParams: () => mockSearchParams,
}))

vi.mock('@/components/sample-filters', () => ({
    SampleFilters: () => null,
}))

vi.mock('@/components/sample-list-table', () => ({
    SampleListTable: () => null,
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

        mockUseSampleDetail.mockReturnValue({
            data: null,
            isLoading: false,
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
})

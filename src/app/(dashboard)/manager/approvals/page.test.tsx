import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockSingle = vi.fn()
const mockGetSamplesWithTab = vi.fn()
const mockGetSamplesForApprovalCount = vi.fn()
const mockGetSample = vi.fn()
const mockGetResultsBySample = vi.fn()
const mockGetSampleSubmissionReview = vi.fn()
const mockResolveApprovalDeepLink = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => ({
        auth: {
            getUser: mockGetUser,
        },
        from: () => ({
            select: () => ({
                eq: () => ({
                    single: mockSingle,
                }),
            }),
        }),
    }),
}))

vi.mock('next/navigation', () => ({
    redirect: (url: string) => {
        throw new Error(`redirect:${url}`)
    },
}))

vi.mock('@/app/actions/sample-approvals', () => ({
    getSamplesForApprovalCount: (...args: unknown[]) => mockGetSamplesForApprovalCount(...args),
    getSamplesWithTab: (...args: unknown[]) => mockGetSamplesWithTab(...args),
}))

vi.mock('@/app/actions/samples', () => ({
    getSample: (...args: unknown[]) => mockGetSample(...args),
}))

vi.mock('@/app/actions/results', () => ({
    getResultsBySample: (...args: unknown[]) => mockGetResultsBySample(...args),
}))

vi.mock('@/app/actions/submission-reviews', () => ({
    getSampleSubmissionReview: (...args: unknown[]) =>
        mockGetSampleSubmissionReview(...args),
}))

vi.mock('@/components/dashboard-header', () => ({
    DashboardHeader: ({ subtitle }: { subtitle: string }) => (
        <div data-testid="dashboard-header">{subtitle}</div>
    ),
}))

vi.mock('@/components/approval-tabs-client', () => ({
    ApprovalTabsClient: ({
        initialSampleLoadError,
    }: {
        initialSampleLoadError?: string | null
    }) => (
        <div data-testid="approval-tabs-client">
            {initialSampleLoadError}
        </div>
    ),
}))

vi.mock('@/components/approval-mobile-layout', () => ({
    ApprovalMobileLayout: ({
        initialSampleLoadError,
    }: {
        initialSampleLoadError?: string | null
    }) => (
        <div data-testid="approval-mobile-layout">
            {initialSampleLoadError}
        </div>
    ),
}))

vi.mock('@/components/approval-layout-switcher', () => ({
    ApprovalLayoutSwitcher: ({
        desktop,
        mobile,
    }: {
        desktop: React.ReactNode
        mobile: React.ReactNode
    }) => (
        <div data-testid="layout-switcher">
            {desktop}
            {mobile}
        </div>
    ),
}))

vi.mock('@/components/approval-page-header', () => ({
    ApprovalPageHeader: ({ samplesCount, tab }: { samplesCount: number; tab: 'review' | 'completed' }) => (
        <div data-testid="approval-header">{`${samplesCount}-${tab}`}</div>
    ),
}))

vi.mock('@/lib/approval-queue-url', () => ({
    resolveApprovalDeepLink: (...args: unknown[]) => mockResolveApprovalDeepLink(...args),
}))

import ApprovalsPage from './page'

describe('ApprovalsPage', () => {
    beforeEach(() => {
        mockGetUser.mockResolvedValue({
            data: {
                user: { id: 'manager-1' },
            },
        })
        mockSingle.mockResolvedValue({
            data: {
                full_name: 'Quản lý',
                role: 'manager',
            },
        })
        mockGetSamplesWithTab.mockResolvedValue({ error: 'network failed' })
        mockGetSamplesForApprovalCount.mockResolvedValue({ data: 0 })
        mockGetSample.mockResolvedValue({ data: null })
        mockGetResultsBySample.mockResolvedValue({ data: [] })
        mockGetSampleSubmissionReview.mockResolvedValue({ data: { submissions: [] } })
        mockResolveApprovalDeepLink.mockReturnValue({
            selectedSampleId: null,
            redirectUrl: null,
        })
    })

    it('keeps the approval header visible when the queue fetch fails on the server', async () => {
        const page = await ApprovalsPage({
            searchParams: Promise.resolve({ tab: 'review' }),
        })

        render(page)

        expect(
            screen.getAllByTestId('approval-header').every(
                (header) => header.textContent === '0-review',
            ),
        ).toBe(true)
        expect(
            screen.getAllByText('Lỗi khi tải hàng đợi phê duyệt: network failed'),
        ).toHaveLength(2)
    })

    it('surfaces snapshot load failures in both approval layouts', async () => {
        mockGetSamplesWithTab.mockResolvedValue({ data: [] })
        mockResolveApprovalDeepLink.mockReturnValue({
            selectedSampleId: '11111111-1111-4111-8111-111111111111',
            redirectUrl: null,
        })
        mockGetSample.mockResolvedValue({
            data: {
                id: '11111111-1111-4111-8111-111111111111',
                sample_id: 'CDC-XN-0001',
            },
        })
        mockGetSampleSubmissionReview.mockResolvedValue({
            error: 'Không thể tải dữ liệu đánh giá đã gửi',
        })

        const page = await ApprovalsPage({
            searchParams: Promise.resolve({
                tab: 'review',
                sampleId: '11111111-1111-4111-8111-111111111111',
            }),
        })

        render(page)

        expect(
            screen.getAllByText('Không thể tải dữ liệu đánh giá đã gửi'),
        ).toHaveLength(2)
    })
})

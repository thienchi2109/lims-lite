import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockSingle = vi.fn()
const mockGetSamplesWithTab = vi.fn()
const mockGetSamplesForApprovalCount = vi.fn()
const mockGetSample = vi.fn()
const mockGetResultsBySample = vi.fn()

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

vi.mock('@/components/dashboard-header', () => ({
    DashboardHeader: ({ subtitle }: { subtitle: string }) => (
        <div data-testid="dashboard-header">{subtitle}</div>
    ),
}))

vi.mock('@/components/approval-tabs-client', () => ({
    ApprovalTabsClient: () => <div data-testid="approval-tabs-client" />,
}))

vi.mock('@/components/approval-mobile-layout', () => ({
    ApprovalMobileLayout: () => <div data-testid="approval-mobile-layout" />,
}))

vi.mock('@/components/approval-layout-switcher', () => ({
    ApprovalLayoutSwitcher: ({ desktop }: { desktop: React.ReactNode }) => (
        <div data-testid="layout-switcher">{desktop}</div>
    ),
}))

vi.mock('@/components/approval-page-header', () => ({
    ApprovalPageHeader: ({ samplesCount, tab }: { samplesCount: number; tab: 'review' | 'completed' }) => (
        <div data-testid="approval-header">{`${samplesCount}-${tab}`}</div>
    ),
}))

vi.mock('@/lib/approval-queue-url', () => ({
    resolveApprovalDeepLink: vi.fn(() => ({
        selectedSampleId: null,
        redirectUrl: null,
    })),
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
    })

    it('keeps the approval header visible when the queue fetch fails on the server', async () => {
        const page = await ApprovalsPage({
            searchParams: Promise.resolve({ tab: 'review' }),
        })

        render(page)

        expect(screen.getByTestId('approval-header').textContent).toBe('0-review')
        expect(
            screen.getByText('Lỗi khi tải hàng đợi phê duyệt: network failed'),
        ).toBeDefined()
    })
})

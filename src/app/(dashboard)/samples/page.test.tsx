import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetAuthenticatedDashboardSession = vi.fn()
const mockIsDashboardUserRole = vi.fn()
const mockGetSpecialties = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
let capturedSamplesPageClientProps: unknown = null

vi.mock('@/lib/dashboard-session', () => ({
    getAuthenticatedDashboardSession: (...args: unknown[]) => mockGetAuthenticatedDashboardSession(...args),
    isDashboardUserRole: (...args: unknown[]) => mockIsDashboardUserRole(...args),
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => ({
        from: (table: string) => {
            if (table !== 'users') {
                throw new Error(`Unexpected table: ${table}`)
            }

            return {
                select: () => ({
                    eq: mockEq,
                    order: mockOrder,
                }),
            }
        },
    }),
}))

vi.mock('@/app/actions/assay-lookups', () => ({
    getSpecialties: (...args: unknown[]) => mockGetSpecialties(...args),
}))

vi.mock('next/navigation', () => ({
    redirect: (url: string) => {
        throw new Error(`redirect:${url}`)
    },
}))

vi.mock('@/components/dashboard-header', () => ({
    DashboardHeader: () => <div data-testid="dashboard-header" />,
}))

vi.mock('@/components/samples-page-client', () => ({
    SamplesPageClient: (props: unknown) => {
        capturedSamplesPageClientProps = props
        return <div data-testid="samples-page-client" />
    },
}))

import UnifiedSamplesPage from './page'

describe('UnifiedSamplesPage receiver options', () => {
    it('fetches only analyst users for the receiver filter', async () => {
        mockGetAuthenticatedDashboardSession.mockResolvedValue({
            role: 'manager',
            fullName: 'Lãnh đạo khoa XN',
        })
        mockIsDashboardUserRole.mockReturnValue(true)
        mockGetSpecialties.mockResolvedValue({ data: [] })
        mockEq.mockReturnValue({ order: mockOrder })
        mockOrder.mockResolvedValue({
            data: [
                { id: 'analyst-1', full_name: 'Nguyễn Thiện Chí' },
                { id: 'analyst-2', full_name: 'Analyst HIV' },
            ],
            error: null,
        })

        const page = await UnifiedSamplesPage()
        render(page)

        expect(screen.getByTestId('samples-page-client')).toBeDefined()
        expect(mockEq).toHaveBeenCalledWith('role', 'analyst')
        expect((capturedSamplesPageClientProps as { receiverOptions: Array<{ id: string; name: string }> }).receiverOptions).toEqual([
            { id: 'analyst-1', name: 'Nguyễn Thiện Chí' },
            { id: 'analyst-2', name: 'Analyst HIV' },
        ])
    })
})

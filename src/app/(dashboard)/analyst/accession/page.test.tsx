import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockSingle = vi.fn()
const mockGetSpecialties = vi.fn()

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

vi.mock('@/app/actions/assay-lookups', () => ({
    getSpecialties: (...args: unknown[]) => mockGetSpecialties(...args),
}))

vi.mock('@/components/dashboard-header', () => ({
    DashboardHeader: () => <div data-testid="dashboard-header" />,
}))

vi.mock('@/components/sample-accession-form', () => ({
    SampleAccessionForm: () => <div data-testid="sample-accession-form" />,
}))

vi.mock('@/components/walkthrough', () => ({
    WalkthroughTrigger: () => <button>Hướng dẫn</button>,
}))

import AccessionPage from './page'

describe('AccessionPage role guard', () => {
    afterEach(cleanup)

    it('renders the real download header beside the existing analyst accession form', async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: 'analyst-1' } } })
        mockSingle.mockResolvedValue({ data: { full_name: 'Analyst', role: 'analyst' } })
        mockGetSpecialties.mockResolvedValue({ data: [] })

        render(await AccessionPage())

        expect(screen.getByRole('heading', { name: 'Tiếp nhận mẫu mới' })).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Tải template Excel' })).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Hướng dẫn' })).toBeTruthy()
        expect(screen.getByTestId('sample-accession-form')).toBeTruthy()
    })
    it('redirects managers away from the analyst accession route', async () => {
        mockGetUser.mockResolvedValue({
            data: { user: { id: 'manager-1' } },
        })
        mockSingle.mockResolvedValue({
            data: {
                full_name: 'Manager',
                role: 'manager',
            },
        })
        mockGetSpecialties.mockResolvedValue({ data: [] })

        await expect(AccessionPage()).rejects.toThrowError('redirect:/manager')
    })
})

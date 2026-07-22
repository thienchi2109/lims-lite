import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAuthenticatedDashboardSessionMock = vi.fn()

vi.mock('@/lib/dashboard-session', () => ({
    getAuthenticatedDashboardSession: () => getAuthenticatedDashboardSessionMock(),
}))

vi.mock('@/components/walkthrough', () => ({
    WalkthroughWrapper: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="walkthrough">{children}</div>
    ),
}))

vi.mock('@/components/auth/authenticated-query-boundary', () => ({
    AuthenticatedQueryBoundary: ({
        children,
        principalKey,
    }: {
        children: React.ReactNode
        principalKey: string
    }) => (
        <div data-testid="query-boundary" data-principal-key={principalKey}>
            {children}
        </div>
    ),
}))

vi.mock('@/components/auth/session-timebox-guard', () => ({
    SessionTimeboxGuard: ({ principalKey }: { principalKey: string }) => (
        <div data-testid="session-guard" data-principal-key={principalKey} />
    ),
}))

vi.mock('@/components/scanner/scanner-serial-provider', () => ({
    ScannerSerialProvider: ({
        children,
        principalKey,
    }: {
        children: React.ReactNode
        principalKey: string
    }) => (
        <div data-testid="scanner-provider" data-principal-key={principalKey}>
            {children}
        </div>
    ),
}))

import DashboardLayout from './layout'

describe('DashboardLayout scanner provider boundary', () => {
    beforeEach(() => {
        getAuthenticatedDashboardSessionMock.mockReset()
    })

    it('does not mount the scanner provider for the unauthenticated branch', async () => {
        getAuthenticatedDashboardSessionMock.mockResolvedValue(null)

        render(await DashboardLayout({ children: <div>login</div> }))

        expect(screen.queryByTestId('scanner-provider')).toBeNull()
        expect(screen.queryByTestId('query-boundary')).toBeNull()
        expect(screen.getByText('login')).toBeDefined()
    })

    it('mounts one principal-keyed scanner provider inside the authenticated boundary', async () => {
        getAuthenticatedDashboardSessionMock.mockResolvedValue({
            principalKey: 'staff-1:analyst:standard',
        })

        render(await DashboardLayout({ children: <div>dashboard</div> }))

        const queryBoundary = screen.getByTestId('query-boundary')
        const scannerProvider = screen.getByTestId('scanner-provider')

        expect(queryBoundary.contains(scannerProvider)).toBe(true)
        expect(scannerProvider.dataset.principalKey).toBe('staff-1:analyst:standard')
        expect(screen.getAllByTestId('scanner-provider')).toHaveLength(1)
        expect(screen.getByTestId('session-guard')).toBeDefined()
        expect(screen.getByText('dashboard')).toBeDefined()
    })
})

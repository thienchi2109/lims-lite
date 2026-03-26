import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { buildAuthenticatedPrincipalKey } from '@/lib/authenticated-query-cache'

const mockGetSessionTimeboxExpiryClient = vi.fn()
const mockLogoutClient = vi.fn()
const mockSignOut = vi.fn()
const mockQueryClient = {
    clear: vi.fn(),
}

vi.mock('@/lib/api-client', () => ({
    getSessionTimeboxExpiryClient: (...args: unknown[]) => mockGetSessionTimeboxExpiryClient(...args),
    logoutClient: (...args: unknown[]) => mockLogoutClient(...args),
}))

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        auth: {
            signOut: mockSignOut,
        },
    }),
}))

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')

    return {
        ...actual,
        useQueryClient: () => mockQueryClient,
    }
})

import { SessionTimeboxGuard } from '../session-timebox-guard'

describe('SessionTimeboxGuard cache isolation', () => {
    const managerKey = buildAuthenticatedPrincipalKey({
        userId: 'manager-1',
        role: 'manager',
        canAccessConfidential: true,
    })
    const downgradedManagerKey = buildAuthenticatedPrincipalKey({
        userId: 'manager-1',
        role: 'manager',
        canAccessConfidential: false,
    })

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useRealTimers()
        mockGetSessionTimeboxExpiryClient.mockReset()
        mockLogoutClient.mockReset()
        mockSignOut.mockReset()
        mockQueryClient.clear.mockReset()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('clears the query cache before forced logout continues the redirect flow', async () => {
        mockGetSessionTimeboxExpiryClient.mockResolvedValue({
            authenticated: false,
            error: 'session expired',
            reason: 'session_expired',
        })
        mockLogoutClient.mockRejectedValueOnce(new Error('logout failed'))

        render(<SessionTimeboxGuard principalKey={managerKey} />)

        await waitFor(() => {
            expect(mockGetSessionTimeboxExpiryClient).toHaveBeenCalled()
            expect(mockLogoutClient).toHaveBeenCalled()
            expect(mockSignOut).toHaveBeenCalled()
        })

        expect(mockQueryClient.clear).toHaveBeenCalled()
        expect(mockQueryClient.clear.mock.invocationCallOrder[0]).toBeLessThan(
            mockSignOut.mock.invocationCallOrder[0],
        )
    })

    it('clears the query cache before redirecting when the session was signed out elsewhere', async () => {
        mockGetSessionTimeboxExpiryClient.mockResolvedValue({
            authenticated: false,
            error: 'signed out elsewhere',
            reason: 'signed_out_elsewhere',
        })

        render(<SessionTimeboxGuard principalKey={managerKey} />)

        await waitFor(() => {
            expect(mockGetSessionTimeboxExpiryClient).toHaveBeenCalled()
        })

        expect(mockQueryClient.clear).toHaveBeenCalled()
        expect(mockLogoutClient).not.toHaveBeenCalled()
        expect(mockSignOut).not.toHaveBeenCalled()
    })

    it('clears the query cache when a later server poll reports a different principal key', async () => {
        vi.useFakeTimers()
        mockGetSessionTimeboxExpiryClient
            .mockResolvedValueOnce({
                authenticated: true,
                timebox_seconds: 14_400,
                expires_at: '2026-03-26T13:00:00.000Z',
                expires_in_ms: 600_000,
                source: 'sessions.created_at',
                principal_key: managerKey,
            })
            .mockResolvedValueOnce({
                authenticated: true,
                timebox_seconds: 14_400,
                expires_at: '2026-03-26T13:00:00.000Z',
                expires_in_ms: 540_000,
                source: 'sessions.created_at',
                principal_key: downgradedManagerKey,
            })

        render(<SessionTimeboxGuard principalKey={managerKey} />)

        await vi.runAllTicks()
        expect(mockGetSessionTimeboxExpiryClient).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(60_000)
        await vi.runAllTicks()
        expect(mockGetSessionTimeboxExpiryClient).toHaveBeenCalledTimes(2)

        expect(mockQueryClient.clear).toHaveBeenCalled()
        expect(mockLogoutClient).not.toHaveBeenCalled()
        expect(mockSignOut).not.toHaveBeenCalled()
    })
})

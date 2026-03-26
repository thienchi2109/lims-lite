import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

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
    beforeEach(() => {
        vi.clearAllMocks()
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

        render(<SessionTimeboxGuard />)

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

        render(<SessionTimeboxGuard />)

        await waitFor(() => {
            expect(mockGetSessionTimeboxExpiryClient).toHaveBeenCalled()
        })

        expect(mockQueryClient.clear).toHaveBeenCalled()
        expect(mockLogoutClient).not.toHaveBeenCalled()
        expect(mockSignOut).not.toHaveBeenCalled()
    })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
    cookieSet: vi.fn(),
    redirect: vi.fn((path: string) => {
        throw new Error(`NEXT_REDIRECT:${path}`)
    }),
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mocks.createClient(...args),
    createAdminClient: (...args: unknown[]) => mocks.createAdminClient(...args),
}))

vi.mock('next/navigation', () => ({
    redirect: (path: string) => mocks.redirect(path),
}))

vi.mock('next/headers', () => ({
    cookies: async () => ({
        set: mocks.cookieSet,
    }),
}))

import { login, logout } from './auth'
import {
    MANAGER_STEP_UP_COOKIE_NAME,
    getManagerStepUpCookieOptions,
} from '@/lib/manager-email-otp/step-up'

const originalEnv = { ...process.env }

function createLoginFormData(username = 'manager') {
    const formData = new FormData()
    formData.set('username', username)
    formData.set('password', 'correct-password')
    return formData
}

function mockAuthenticatedProfile(profile: { userId: string; role: 'manager' | 'analyst'; canAccessConfidential: boolean }) {
    const usersQuery = {
        select: vi.fn(() => usersQuery),
        eq: vi.fn(() => usersQuery),
        single: vi.fn(async () => ({
            data: {
                role: profile.role,
                can_access_confidential: profile.canAccessConfidential,
            },
            error: null,
        })),
    }

    mocks.createClient.mockResolvedValue({
        auth: {
            signInWithPassword: vi.fn(async () => ({
                data: { user: { id: profile.userId } },
                error: null,
            })),
        },
        from: vi.fn(() => usersQuery),
    })
}

describe('manager email OTP login contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.MANAGER_EMAIL_OTP_ENABLED = 'TRUE'
        process.env.MANAGER_HIV_EMAIL_OTP_ENABLED = 'FALSE'
        process.env.ANALYST_HIV_EMAIL_OTP_ENABLED = 'FALSE'

        mocks.createAdminClient.mockReturnValue({
            rpc: vi.fn(async (name: string) => {
                if (name === 'get_user_email_by_username') {
                    return { data: 'manager@cdc-lims.local', error: null }
                }

                if (name === 'get_latest_session_id') {
                    return { data: 'session-1', error: null }
                }

                return { data: null, error: null }
            }),
        })

        const usersQuery = {
            select: vi.fn(() => usersQuery),
            eq: vi.fn(() => usersQuery),
            single: vi.fn(async () => ({
                data: { role: 'manager', can_access_confidential: false },
                error: null,
            })),
        }

        mocks.createClient.mockResolvedValue({
            auth: {
                signInWithPassword: vi.fn(async () => ({
                    data: { user: { id: 'manager-1' } },
                    error: null,
                })),
            },
            from: vi.fn(() => usersQuery),
        })
    })

    afterEach(() => {
        process.env = { ...originalEnv }
    })

    it('redirects a password-authenticated manager to email OTP verification before /manager access', async () => {
        await expect(login(null, createLoginFormData())).rejects.toThrow('NEXT_REDIRECT:/manager/otp')
        expect(mocks.redirect).toHaveBeenCalledWith('/manager/otp')
    })

    it('still redirects a manager to email OTP verification when session ID lookup fails', async () => {
        mocks.createAdminClient.mockReturnValue({
            rpc: vi.fn(async (name: string) => {
                if (name === 'get_user_email_by_username') {
                    return { data: 'manager@cdc-lims.local', error: null }
                }

                if (name === 'get_latest_session_id') {
                    return { data: null, error: { message: 'session lookup failed' } }
                }

                return { data: null, error: null }
            }),
        })

        await expect(login(null, createLoginFormData())).rejects.toThrow('NEXT_REDIRECT:/manager/otp')
        expect(mocks.redirect).toHaveBeenCalledWith('/manager/otp')
    })

    it('clears manager OTP step-up state when the server logout action is used', async () => {
        mocks.createClient.mockResolvedValue({
            auth: {
                signOut: vi.fn(async () => undefined),
            },
        })

        await expect(logout()).rejects.toThrow('NEXT_REDIRECT:/login')
        expect(mocks.cookieSet).toHaveBeenCalledWith(MANAGER_STEP_UP_COOKIE_NAME, '', {
            ...getManagerStepUpCookieOptions(),
            maxAge: 0,
        })
        expect(mocks.redirect).toHaveBeenCalledWith('/login')
    })

    it('redirects a confidential analyst to OTP verification after password login when analyst HIV OTP is enabled', async () => {
        process.env.MANAGER_EMAIL_OTP_ENABLED = 'FALSE'
        process.env.MANAGER_HIV_EMAIL_OTP_ENABLED = 'FALSE'
        process.env.ANALYST_HIV_EMAIL_OTP_ENABLED = 'TRUE'
        mockAuthenticatedProfile({
            userId: 'analyst-hiv-1',
            role: 'analyst',
            canAccessConfidential: true,
        })

        await expect(login(null, createLoginFormData('analyst-hiv'))).rejects.toThrow('NEXT_REDIRECT:/manager/otp')
        expect(mocks.redirect).toHaveBeenCalledWith('/manager/otp')
    })

    it('does not redirect a confidential analyst to OTP when the analyst HIV flag is disabled', async () => {
        process.env.ANALYST_HIV_EMAIL_OTP_ENABLED = 'FALSE'
        mockAuthenticatedProfile({
            userId: 'analyst-hiv-1',
            role: 'analyst',
            canAccessConfidential: true,
        })

        await expect(login(null, createLoginFormData('analyst-hiv'))).rejects.toThrow('NEXT_REDIRECT:/analyst')
        expect(mocks.redirect).toHaveBeenCalledWith('/analyst')
    })
})

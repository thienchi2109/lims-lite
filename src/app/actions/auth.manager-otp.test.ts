import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
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

import { login } from './auth'

const originalEnv = { ...process.env }

function createLoginFormData() {
    const formData = new FormData()
    formData.set('username', 'manager')
    formData.set('password', 'correct-password')
    return formData
}

describe('manager email OTP login contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.MANAGER_EMAIL_OTP_ENABLED = 'TRUE'
        process.env.MANAGER_HIV_EMAIL_OTP_ENABLED = 'FALSE'

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
})

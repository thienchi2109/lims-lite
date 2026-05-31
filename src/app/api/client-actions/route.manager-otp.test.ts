import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mocks.createClient(...args),
}))

import { getClientActionDenial } from './role-guard'

const originalEnv = { ...process.env }

function mockPasswordOnlyManager() {
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
            getUser: vi.fn(async () => ({
                data: { user: { id: 'manager-1' } },
                error: null,
            })),
        },
        from: vi.fn(() => usersQuery),
    })
}

describe('manager email OTP client action guard contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.MANAGER_EMAIL_OTP_ENABLED = 'TRUE'
        process.env.MANAGER_HIV_EMAIL_OTP_ENABLED = 'FALSE'
    })

    afterEach(() => {
        process.env = { ...originalEnv }
    })

    it('denies manager-only client actions for password-only manager sessions when OTP is enabled', async () => {
        mockPasswordOnlyManager()

        await expect(getClientActionDenial('createUser')).resolves.toEqual({
            error: 'Yêu cầu xác thực OTP email quản lý trước khi tiếp tục',
            status: 403,
        })
    })
})

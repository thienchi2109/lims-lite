import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    shouldRequireManagerStepUp: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mocks.createClient(...args),
}))

vi.mock('@/lib/manager-email-otp/guards', () => ({
    MANAGER_OTP_REQUIRED_ERROR: 'Yêu cầu xác thực OTP',
    shouldRequireManagerStepUp: (...args: unknown[]) =>
        mocks.shouldRequireManagerStepUp(...args),
}))

import {
    CLIENT_ACTION_FORBIDDEN_ERROR,
    getClientActionDenial,
} from './role-guard'

function mockRole(role: string, roleError: unknown = null) {
    const usersQuery = {
        select: vi.fn(),
        eq: vi.fn(),
        single: vi.fn(async () => ({
            data: roleError
                ? null
                : {
                    role,
                    can_access_confidential: false,
                    manager_otp_settings: null,
                },
            error: roleError,
        })),
    }

    usersQuery.select.mockReturnValue(usersQuery)
    usersQuery.eq.mockReturnValue(usersQuery)

    mocks.createClient.mockResolvedValue({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: {
                    user: {
                        id: '11111111-1111-4111-8111-111111111111',
                    },
                },
                error: null,
            }),
            getSession: vi.fn().mockResolvedValue({
                data: {
                    session: {
                        access_token: null,
                    },
                },
                error: null,
            }),
        },
        from: vi.fn(() => usersQuery),
    })
}

describe('client action authorization characterization', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.shouldRequireManagerStepUp.mockResolvedValue(false)
    })

    it('denies doctor identity lookup with the existing Vietnamese error', async () => {
        mockRole('doctor')

        const result = await getClientActionDenial('findClientByIdentity')

        expect(result).toEqual({
            error: CLIENT_ACTION_FORBIDDEN_ERROR,
            status: 403,
        })
        expect(CLIENT_ACTION_FORBIDDEN_ERROR).toBe(
            'Bạn không có quyền thực hiện thao tác này',
        )
    })

    it('allows only managers to use client lifecycle actions', async () => {
        const lifecycleActions = [
            'getClientLifecycleManager',
            'getClientLifecycleDetailManager',
            'deactivateClient',
            'restoreClient',
            'correctClientIdentity',
            'adjudicateClientCollision',
        ] as const

        for (const action of lifecycleActions) {
            mockRole('analyst')
            await expect(getClientActionDenial(action)).resolves.toEqual({
                error: CLIENT_ACTION_FORBIDDEN_ERROR,
                status: 403,
            })

            mockRole('manager')
            await expect(getClientActionDenial(action)).resolves.toBeNull()
        }
    })

    it('keeps analyst client upsert authorized by the bridge guard', async () => {
        mockRole('analyst')

        const result = await getClientActionDenial('upsertClient')

        expect(result).toBeNull()
    })

    it('fails closed with the current localized role lookup error', async () => {
        mockRole('analyst', {
            message: 'role lookup failed',
        })

        const result = await getClientActionDenial('getClients')

        expect(result).toEqual({
            error: 'Không thể xác minh quyền truy cập',
            status: 403,
        })
    })
})

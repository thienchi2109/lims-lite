import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
    revalidatePath: vi.fn(),
    requireRole: vi.fn(),
    shouldRequireManagerStepUp: vi.fn(),
    cookieGet: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mocks.createClient(...args),
    createAdminClient: (...args: unknown[]) => mocks.createAdminClient(...args),
}))

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
}))

vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: mocks.cookieGet,
    }),
}))

vi.mock('@/lib/auth-helpers', () => ({
    requireRole: (...args: unknown[]) => mocks.requireRole(...args),
    isAuthError: (result: unknown) => (
        typeof result === 'object' &&
        result !== null &&
        'error' in result &&
        typeof (result as { error?: unknown }).error === 'string'
    ),
}))

vi.mock('@/lib/manager-email-otp/guards', () => ({
    MANAGER_OTP_REQUIRED_ERROR: 'Yêu cầu xác thực OTP email quản lý trước khi tiếp tục',
    shouldRequireManagerStepUp: (...args: unknown[]) => mocks.shouldRequireManagerStepUp(...args),
}))

type ManagerOtpUserActions = {
    updateOwnManagerOtpEmail?: unknown
    configureManagerOtpEmail: (input: { userId: string; otpEmail: string }) => Promise<unknown>
    getMaskedManagerOtpEmail: (userId: string) => Promise<unknown>
}

async function loadUserActions() {
    const modulePath = './users-manager-otp'
    return import(modulePath) as Promise<ManagerOtpUserActions>
}

const managerId = '11111111-1111-4111-8111-111111111111'
const targetManagerId = '22222222-2222-4222-8222-222222222222'

function createAdminOtpSettingsClient(result: {
    data?: unknown
    error?: { message: string } | null
    targetRole?: string | null
} = {}) {
    const settingsQuery = {
        upsert: vi.fn(async () => ({ error: result.error ?? null })),
        select: vi.fn(() => settingsQuery),
        eq: vi.fn(() => settingsQuery),
        single: vi.fn(async () => ({
            data: result.data ?? { otp_email: 'manager@example.com' },
            error: result.error ?? null,
        })),
    }
    const usersQuery = {
        select: vi.fn(() => usersQuery),
        eq: vi.fn(() => usersQuery),
        single: vi.fn(async () => ({
            data: result.targetRole === undefined ? { role: 'manager' } : { role: result.targetRole },
            error: null,
        })),
    }

    return {
        from: vi.fn((table: string) => {
            if (table === 'manager_otp_settings') return settingsQuery
            if (table === 'users') return usersQuery
            throw new Error(`Unexpected table: ${table}`)
        }),
        query: settingsQuery,
        usersQuery,
    }
}

function createManagerStepUpContextClient(result: {
    canAccessConfidential?: boolean
    otpEmailUpdatedAt?: string | null
    sessionId?: string | null
} = {}) {
    const usersQuery = {
        select: vi.fn(() => usersQuery),
        eq: vi.fn(() => usersQuery),
        single: vi.fn(async () => ({
            data: {
                can_access_confidential: result.canAccessConfidential ?? false,
                manager_otp_settings: {
                    updated_at: result.otpEmailUpdatedAt ?? '2026-06-01T00:00:00.000Z',
                },
            },
            error: null,
        })),
    }
    const accessToken = result.sessionId === null
        ? null
        : ['header', Buffer.from(JSON.stringify({ session_id: result.sessionId ?? 'session-1' }), 'utf8').toString('base64url'), 'signature'].join('.')

    return {
        auth: {
            getSession: vi.fn(async () => ({
                data: {
                    session: accessToken ? { access_token: accessToken } : null,
                },
                error: null,
            })),
        },
        from: vi.fn(() => usersQuery),
        usersQuery,
    }
}

describe('manager OTP email user-management contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
        mocks.requireRole.mockResolvedValue({ id: managerId, role: 'manager' })
        mocks.shouldRequireManagerStepUp.mockReturnValue(false)
        mocks.createClient.mockResolvedValue(createManagerStepUpContextClient())
    })

    it('exposes an admin-only action for configuring a manager OTP email destination', async () => {
        const actions = await loadUserActions()

        expect(actions.configureManagerOtpEmail).toEqual(expect.any(Function))
    })

    it('exposes a masked read action without adding a manager self-service update action', async () => {
        const actions = await loadUserActions()

        expect(actions.getMaskedManagerOtpEmail).toEqual(expect.any(Function))
        expect(actions.updateOwnManagerOtpEmail).toBeUndefined()
    })

    it('validates UUID and email input before configuring manager OTP email', async () => {
        mocks.createAdminClient.mockReturnValue(createAdminOtpSettingsClient())
        const actions = await loadUserActions()
        const { configureManagerOtpEmail } = actions

        await expect(
            configureManagerOtpEmail({ userId: 'not-a-uuid', otpEmail: 'not-an-email' }),
        ).rejects.toThrow()
        expect(mocks.createAdminClient).not.toHaveBeenCalled()
    })

    it('prevents managers from changing their own OTP destination email', async () => {
        mocks.createAdminClient.mockReturnValue(createAdminOtpSettingsClient())
        const actions = await loadUserActions()
        const { configureManagerOtpEmail } = actions

        await expect(
            configureManagerOtpEmail({ userId: managerId, otpEmail: 'manager@example.com' }),
        ).rejects.toThrow(/self|chính mình|tự/i)
        expect(mocks.createAdminClient).not.toHaveBeenCalled()
    })

    it('requires a completed manager OTP step-up before configuring another manager OTP email when enforcement is enabled', async () => {
        mocks.shouldRequireManagerStepUp.mockReturnValue(true)
        const actions = await loadUserActions()
        const { configureManagerOtpEmail } = actions

        await expect(
            configureManagerOtpEmail({ userId: targetManagerId, otpEmail: 'otp@example.com' }),
        ).rejects.toThrow('Yêu cầu xác thực OTP email quản lý trước khi tiếp tục')
        expect(mocks.createAdminClient).not.toHaveBeenCalled()
    })

    it('uses the service-role client for manager OTP email writes after manager authorization', async () => {
        const adminClient = createAdminOtpSettingsClient()
        mocks.createAdminClient.mockReturnValue(adminClient)
        const actions = await loadUserActions()
        const { configureManagerOtpEmail } = actions

        await expect(
            configureManagerOtpEmail({ userId: targetManagerId, otpEmail: 'otp@example.com' }),
        ).resolves.toEqual({ success: true })
        expect(mocks.createAdminClient).toHaveBeenCalled()
        expect(mocks.requireRole).toHaveBeenCalledWith('manager')
        expect(adminClient.usersQuery.single).toHaveBeenCalled()
        expect(adminClient.query.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ user_id: targetManagerId, otp_email: 'otp@example.com' }),
        )
        expect(mocks.shouldRequireManagerStepUp).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: managerId,
                role: 'manager',
                sessionId: 'session-1',
                otpEmailUpdatedAt: '2026-06-01T00:00:00.000Z',
            }),
            expect.objectContaining({ get: expect.any(Function) }),
        )
        expect(mocks.revalidatePath).toHaveBeenCalledWith('/manager/users')
    })

    it('rejects non-manager OTP email targets before writing settings', async () => {
        const adminClient = createAdminOtpSettingsClient({ targetRole: 'analyst' })
        mocks.createAdminClient.mockReturnValue(adminClient)
        const actions = await loadUserActions()
        const { configureManagerOtpEmail } = actions

        await expect(
            configureManagerOtpEmail({ userId: targetManagerId, otpEmail: 'otp@example.com' }),
        ).rejects.toThrow(/quản lý/i)
        expect(adminClient.query.upsert).not.toHaveBeenCalled()
    })

    it('returns a Vietnamese error message when OTP email configuration fails', async () => {
        const adminClient = createAdminOtpSettingsClient({ error: { message: 'database unavailable' } })
        mocks.createAdminClient.mockReturnValue(adminClient)
        const actions = await loadUserActions()
        const { configureManagerOtpEmail } = actions

        await expect(
            configureManagerOtpEmail({ userId: targetManagerId, otpEmail: 'otp@example.com' }),
        ).rejects.toThrow(/Không thể cấu hình email OTP quản lý/i)
    })

    it('requires manager authorization and service-role reads before returning a masked OTP email', async () => {
        mocks.createAdminClient.mockReturnValue(createAdminOtpSettingsClient({
            data: { otp_email: 'manager@example.com' },
        }))
        const actions = await loadUserActions()
        const { getMaskedManagerOtpEmail } = actions

        await expect(getMaskedManagerOtpEmail(targetManagerId)).resolves.toEqual({ otpEmail: 'ma***@example.com' })
        expect(mocks.createAdminClient).toHaveBeenCalled()
    })
})

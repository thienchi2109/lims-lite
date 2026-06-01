import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
    revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mocks.createClient(...args),
    createAdminClient: (...args: unknown[]) => mocks.createAdminClient(...args),
}))

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
}))

type ManagerOtpUserActions = {
    configureManagerOtpEmail?: unknown
    getMaskedManagerOtpEmail?: unknown
    updateOwnManagerOtpEmail?: unknown
}

async function loadUserActions() {
    const modulePath = './users'
    return import(modulePath) as Promise<ManagerOtpUserActions>
}

const managerId = '11111111-1111-4111-8111-111111111111'
const targetManagerId = '22222222-2222-4222-8222-222222222222'

function createRoleClient(role = 'manager', currentUserId = managerId) {
    const roleQuery = {
        select: vi.fn(() => roleQuery),
        eq: vi.fn(() => roleQuery),
        single: vi.fn(async () => ({ data: { role }, error: null })),
    }

    return {
        auth: {
            getUser: vi.fn(async () => ({
                data: { user: { id: currentUserId } },
                error: null,
            })),
        },
        from: vi.fn(() => roleQuery),
    }
}

function createAdminOtpSettingsClient(result: { data?: unknown; error?: { message: string } | null } = {}) {
    const query = {
        upsert: vi.fn(async () => ({ error: result.error ?? null })),
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        single: vi.fn(async () => ({
            data: result.data ?? { otp_email: 'manager@example.com' },
            error: result.error ?? null,
        })),
    }

    return {
        from: vi.fn((table: string) => {
            expect(table).toBe('manager_otp_settings')
            return query
        }),
        query,
    }
}

describe('manager OTP email user-management contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
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
        mocks.createClient.mockResolvedValue(createRoleClient())
        mocks.createAdminClient.mockReturnValue(createAdminOtpSettingsClient())
        const actions = await loadUserActions()
        const configureManagerOtpEmail = actions.configureManagerOtpEmail as (input: {
            userId: string
            otpEmail: string
        }) => Promise<unknown>

        await expect(
            configureManagerOtpEmail({ userId: 'not-a-uuid', otpEmail: 'not-an-email' }),
        ).rejects.toThrow()
        expect(mocks.createAdminClient).not.toHaveBeenCalled()
    })

    it('prevents managers from changing their own OTP destination email', async () => {
        mocks.createClient.mockResolvedValue(createRoleClient('manager', managerId))
        mocks.createAdminClient.mockReturnValue(createAdminOtpSettingsClient())
        const actions = await loadUserActions()
        const configureManagerOtpEmail = actions.configureManagerOtpEmail as (input: {
            userId: string
            otpEmail: string
        }) => Promise<unknown>

        await expect(
            configureManagerOtpEmail({ userId: managerId, otpEmail: 'manager@example.com' }),
        ).rejects.toThrow(/self|chính mình|tự/i)
        expect(mocks.createAdminClient).not.toHaveBeenCalled()
    })

    it('uses the service-role client for manager OTP email writes after manager authorization', async () => {
        mocks.createClient.mockResolvedValue(createRoleClient())
        const adminClient = createAdminOtpSettingsClient()
        mocks.createAdminClient.mockReturnValue(adminClient)
        const actions = await loadUserActions()
        const configureManagerOtpEmail = actions.configureManagerOtpEmail as (input: {
            userId: string
            otpEmail: string
        }) => Promise<unknown>

        await expect(
            configureManagerOtpEmail({ userId: targetManagerId, otpEmail: 'otp@example.com' }),
        ).resolves.toEqual({ success: true })
        expect(mocks.createAdminClient).toHaveBeenCalled()
        expect(adminClient.query.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ user_id: targetManagerId, otp_email: 'otp@example.com' }),
        )
        expect(mocks.revalidatePath).toHaveBeenCalledWith('/manager/users')
    })

    it('requires manager authorization and service-role reads before returning a masked OTP email', async () => {
        mocks.createClient.mockResolvedValue(createRoleClient())
        mocks.createAdminClient.mockReturnValue(createAdminOtpSettingsClient({
            data: { otp_email: 'manager@example.com' },
        }))
        const actions = await loadUserActions()
        const getMaskedManagerOtpEmail = actions.getMaskedManagerOtpEmail as (userId: string) => Promise<unknown>

        await expect(getMaskedManagerOtpEmail(targetManagerId)).resolves.toEqual({ otpEmail: 'ma***@example.com' })
        expect(mocks.createAdminClient).toHaveBeenCalled()
    })
})

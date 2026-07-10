import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
    revalidatePath: vi.fn(),
    authGetUser: vi.fn(),
    authCreateUser: vi.fn(),
    authDeleteUser: vi.fn(),
    authUpdateUserById: vi.fn(),
    userInsert: vi.fn(),
    userUpdate: vi.fn(),
    userUpdateEq: vi.fn(),
    otpSettingsUpsert: vi.fn(),
    profiles: {} as Record<string, { id: string; role: 'analyst' | 'doctor' | 'manager' }>,
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mocks.createClient(...args),
    createAdminClient: (...args: unknown[]) => mocks.createAdminClient(...args),
}))

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
}))

import { createUser, deleteUser, updateUser } from '@/app/actions/users'

const callerManagerId = '11111111-1111-4111-8111-111111111111'
const otherManagerId = '22222222-2222-4222-8222-222222222222'
const newManagerId = '33333333-3333-4333-8333-333333333333'
const analystId = '44444444-4444-4444-8444-444444444444'
const doctorId = '55555555-5555-4555-8555-555555555555'

function createUsersTable() {
    return {
        select: vi.fn(() => ({
            eq: vi.fn((_field: string, value: string) => ({
                single: vi.fn().mockResolvedValue({
                    data: mocks.profiles[value] ?? null,
                    error: null,
                }),
            })),
        })),
        insert: mocks.userInsert,
        update: mocks.userUpdate,
    }
}

describe('manager user-management permissions', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        Object.keys(mocks.profiles).forEach((key) => delete mocks.profiles[key])
        mocks.profiles[callerManagerId] = { id: callerManagerId, role: 'manager' }

        mocks.authGetUser.mockResolvedValue({
            data: {
                user: {
                    id: callerManagerId,
                },
            },
        })
        mocks.authCreateUser.mockResolvedValue({
            data: {
                user: {
                    id: newManagerId,
                },
            },
            error: null,
        })
        mocks.authDeleteUser.mockResolvedValue({ error: null })
        mocks.authUpdateUserById.mockResolvedValue({ error: null })
        mocks.userInsert.mockResolvedValue({ error: null })
        mocks.userUpdate.mockReturnValue({ eq: mocks.userUpdateEq })
        mocks.userUpdateEq.mockResolvedValue({ error: null })
        mocks.otpSettingsUpsert.mockResolvedValue({ error: null })
        mocks.createClient.mockResolvedValue({
            auth: {
                getUser: mocks.authGetUser,
            },
            from: vi.fn((table: string) => {
                if (table !== 'users') throw new Error(`Unexpected table: ${table}`)
                return createUsersTable()
            }),
        })
        mocks.createAdminClient.mockReturnValue({
            auth: {
                admin: {
                    createUser: mocks.authCreateUser,
                    deleteUser: mocks.authDeleteUser,
                    updateUserById: mocks.authUpdateUserById,
                },
            },
            from: vi.fn((table: string) => {
                if (table !== 'manager_otp_settings') throw new Error(`Unexpected admin table: ${table}`)
                return {
                    upsert: mocks.otpSettingsUpsert,
                }
            }),
        })
    })

    it('forces manager-created users to non-confidential access', async () => {
        await createUser({
            username: 'manager2',
            full_name: 'Manager Two',
            password: 'password123',
            role: 'manager',
            email: 'manager2@example.com',
            can_access_confidential: true,
        } as never)

        expect(mocks.userInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                can_access_confidential: false,
            }),
        )
    })

    it('allows manager-created analyst users to receive confidential access', async () => {
        await createUser({
            username: 'analyst2',
            full_name: 'Analyst Two',
            password: 'password123',
            role: 'analyst',
            email: 'analyst2@example.com',
            can_access_confidential: true,
        } as never)

        expect(mocks.userInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                role: 'analyst',
                can_access_confidential: true,
            }),
        )
    })

    it('configures analyst OTP email during analyst creation', async () => {
        await createUser({
            username: 'analyst2',
            full_name: 'Analyst Two',
            password: 'password123',
            role: 'analyst',
            email: 'analyst2@example.com',
            otpEmail: 'analyst-otp@example.com',
        } as never)

        expect(mocks.otpSettingsUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: newManagerId,
                otp_email: 'analyst-otp@example.com',
            }),
        )
    })

    it('configures manager OTP email from the account email during creation', async () => {
        await createUser({
            username: 'manager2',
            full_name: 'Manager Two',
            password: 'password123',
            role: 'manager',
            email: 'manager2@example.com',
        })

        expect(mocks.otpSettingsUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: newManagerId,
                otp_email: 'manager2@example.com',
            }),
        )
    })

    it('rolls back a manager account when OTP destination configuration fails', async () => {
        mocks.otpSettingsUpsert.mockResolvedValueOnce({
            error: { message: 'OTP destination unavailable' },
        })

        await expect(
            createUser({
                username: 'manager2',
                full_name: 'Manager Two',
                password: 'password123',
                role: 'manager',
                email: 'manager2@example.com',
            }),
        ).rejects.toThrow(/manager otp/i)

        expect(mocks.authDeleteUser).toHaveBeenCalledWith(newManagerId)
        expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('rejects manager creation without an email before creating Auth user', async () => {
        await expect(
            createUser({
                username: 'manager2',
                full_name: 'Manager Two',
                password: 'password123',
                role: 'manager',
            } as never),
        ).rejects.toThrow(/email/i)

        expect(mocks.authCreateUser).not.toHaveBeenCalled()
        expect(mocks.userInsert).not.toHaveBeenCalled()
        expect(mocks.otpSettingsUpsert).not.toHaveBeenCalled()
    })

    it('rejects manager updates to another existing manager before profile or Auth mutations', async () => {
        mocks.profiles[otherManagerId] = { id: otherManagerId, role: 'manager' }

        await expect(
            updateUser({
                id: otherManagerId,
                full_name: 'Other Manager Updated',
                email: 'other-manager@example.com',
                password: 'password123',
            } as never),
        ).rejects.toThrow(/manager/i)

        expect(mocks.userUpdate).not.toHaveBeenCalled()
        expect(mocks.authUpdateUserById).not.toHaveBeenCalled()
    })

    it('rejects role changes before profile, Auth, OTP, or revalidation side effects', async () => {
        await expect(
            updateUser({
                id: analystId,
                role: 'manager',
            } as never),
        ).rejects.toThrow(/role/i)

        expect(mocks.createClient).not.toHaveBeenCalled()
        expect(mocks.userUpdate).not.toHaveBeenCalled()
        expect(mocks.authUpdateUserById).not.toHaveBeenCalled()
        expect(mocks.otpSettingsUpsert).not.toHaveBeenCalled()
        expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('allows managers to toggle confidential access for analyst users only', async () => {
        mocks.profiles[analystId] = { id: analystId, role: 'analyst' }

        await updateUser({
            id: analystId,
            can_access_confidential: true,
        } as never)

        expect(mocks.userUpdate).toHaveBeenCalledWith({
            can_access_confidential: true,
        })
        expect(mocks.userUpdateEq).toHaveBeenCalledWith('id', analystId)
    })

    it('configures analyst OTP email during analyst updates', async () => {
        mocks.profiles[analystId] = { id: analystId, role: 'analyst' }

        await updateUser({
            id: analystId,
            otpEmail: 'analyst-otp@example.com',
        } as never)

        expect(mocks.otpSettingsUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: analystId,
                otp_email: 'analyst-otp@example.com',
            }),
        )
    })

    it('rejects confidential access updates for non-analyst users', async () => {
        mocks.profiles[doctorId] = { id: doctorId, role: 'doctor' }

        await expect(
            updateUser({
                id: doctorId,
                can_access_confidential: true,
            } as never),
        ).rejects.toThrow(/analyst/i)

        expect(mocks.userUpdate).not.toHaveBeenCalled()
        expect(mocks.authUpdateUserById).not.toHaveBeenCalled()
    })

    it('rejects manager soft-delete of another existing manager before profile or Auth mutations', async () => {
        mocks.profiles[otherManagerId] = { id: otherManagerId, role: 'manager' }

        await expect(deleteUser(otherManagerId)).rejects.toThrow(/manager/i)

        expect(mocks.userUpdate).not.toHaveBeenCalled()
        expect(mocks.authUpdateUserById).not.toHaveBeenCalled()
    })

    it('retires an analyst through soft delete and an Auth ban', async () => {
        mocks.profiles[analystId] = { id: analystId, role: 'analyst' }

        await deleteUser(analystId)

        expect(mocks.userUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ deleted_at: expect.any(String) }),
        )
        expect(mocks.userUpdateEq).toHaveBeenCalledWith('id', analystId)
        expect(mocks.authUpdateUserById).toHaveBeenCalledWith(
            analystId,
            { ban_duration: '876600h' },
        )
    })

    it('allows manager self-edit of permitted profile fields', async () => {
        await updateUser({
            id: callerManagerId,
            full_name: 'Manager One Updated',
        } as never)

        expect(mocks.userUpdate).toHaveBeenCalledWith({
            full_name: 'Manager One Updated',
        })
        expect(mocks.authUpdateUserById).not.toHaveBeenCalled()
    })

    it('rejects manager self-edit attempts to change confidential access', async () => {
        await expect(
            updateUser({
                id: callerManagerId,
                can_access_confidential: true,
            } as never),
        ).rejects.toThrow(/confidential/i)

        expect(mocks.userUpdate).not.toHaveBeenCalled()
        expect(mocks.authUpdateUserById).not.toHaveBeenCalled()
    })
})

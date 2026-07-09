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

    it('rejects manager soft-delete of another existing manager before profile or Auth mutations', async () => {
        mocks.profiles[otherManagerId] = { id: otherManagerId, role: 'manager' }

        await expect(deleteUser(otherManagerId)).rejects.toThrow(/manager/i)

        expect(mocks.userUpdate).not.toHaveBeenCalled()
        expect(mocks.authUpdateUserById).not.toHaveBeenCalled()
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

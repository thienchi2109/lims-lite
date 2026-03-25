import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.fn()
const mockCreateAdminClient = vi.fn()
const mockRequireRole = vi.fn()
const mockIsAuthError = vi.fn()
const mockRevalidatePath = vi.fn()
const mockAuthGetUser = vi.fn()

const mockAssayInsert = vi.fn()
const mockAssayInsertSelect = vi.fn()
const mockAssayInsertSingle = vi.fn()
const mockAssayUpdate = vi.fn()
const mockAssayUpdateEq = vi.fn()
const mockAssayUpdateIs = vi.fn()
const mockAssayUpdateSelect = vi.fn()
const mockAssayUpdateSingle = vi.fn()

const mockUserInsert = vi.fn()
const mockUserUpdate = vi.fn()
const mockUserUpdateEq = vi.fn()
const mockAuthCreateUser = vi.fn()
const mockAuthDeleteUser = vi.fn()
const mockAuthUpdateUserById = vi.fn()
const mockUserSelect = vi.fn()
const mockUserSelectEq = vi.fn()
const mockUserSingle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
    createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}))

vi.mock('@/lib/auth-helpers', () => ({
    requireRole: (...args: unknown[]) => mockRequireRole(...args),
    isAuthError: (...args: unknown[]) => mockIsAuthError(...args),
}))

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

import { createAssayDefinition, updateAssayDefinition } from '@/app/actions/assay-mutations'
import { createUser, updateUser } from '@/app/actions/users'
import {
    AssayDefinitionSchema,
    CreateAssayDefinitionSchema,
    CreateUserSchema,
    UserSchema,
} from '@/types'

function buildAssayFormData(values: Record<string, string>) {
    const formData = new FormData()
    Object.entries(values).forEach(([key, value]) => formData.append(key, value))
    return formData
}

describe('confidentiality schemas', () => {
    it('preserves is_confidential in assay schemas', () => {
        const created = CreateAssayDefinitionSchema.parse({
            name: 'HIV Ag/Ab',
            is_confidential: true,
        })
        expect(() =>
            AssayDefinitionSchema.parse({
                id: '11111111-1111-4111-8111-111111111111',
                name: 'HIV Ag/Ab',
                specialty_id: null,
                units: null,
                validation_rules: {},
                created_at: '2026-03-25T00:00:00.000Z',
                updated_at: '2026-03-25T00:00:00.000Z',
                deleted_at: null,
            })
        ).toThrow()
        const assay = AssayDefinitionSchema.parse({
            id: '11111111-1111-4111-8111-111111111111',
            name: 'HIV Ag/Ab',
            specialty_id: null,
            units: null,
            validation_rules: {},
            created_at: '2026-03-25T00:00:00.000Z',
            updated_at: '2026-03-25T00:00:00.000Z',
            deleted_at: null,
            is_confidential: true,
        })

        expect(created.is_confidential).toBe(true)
        expect(assay.is_confidential).toBe(true)
    })

    it('preserves can_access_confidential in user schemas', () => {
        const created = CreateUserSchema.parse({
            username: 'manager1',
            full_name: 'Manager One',
            password: 'password123',
            role: 'manager',
            can_access_confidential: true,
        })
        const user = UserSchema.parse({
            id: '22222222-2222-4222-8222-222222222222',
            username: 'manager1',
            full_name: 'Manager One',
            role: 'manager',
            email: 'manager@example.com',
            lab: 'Central Lab',
            created_at: '2026-03-25T00:00:00.000Z',
            updated_at: '2026-03-25T00:00:00.000Z',
            deleted_at: null,
            can_access_confidential: true,
        })

        expect(created.can_access_confidential).toBe(true)
        expect(user.can_access_confidential).toBe(true)
    })
})

describe('confidentiality actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRequireRole.mockResolvedValue({ id: 'manager-1', role: 'manager' })
        mockIsAuthError.mockReturnValue(false)
        mockCreateClient.mockResolvedValue({
            from: mockFrom,
            auth: {
                getUser: mockAuthGetUser,
            },
        })
        mockCreateAdminClient.mockReturnValue({
            auth: {
                admin: {
                    createUser: mockAuthCreateUser,
                    deleteUser: mockAuthDeleteUser,
                    updateUserById: mockAuthUpdateUserById,
                },
            },
        })
    })

    const mockFrom = vi.fn((table: string) => {
        if (table === 'assay_definitions') {
            return {
                insert: mockAssayInsert,
                update: mockAssayUpdate,
            }
        }

        if (table === 'users') {
            return {
                insert: mockUserInsert,
                update: mockUserUpdate,
                select: mockUserSelect,
            }
        }

        throw new Error(`Unexpected table: ${table}`)
    })

    beforeEach(() => {
        mockAssayInsert.mockReturnValue({ select: mockAssayInsertSelect })
        mockAssayInsertSelect.mockReturnValue({ single: mockAssayInsertSingle })
        mockAssayInsertSingle.mockResolvedValue({
            data: {
                id: 'assay-1',
                name: 'HIV Ag/Ab',
                specialty_id: null,
                units: 'Index',
                validation_rules: {},
                created_at: '2026-03-25T00:00:00.000Z',
                updated_at: '2026-03-25T00:00:00.000Z',
                deleted_at: null,
                is_confidential: true,
            },
            error: null,
        })

        mockAssayUpdate.mockReturnValue({ eq: mockAssayUpdateEq })
        mockAssayUpdateEq.mockReturnValue({ is: mockAssayUpdateIs })
        mockAssayUpdateIs.mockReturnValue({ select: mockAssayUpdateSelect })
        mockAssayUpdateSelect.mockReturnValue({ single: mockAssayUpdateSingle })
        mockAssayUpdateSingle.mockResolvedValue({
            data: {
                id: 'assay-1',
                name: 'HIV Ag/Ab updated',
                specialty_id: null,
                units: 'Index',
                validation_rules: {},
                created_at: '2026-03-25T00:00:00.000Z',
                updated_at: '2026-03-25T00:00:00.000Z',
                deleted_at: null,
                is_confidential: true,
            },
            error: null,
        })

        mockUserInsert.mockResolvedValue({ error: null })
        mockUserUpdate.mockReturnValue({ eq: mockUserUpdateEq })
        mockUserUpdateEq.mockResolvedValue({ error: null })
        mockAuthCreateUser.mockResolvedValue({
            data: {
                user: {
                    id: 'user-1',
                },
            },
            error: null,
        })
        mockAuthDeleteUser.mockResolvedValue({ error: null })
        mockAuthUpdateUserById.mockResolvedValue({ error: null })
        mockUserSelect.mockReturnValue({ eq: mockUserSelectEq })
        mockUserSelectEq.mockReturnValue({ single: mockUserSingle })
        mockUserSingle.mockResolvedValue({
            data: {
                role: 'manager',
            },
            error: null,
        })
        mockAuthGetUser.mockResolvedValue({
            data: {
                user: {
                    id: '33333333-3333-4333-8333-333333333333',
                },
            },
        })
    })

    it('reads and writes is_confidential when creating assay definitions', async () => {
        const result = await createAssayDefinition(
            buildAssayFormData({
                name: 'HIV Ag/Ab',
                is_confidential: 'true',
            }),
        )

        expect(result).toEqual(
            expect.objectContaining({
                success: true,
            }),
        )
        expect(mockAssayInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                is_confidential: true,
            }),
        )
    })

    it('reads and writes is_confidential when updating assay definitions', async () => {
        const result = await updateAssayDefinition(
            buildAssayFormData({
                id: '11111111-1111-4111-8111-111111111111',
                name: 'HIV Ag/Ab updated',
                is_confidential: 'true',
            }),
        )

        expect(result).toEqual(
            expect.objectContaining({
                success: true,
            }),
        )
        expect(mockAssayUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                is_confidential: true,
            }),
        )
    })

    it('does not declassify assay definitions when update form omits is_confidential', async () => {
        const result = await updateAssayDefinition(
            buildAssayFormData({
                id: '11111111-1111-4111-8111-111111111111',
                name: 'HIV Ag/Ab updated',
            }),
        )

        expect(result).toEqual(
            expect.objectContaining({
                success: true,
            }),
        )

        const updatePayload = mockAssayUpdate.mock.calls[0][0]
        expect(updatePayload).not.toHaveProperty('is_confidential')
    })

    it('persists can_access_confidential when creating users', async () => {
        const result = await createUser({
            username: 'manager1',
            full_name: 'Manager One',
            password: 'password123',
            role: 'manager',
            email: 'manager@example.com',
            can_access_confidential: true,
        } as never)

        expect(result).toEqual(
            expect.objectContaining({
                success: true,
            }),
        )
        expect(mockUserInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                can_access_confidential: true,
            }),
        )
    })

    it('persists can_access_confidential when updating users', async () => {
        const result = await updateUser({
            id: '22222222-2222-4222-8222-222222222222',
            full_name: 'Manager One',
            can_access_confidential: true,
        } as never)

        expect(result).toEqual(
            expect.objectContaining({
                success: true,
            }),
        )
        expect(mockUserUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                can_access_confidential: true,
            }),
        )
    })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client, CreateClient } from '@/types'

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    getUserConfidentialAccess: vi.fn(),
    filterConfidentialAssociatedClients: vi.fn(),
    revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mocks.createClient(...args),
}))

vi.mock('@/lib/data/confidential-samples', () => ({
    getUserConfidentialAccess: (...args: unknown[]) =>
        mocks.getUserConfidentialAccess(...args),
}))

vi.mock('@/lib/data/confidential-clients', () => ({
    filterConfidentialAssociatedClients: (...args: unknown[]) =>
        mocks.filterConfidentialAssociatedClients(...args),
}))

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
}))

import { updateClient } from './clients'

const CLIENT_ID = '22222222-2222-4222-8222-222222222222'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const INVALID_CLIENT_ID_ERROR = 'ID khách hàng không hợp lệ'
const INVALID_CLIENT_UPDATE_ERROR =
    'Dữ liệu cập nhật hồ sơ khách hàng không hợp lệ'

const CLIENT: Client = {
    id: CLIENT_ID,
    id_card_num: '086094006827',
    name: 'Nguyễn Văn A',
    date_of_birth: '1994-09-21',
    gender: 'Nữ',
    phone: '0912345678',
    address: 'Cần Thơ',
    health_insurance_num: 'DN401010000001',
    expiry_date: '2027-12-31',
    created_at: '2026-08-22T00:00:00.000Z',
    updated_at: '2026-08-28T00:00:00.000Z',
}

const PROFILE_UPDATE: Partial<CreateClient> = {
    gender: 'Nữ',
    phone: '0912345678',
    address: 'Cần Thơ',
    health_insurance_num: 'DN401010000001',
    expiry_date: '2027-12-31',
}

function createUpdateHarness(role: string) {
    const usersQuery = {
        select: vi.fn(),
        eq: vi.fn(),
        single: vi.fn().mockResolvedValue({
            data: { role },
            error: null,
        }),
    }
    usersQuery.select.mockReturnValue(usersQuery)
    usersQuery.eq.mockReturnValue(usersQuery)

    const clientsQuery = {
        update: vi.fn(),
        eq: vi.fn(),
        select: vi.fn(),
        single: vi.fn().mockResolvedValue({
            data: CLIENT,
            error: null,
        }),
    }
    clientsQuery.update.mockReturnValue(clientsQuery)
    clientsQuery.eq.mockReturnValue(clientsQuery)
    clientsQuery.select.mockReturnValue(clientsQuery)

    const samplesQuery = {
        update: vi.fn(),
        eq: vi.fn().mockResolvedValue({ error: null }),
    }
    samplesQuery.update.mockReturnValue(samplesQuery)

    const from = vi.fn((table: string) => {
        if (table === 'users') return usersQuery
        if (table === 'clients') return clientsQuery
        if (table === 'samples') return samplesQuery
        throw new Error(`Unexpected table: ${table}`)
    })

    mocks.createClient.mockResolvedValue({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: {
                    user: { id: USER_ID },
                },
            }),
        },
        from,
    })

    return {
        from,
        usersEq: usersQuery.eq,
        clientsUpdate: clientsQuery.update,
        clientsEq: clientsQuery.eq,
        samplesUpdate: samplesQuery.update,
    }
}

async function expectDirectIdentityUpdateDenied(data: Partial<CreateClient>) {
    const {
        usersEq,
        clientsUpdate,
        clientsEq,
        samplesUpdate,
    } = createUpdateHarness('manager')

    const result = await updateClient(CLIENT_ID, data)

    expect(usersEq).toHaveBeenCalledTimes(1)
    expect(usersEq).toHaveBeenCalledWith('id', USER_ID)
    expect(clientsUpdate).not.toHaveBeenCalled()
    expect(clientsEq).not.toHaveBeenCalled()
    expect(samplesUpdate).not.toHaveBeenCalled()
    expect(result).toEqual({
        error:
            'Không thể cập nhật trực tiếp thông tin định danh; hãy dùng quy trình hiệu chỉnh danh tính',
    })
}

async function expectInvalidClientIdDenied(id: unknown) {
    const {
        usersEq,
        clientsUpdate,
        clientsEq,
        samplesUpdate,
    } = createUpdateHarness('manager')

    const result = await updateClient(id as string, PROFILE_UPDATE)

    expect(usersEq).toHaveBeenCalledTimes(1)
    expect(usersEq).toHaveBeenCalledWith('id', USER_ID)
    expect(clientsUpdate).not.toHaveBeenCalled()
    expect(clientsEq).not.toHaveBeenCalled()
    expect(samplesUpdate).not.toHaveBeenCalled()
    expect(result).toEqual({
        error: INVALID_CLIENT_ID_ERROR,
    })
}

async function expectInvalidProfilePayloadDenied(data: unknown) {
    const {
        usersEq,
        clientsUpdate,
        clientsEq,
        samplesUpdate,
    } = createUpdateHarness('manager')

    const result = await updateClient(CLIENT_ID, data)

    expect(usersEq).toHaveBeenCalledTimes(1)
    expect(usersEq).toHaveBeenCalledWith('id', USER_ID)
    expect(clientsUpdate).not.toHaveBeenCalled()
    expect(clientsEq).not.toHaveBeenCalled()
    expect(samplesUpdate).not.toHaveBeenCalled()
    expect(result).toEqual({
        error: INVALID_CLIENT_UPDATE_ERROR,
    })
}

describe('updateClient profile-only updates', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it.each(['analyst', 'manager'] as const)(
        'allows %s to update the five profile fields',
        async (role) => {
            const {
                from,
                usersEq,
                clientsUpdate,
                clientsEq,
                samplesUpdate,
            } = createUpdateHarness(role)

            const result = await updateClient(CLIENT_ID, PROFILE_UPDATE)

            expect(from).toHaveBeenCalledTimes(2)
            expect(from).toHaveBeenNthCalledWith(1, 'users')
            expect(from).toHaveBeenNthCalledWith(2, 'clients')
            expect(usersEq).toHaveBeenCalledTimes(1)
            expect(usersEq).toHaveBeenCalledWith('id', USER_ID)
            expect(clientsUpdate).toHaveBeenCalledTimes(1)
            expect(clientsUpdate).toHaveBeenCalledWith(PROFILE_UPDATE)
            expect(clientsEq).toHaveBeenCalledTimes(1)
            expect(clientsEq).toHaveBeenCalledWith('id', CLIENT_ID)
            expect(samplesUpdate).not.toHaveBeenCalled()
            expect(result).toEqual({ data: CLIENT })
        },
    )

    it('rejects roles outside analyst and manager before clients.update', async () => {
        const {
            from,
            usersEq,
            clientsUpdate,
            clientsEq,
        } = createUpdateHarness('doctor')

        const result = await updateClient(CLIENT_ID, PROFILE_UPDATE)

        expect(from).toHaveBeenCalledTimes(1)
        expect(from).toHaveBeenCalledWith('users')
        expect(usersEq).toHaveBeenCalledTimes(1)
        expect(usersEq).toHaveBeenCalledWith('id', USER_ID)
        expect(clientsUpdate).not.toHaveBeenCalled()
        expect(clientsEq).not.toHaveBeenCalled()
        expect(result).toEqual({
            error: 'Only analysts and managers can update clients',
        })
    })

    it('rejects a malformed client ID before Supabase clients.update', async () => {
        await expectInvalidClientIdDenied('not-a-uuid')
    })

    it('rejects a non-string client ID before Supabase clients.update', async () => {
        await expectInvalidClientIdDenied(42)
    })

    it('rejects a null update payload with a stable Vietnamese error', async () => {
        await expectInvalidProfilePayloadDenied(null)
    })

    it('rejects an array update payload with a stable Vietnamese error', async () => {
        await expectInvalidProfilePayloadDenied([PROFILE_UPDATE])
    })

    it('rejects a custom-prototype update payload', async () => {
        const customPrototypePayload = Object.assign(
            Object.create({ inherited: true }),
            { phone: '0987654321' },
        )

        await expectInvalidProfilePayloadDenied(customPrototypePayload)
    })

    it('rejects an empty update payload', async () => {
        await expectInvalidProfilePayloadDenied({})
    })

    it('rejects an arbitrary-key-only update payload', async () => {
        await expectInvalidProfilePayloadDenied({
            unexpected_field: 'unexpected value',
        })
    })

    it('normalizes empty nullable profile fields before clients.update', async () => {
        const {
            clientsUpdate,
            clientsEq,
            samplesUpdate,
        } = createUpdateHarness('manager')

        const result = await updateClient(CLIENT_ID, {
            address: '',
            health_insurance_num: '',
            expiry_date: '',
        })

        expect(clientsUpdate).toHaveBeenCalledTimes(1)
        expect(clientsUpdate).toHaveBeenCalledWith({
            address: null,
            health_insurance_num: null,
            expiry_date: null,
        })
        expect(clientsEq).toHaveBeenCalledTimes(1)
        expect(clientsEq).toHaveBeenCalledWith('id', CLIENT_ID)
        expect(samplesUpdate).not.toHaveBeenCalled()
        expect(result).toEqual({ data: CLIENT })
    })

    it('rejects id_card_num before Supabase clients.update', async () => {
        await expectDirectIdentityUpdateDenied({
            id_card_num: '079123456789',
        })
    })

    it('rejects name before Supabase clients.update', async () => {
        await expectDirectIdentityUpdateDenied({
            name: 'Trần Thị B',
        })
    })

    it('rejects date_of_birth before Supabase clients.update', async () => {
        await expectDirectIdentityUpdateDenied({
            date_of_birth: '1988-03-04',
        })
    })

    it('rejects mixed phone and id_card_num without applying the phone update', async () => {
        await expectDirectIdentityUpdateDenied({
            phone: '0987654321',
            id_card_num: '079123456789',
        })
    })

    it('rejects mixed address and name without applying the address update', async () => {
        await expectDirectIdentityUpdateDenied({
            address: 'Hậu Giang',
            name: 'Trần Thị B',
        })
    })

    it('rejects mixed insurance and date_of_birth without applying the insurance update', async () => {
        await expectDirectIdentityUpdateDenied({
            health_insurance_num: 'HG401010000002',
            date_of_birth: '1988-03-04',
        })
    })
})

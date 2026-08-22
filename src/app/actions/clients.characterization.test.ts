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

import {
    findClientByIdentity,
    findClientByPhone,
    upsertClient,
} from './clients'

const CLIENT_INPUT: CreateClient = {
    id_card_num: '086094006827',
    name: 'Nguyễn Văn A',
    date_of_birth: '1994-09-21',
    gender: 'Nam',
    phone: '0901234567',
    address: 'Cần Thơ',
    health_insurance_num: 'DN401010000001',
    expiry_date: '2027-12-31',
}

const CLIENT: Client = {
    id: '22222222-2222-4222-8222-222222222222',
    ...CLIENT_INPUT,
    created_at: '2026-08-22T00:00:00.000Z',
    updated_at: '2026-08-22T00:00:00.000Z',
}

function createQuery(result: unknown) {
    const query = {
        select: vi.fn(),
        eq: vi.fn(),
        upsert: vi.fn(),
        single: vi.fn(async () => result),
    }

    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.upsert.mockReturnValue(query)

    return query
}

function mockAuthenticatedClient(from: ReturnType<typeof vi.fn>) {
    const supabase = {
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: {
                    user: {
                        id: '11111111-1111-4111-8111-111111111111',
                    },
                },
            }),
        },
        from,
    }
    mocks.createClient.mockResolvedValue(supabase)
    return supabase
}

describe('legacy client matching characterization', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getUserConfidentialAccess.mockResolvedValue({
            canAccessConfidential: true,
            error: null,
        })
        mocks.filterConfidentialAssociatedClients.mockImplementation(
            async (clients: Client[]) => ({
                data: clients,
            }),
        )
    })

    it('matches identity by trimmed raw name and exact date of birth', async () => {
        const query = createQuery({
            data: CLIENT,
            error: null,
        })
        const from = vi.fn(() => query)
        const supabase = mockAuthenticatedClient(from)

        const result = await findClientByIdentity(
            `  ${CLIENT.name}  `,
            CLIENT.date_of_birth,
        )

        expect(result).toEqual({ data: CLIENT })
        expect(from).toHaveBeenCalledWith('clients')
        expect(query.eq).toHaveBeenNthCalledWith(1, 'name', CLIENT.name)
        expect(query.eq).toHaveBeenNthCalledWith(
            2,
            'date_of_birth',
            CLIENT.date_of_birth,
        )
        expect(mocks.getUserConfidentialAccess).toHaveBeenCalledWith(
            '11111111-1111-4111-8111-111111111111',
            supabase,
        )
        expect(
            mocks.filterConfidentialAssociatedClients,
        ).toHaveBeenCalledWith([CLIENT], true, 'Failed to find client')
    })

    it.each([
        ['', CLIENT.date_of_birth, 'Tên là bắt buộc'],
        [CLIENT.name, '21/09/1994', 'Ngày sinh không hợp lệ'],
    ])(
        'preserves Vietnamese identity validation errors',
        async (name, dateOfBirth, expectedError) => {
            const from = vi.fn()
            mockAuthenticatedClient(from)

            const result = await findClientByIdentity(name, dateOfBirth)

            expect(result).toEqual({ error: expectedError })
            expect(from).not.toHaveBeenCalled()
        },
    )

    it('matches phone by trimmed raw value without canonical conversion', async () => {
        const query = createQuery({
            data: CLIENT,
            error: null,
        })
        const from = vi.fn(() => query)
        const supabase = mockAuthenticatedClient(from)

        const result = await findClientByPhone(`  ${CLIENT.phone}  `)

        expect(result).toEqual({ data: CLIENT })
        expect(query.eq).toHaveBeenCalledWith('phone', CLIENT.phone)
        expect(mocks.getUserConfidentialAccess).toHaveBeenCalledWith(
            '11111111-1111-4111-8111-111111111111',
            supabase,
        )
        expect(
            mocks.filterConfidentialAssociatedClients,
        ).toHaveBeenCalledWith([CLIENT], true, 'Failed to find client')
    })

    it('keeps the placeholder phone excluded from lookup', async () => {
        const from = vi.fn()
        mockAuthenticatedClient(from)

        const result = await findClientByPhone('0000000000')

        expect(result).toEqual({ data: null })
        expect(from).not.toHaveBeenCalled()
    })

    it('returns confidentiality-filtered output instead of raw lookup matches', async () => {
        const identityQuery = createQuery({ data: CLIENT, error: null })
        const phoneQuery = createQuery({ data: CLIENT, error: null })
        const from = vi
            .fn()
            .mockReturnValueOnce(identityQuery)
            .mockReturnValueOnce(phoneQuery)
        mockAuthenticatedClient(from)
        mocks.filterConfidentialAssociatedClients.mockResolvedValue({
            data: [],
        })

        const identityResult = await findClientByIdentity(
            CLIENT.name,
            CLIENT.date_of_birth,
        )
        const phoneResult = await findClientByPhone(CLIENT.phone)

        expect(identityResult).toEqual({ data: null })
        expect(phoneResult).toEqual({ data: null })
        expect(
            mocks.filterConfidentialAssociatedClients,
        ).toHaveBeenNthCalledWith(
            1,
            [CLIENT],
            true,
            'Failed to find client',
        )
        expect(
            mocks.filterConfidentialAssociatedClients,
        ).toHaveBeenNthCalledWith(
            2,
            [CLIENT],
            true,
            'Failed to find client',
        )
    })
})

describe('legacy client upsert characterization', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('upserts all legacy fields on raw name and date-of-birth conflict', async () => {
        const phoneQuery = createQuery({
            data: null,
            error: {
                code: 'PGRST116',
            },
        })
        const upsertQuery = createQuery({
            data: CLIENT,
            error: null,
        })
        const from = vi.fn()
            .mockReturnValueOnce(phoneQuery)
            .mockReturnValueOnce(upsertQuery)
        mockAuthenticatedClient(from)

        const result = await upsertClient(CLIENT_INPUT)

        expect(result).toEqual({ data: CLIENT })
        expect(phoneQuery.eq).toHaveBeenCalledWith('phone', CLIENT_INPUT.phone)
        expect(upsertQuery.upsert).toHaveBeenCalledWith(
            {
                ...CLIENT_INPUT,
            },
            {
                onConflict: 'name,date_of_birth',
                ignoreDuplicates: false,
            },
        )
        expect(mocks.revalidatePath).toHaveBeenNthCalledWith(
            1,
            '/analyst/accession',
        )
        expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, '/samples')
    })

    it('returns the current Vietnamese phone collision contract', async () => {
        const existingClient = {
            id: '33333333-3333-4333-8333-333333333333',
            name: 'Trần Văn B',
            date_of_birth: '1980-01-02',
        }
        const phoneQuery = createQuery({
            data: existingClient,
            error: null,
        })
        const from = vi.fn(() => phoneQuery)
        mockAuthenticatedClient(from)

        const result = await upsertClient(CLIENT_INPUT)

        expect(result).toEqual({
            error: `Số điện thoại ${CLIENT_INPUT.phone} đã được sử dụng bởi khách hàng "${existingClient.name}". Vui lòng sử dụng số điện thoại khác hoặc chọn khách hàng hiện có.`,
            existingClient,
        })
        expect(from).toHaveBeenCalledTimes(1)
        expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })

    it('rejects unauthenticated upserts before database access', async () => {
        const from = vi.fn()
        mocks.createClient.mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: {
                        user: null,
                    },
                }),
            },
            from,
        })

        const result = await upsertClient(CLIENT_INPUT)

        expect(result).toEqual({ error: 'Unauthorized' })
        expect(from).not.toHaveBeenCalled()
    })
})

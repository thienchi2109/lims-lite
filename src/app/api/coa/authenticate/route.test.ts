import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateAdminClient = vi.fn()
const mockCheckRateLimit = vi.fn()
const mockRecordAuthAttempt = vi.fn()
const mockNormalizePhoneVN = vi.fn()
const mockIsValidVietnamesePhone = vi.fn()
const mockCreateCoAToken = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}))

vi.mock('@/lib/coa-auth', () => ({
    normalizePhoneVN: (...args: unknown[]) => mockNormalizePhoneVN(...args),
    isValidVietnamesePhone: (...args: unknown[]) => mockIsValidVietnamesePhone(...args),
    checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
    recordAuthAttempt: (...args: unknown[]) => mockRecordAuthAttempt(...args),
}))

vi.mock('@/lib/jwt', () => ({
    createCoAToken: (...args: unknown[]) => mockCreateCoAToken(...args),
}))

import { POST } from './route'

type QueryResult = {
    data: unknown
    error: { code?: string; message: string } | null
}

function createThenableQuery(result: QueryResult) {
    const query: Record<string, unknown> = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        is: vi.fn(() => query),
        in: vi.fn(() => query),
        order: vi.fn(() => query),
        single: vi.fn(async () => result),
        maybeSingle: vi.fn(async () => result),
        insert: vi.fn(async () => ({ data: null, error: null })),
        then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(onFulfilled, onRejected),
    }

    return query
}

function createRequest() {
    return {
        url: 'http://localhost/api/coa/authenticate',
        headers: new Headers({
            'content-type': 'application/json',
            'user-agent': 'vitest',
        }),
        json: vi.fn(async () => ({
            phone: '0987654321',
        })),
    } as unknown as import('next/server').NextRequest
}

function mockAuthenticateRoute() {
    mockCheckRateLimit.mockReturnValue({
        blocked: false,
    })
    mockIsValidVietnamesePhone.mockReturnValue(true)
    mockNormalizePhoneVN.mockReturnValue('0987654321')
    mockCreateCoAToken.mockResolvedValue('coa-token')
    mockRecordAuthAttempt.mockReturnValue(undefined)

    const mockAccessLogInsert = vi.fn().mockResolvedValue({ data: null, error: null })

    mockCreateAdminClient.mockReturnValue({
        from: (table: string) => {
            if (table === 'clients') {
                return createThenableQuery({
                    data: {
                        id: 'client-1',
                        name: 'Nguyen Van A',
                        phone: '0987654321',
                    },
                    error: null,
                })
            }

            if (table === 'samples') {
                return createThenableQuery({
                    data: [
                        {
                            id: 'public-sample',
                            sample_id: 'COA-PUBLIC-001',
                            type: 'Máu',
                            received_at: '2026-03-26T08:00:00.000Z',
                        },
                        {
                            id: 'conf-sample',
                            sample_id: 'COA-CONF-001',
                            type: 'Máu',
                            received_at: '2026-03-26T09:00:00.000Z',
                        },
                    ],
                    error: null,
                })
            }

            if (table === 'coa_reports') {
                return createThenableQuery({
                    data: [
                        { sample_id: 'public-sample' },
                        { sample_id: 'conf-sample' },
                    ],
                    error: null,
                })
            }

            if (table === 'results') {
                return createThenableQuery({
                    data: [
                        {
                            sample_id: 'conf-sample',
                            assay: { is_confidential: true },
                        },
                    ],
                    error: null,
                })
            }

            if (table === 'coa_access_log') {
                return {
                    insert: mockAccessLogInsert,
                }
            }

            throw new Error(`Unexpected admin table: ${table}`)
        },
    })
}

describe('public CoA authenticate confidentiality', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('excludes confidential CoAs from the authenticated sample list', async () => {
        mockAuthenticateRoute()

        const response = await POST(createRequest())
        const body = (await response.json()) as {
            success: boolean
            samples: Array<{ id: string; has_coa: boolean }>
        }

        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.samples).toEqual([
            expect.objectContaining({
                id: 'public-sample',
                has_coa: true,
            }),
        ])
    })
})

/**
 * Locks the shared staff CoA authorization and report-loading contract.
 * Route-level tests separately preserve the existing HTTP responses.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUserConfidentialAccess = vi.fn()
const mockIsConfidentialAssociatedSample = vi.fn()

vi.mock('@/lib/data/confidential-samples', () => ({
    getUserConfidentialAccess: (...args: unknown[]) =>
        mockGetUserConfidentialAccess(...args),
    isConfidentialAssociatedSample: (...args: unknown[]) =>
        mockIsConfidentialAssociatedSample(...args),
}))

import {
    loadAuthorizedStaffCoA,
    type StaffCoAAccessClient,
} from './staff-access'

type QueryResult = {
    data: unknown
    error: { message: string } | null
}

type QueryMock = {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    is: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
}

function createQuery(result: QueryResult): QueryMock {
    const query = {} as QueryMock
    query.select = vi.fn(() => query)
    query.eq = vi.fn(() => query)
    query.is = vi.fn(() => query)
    query.order = vi.fn(() => query)
    query.limit = vi.fn(() => query)
    query.single = vi.fn(async () => result)
    return query
}

function createStaffAccessClient({
    authenticated = true,
    role = 'analyst',
    sampleStatus = 'completed',
    reportReady = true,
}: {
    authenticated?: boolean
    role?: string
    sampleStatus?: string
    reportReady?: boolean
} = {}) {
    const usersQuery = createQuery({
        data: { role },
        error: null,
    })
    const samplesQuery = createQuery({
        data: {
            id: 'sample-uuid',
            sample_id: 'XN-2026-0001',
            status: sampleStatus,
        },
        error: null,
    })
    const reportsQuery = createQuery({
        data: reportReady
            ? {
                  id: 'report-uuid',
                  file_path: 'sample-uuid/report.html',
                  file_hash:
                      'd2a84f4b8b650937ec8f73cd8be2c74a1795db202e720dcd6e9d54f3f77f2a4f',
                  generated_at: '2026-07-19T17:30:00.000Z',
                  version: 3,
              }
            : null,
        error: reportReady ? null : { message: 'Not found' },
    })
    const from = vi.fn((table: string) => {
        if (table === 'users') {
            return usersQuery
        }
        if (table === 'samples') {
            return samplesQuery
        }
        if (table === 'coa_reports') {
            return reportsQuery
        }
        throw new Error(`Unexpected table: ${table}`)
    })
    const client = {
        auth: {
            getUser: vi.fn().mockResolvedValue(
                authenticated
                    ? {
                          data: { user: { id: 'staff-uuid' } },
                          error: null,
                      }
                    : {
                          data: { user: null },
                          error: { message: 'No session' },
                      },
            ),
        },
        from,
    } as unknown as StaffCoAAccessClient

    return {
        client,
        from,
        reportsQuery,
        samplesQuery,
    }
}

describe('loadAuthorizedStaffCoA', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetUserConfidentialAccess.mockResolvedValue({
            canAccessConfidential: false,
            role: 'analyst',
        })
        mockIsConfidentialAssociatedSample.mockResolvedValue({
            data: false,
        })
    })

    it.each(['analyst', 'manager', 'doctor'])(
        'returns the latest ready report metadata for authorized %s staff',
        async (role) => {
            const { client, reportsQuery, samplesQuery } =
                createStaffAccessClient({ role })

            const result = await loadAuthorizedStaffCoA(
                client,
                'sample-uuid',
            )

            expect(result).toEqual({
                ok: true,
                userId: 'staff-uuid',
                sample: {
                    id: 'sample-uuid',
                    sampleId: 'XN-2026-0001',
                },
                report: {
                    id: 'report-uuid',
                    filePath: 'sample-uuid/report.html',
                    fileHash:
                        'd2a84f4b8b650937ec8f73cd8be2c74a1795db202e720dcd6e9d54f3f77f2a4f',
                    generatedAt: '2026-07-19T17:30:00.000Z',
                    version: 3,
                },
            })
            expect(samplesQuery.eq).toHaveBeenCalledWith(
                'id',
                'sample-uuid',
            )
            expect(samplesQuery.is).toHaveBeenCalledWith(
                'deleted_at',
                null,
            )
            expect(reportsQuery.eq).toHaveBeenCalledWith(
                'sample_id',
                'sample-uuid',
            )
            expect(reportsQuery.eq).toHaveBeenCalledWith('status', 'ready')
            expect(reportsQuery.is).toHaveBeenCalledWith(
                'deleted_at',
                null,
            )
            expect(reportsQuery.order).toHaveBeenCalledWith('version', {
                ascending: false,
            })
            expect(reportsQuery.limit).toHaveBeenCalledWith(1)
        },
    )

    it('rejects requests without an authenticated Supabase user', async () => {
        const { client, from } = createStaffAccessClient({
            authenticated: false,
        })

        const result = await loadAuthorizedStaffCoA(client, 'sample-uuid')

        expect(result).toEqual({
            ok: false,
            reason: 'unauthenticated',
        })
        expect(from).not.toHaveBeenCalled()
    })

    it('rejects roles outside the staff CoA allowlist', async () => {
        const { client, from } = createStaffAccessClient({
            role: 'receptionist',
        })

        const result = await loadAuthorizedStaffCoA(client, 'sample-uuid')

        expect(result).toEqual({
            ok: false,
            reason: 'role-forbidden',
        })
        expect(from).toHaveBeenCalledTimes(1)
    })

    it('conceals confidential-associated samples from unauthorized staff', async () => {
        const { client, from } = createStaffAccessClient()
        mockIsConfidentialAssociatedSample.mockResolvedValue({
            data: true,
        })

        const result = await loadAuthorizedStaffCoA(client, 'sample-uuid')

        expect(result).toEqual({
            ok: false,
            reason: 'not-found',
        })
        expect(from).toHaveBeenCalledTimes(1)
    })

    it('rejects samples that are not completed before loading a report', async () => {
        const { client, from } = createStaffAccessClient({
            sampleStatus: 'processing',
        })

        const result = await loadAuthorizedStaffCoA(client, 'sample-uuid')

        expect(result).toEqual({
            ok: false,
            reason: 'sample-not-completed',
        })
        expect(from).toHaveBeenCalledTimes(2)
    })

    it('rejects a completed sample without a ready CoA report', async () => {
        const { client } = createStaffAccessClient({
            reportReady: false,
        })

        const result = await loadAuthorizedStaffCoA(client, 'sample-uuid')

        expect(result).toEqual({
            ok: false,
            reason: 'report-not-ready',
        })
    })
})

/**
 * Locks client identity resolution before narrowly scoped service-role access.
 * HTTP routes separately map typed failures and own audit/response behavior.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockVerifyCoAToken = vi.fn()
const mockIsTokenExpired = vi.fn()
const mockIsConfidentialAssociatedSample = vi.fn()

vi.mock('@/lib/jwt', () => ({
    verifyCoAToken: (...args: unknown[]) => mockVerifyCoAToken(...args),
    isTokenExpired: (...args: unknown[]) => mockIsTokenExpired(...args),
}))

vi.mock('@/lib/data/confidential-samples', () => ({
    isConfidentialAssociatedSample: (...args: unknown[]) =>
        mockIsConfidentialAssociatedSample(...args),
}))

import {
    loadAuthorizedClientCoA,
    resolveClientCoAIdentity,
    type ClientCoAAccessClient,
} from './client-access'

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
    maybeSingle: ReturnType<typeof vi.fn>
}

function createQuery(result: QueryResult): QueryMock {
    const query = {} as QueryMock
    query.select = vi.fn(() => query)
    query.eq = vi.fn(() => query)
    query.is = vi.fn(() => query)
    query.order = vi.fn(() => query)
    query.limit = vi.fn(() => query)
    query.single = vi.fn(async () => result)
    query.maybeSingle = vi.fn(async () => result)
    return query
}

function createRequest(options: {
    bearerToken?: string
    cookieToken?: string
} = {}) {
    return {
        headers: new Headers(
            options.bearerToken
                ? { authorization: `Bearer ${options.bearerToken}` }
                : {},
        ),
        cookies: {
            get: vi.fn((name: string) =>
                name === 'coa_token' && options.cookieToken
                    ? { value: options.cookieToken }
                    : undefined,
            ),
        },
    }
}

function createAccessClient({
    sampleFound = true,
    sampleClientId = 'client-1',
    sampleStatus = 'completed',
    confidential = false,
    confidentialError = false,
    reportReady = true,
}: {
    sampleFound?: boolean
    sampleClientId?: string
    sampleStatus?: string
    confidential?: boolean
    confidentialError?: boolean
    reportReady?: boolean
} = {}) {
    const samplesQuery = createQuery({
        data: sampleFound
            ? {
                  id: 'sample-uuid',
                  sample_id: 'XN-2026-0001',
                  client_id: sampleClientId,
                  status: sampleStatus,
              }
            : null,
        error: sampleFound ? null : { message: 'Not found' },
    })
    const resultsQuery = createQuery({
        data: confidential ? { sample_id: 'sample-uuid' } : null,
        error: confidentialError
            ? { message: 'sensitive database error' }
            : null,
    })
    const reportsQuery = createQuery({
        data: reportReady
            ? {
                  id: 'report-uuid',
                  file_path: 'sample-uuid/report.html',
                  file_hash: 'released-html-hash',
                  generated_at: '2026-07-19T17:30:00.000Z',
                  version: 4,
              }
            : null,
        error: reportReady ? null : { message: 'Not found' },
    })
    const from = vi.fn((table: string) => {
        if (table === 'samples') {
            return samplesQuery
        }
        if (table === 'results') {
            return resultsQuery
        }
        if (table === 'coa_reports') {
            return reportsQuery
        }
        throw new Error(`Unexpected table: ${table}`)
    })

    return {
        client: { from } as unknown as ClientCoAAccessClient,
        from,
        reportsQuery,
        resultsQuery,
        samplesQuery,
    }
}

describe('resolveClientCoAIdentity', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockVerifyCoAToken.mockResolvedValue({
            client_id: 'client-1',
            exp: 2_000_000_000,
        })
        mockIsTokenExpired.mockReturnValue(false)
    })

    it('prefers a Bearer token over the CoA cookie', async () => {
        const result = await resolveClientCoAIdentity(
            createRequest({
                bearerToken: 'header-token',
                cookieToken: 'cookie-token',
            }),
        )

        expect(result).toEqual({
            ok: true,
            clientId: 'client-1',
        })
        expect(mockVerifyCoAToken).toHaveBeenCalledWith('header-token')
    })

    it('accepts the CoA cookie when no Bearer token is present', async () => {
        const result = await resolveClientCoAIdentity(
            createRequest({ cookieToken: 'cookie-token' }),
        )

        expect(result).toEqual({
            ok: true,
            clientId: 'client-1',
        })
        expect(mockVerifyCoAToken).toHaveBeenCalledWith('cookie-token')
    })

    it('rejects a missing token without attempting verification', async () => {
        const result = await resolveClientCoAIdentity(createRequest())

        expect(result).toEqual({
            ok: false,
            reason: 'missing-token',
        })
        expect(mockVerifyCoAToken).not.toHaveBeenCalled()
    })

    it('rejects an invalid token', async () => {
        mockVerifyCoAToken.mockRejectedValue(new Error('sensitive JWT error'))

        const result = await resolveClientCoAIdentity(
            createRequest({ bearerToken: 'invalid-token' }),
        )

        expect(result).toEqual({
            ok: false,
            reason: 'invalid-token',
        })
    })

    it('rejects an expired token', async () => {
        mockIsTokenExpired.mockReturnValue(true)

        const result = await resolveClientCoAIdentity(
            createRequest({ bearerToken: 'expired-token' }),
        )

        expect(result).toEqual({
            ok: false,
            reason: 'expired-token',
        })
    })
})

describe('loadAuthorizedClientCoA', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsConfidentialAssociatedSample.mockImplementation(() => {
            throw new Error('Legacy confidential helper must not be called')
        })
    })

    it('loads only the requested completed sample and latest ready report', async () => {
        const { client, reportsQuery, resultsQuery, samplesQuery } =
            createAccessClient()

        const result = await loadAuthorizedClientCoA(
            client,
            'client-1',
            'sample-uuid',
        )

        expect(result).toEqual({
            ok: true,
            clientId: 'client-1',
            sample: {
                id: 'sample-uuid',
                sampleId: 'XN-2026-0001',
            },
            report: {
                id: 'report-uuid',
                filePath: 'sample-uuid/report.html',
                fileHash: 'released-html-hash',
                generatedAt: '2026-07-19T17:30:00.000Z',
                version: 4,
            },
        })
        expect(samplesQuery.eq).toHaveBeenCalledWith('id', 'sample-uuid')
        expect(samplesQuery.is).toHaveBeenCalledWith('deleted_at', null)
        expect(resultsQuery.eq).toHaveBeenCalledWith(
            'sample_id',
            'sample-uuid',
        )
        expect(resultsQuery.eq).toHaveBeenCalledWith(
            'assay.is_confidential',
            true,
        )
        expect(resultsQuery.limit).toHaveBeenCalledWith(1)
        expect(reportsQuery.eq).toHaveBeenCalledWith(
            'sample_id',
            'sample-uuid',
        )
        expect(reportsQuery.eq).toHaveBeenCalledWith('status', 'ready')
        expect(reportsQuery.is).toHaveBeenCalledWith('deleted_at', null)
        expect(reportsQuery.order).toHaveBeenCalledWith('version', {
            ascending: false,
        })
        expect(reportsQuery.limit).toHaveBeenCalledWith(1)
    })

    it('returns no resolved sample id when the requested sample does not exist', async () => {
        const { client, from } = createAccessClient({ sampleFound: false })

        const result = await loadAuthorizedClientCoA(
            client,
            'client-1',
            'unknown-sample',
        )

        expect(result).toEqual({
            ok: false,
            clientId: 'client-1',
            sampleId: null,
            reason: 'sample-not-found',
        })
        expect(from).toHaveBeenCalledTimes(1)
    })

    it.each([
        [
            'rejects a sample owned by another client',
            { sampleClientId: 'client-2' },
            'ownership-forbidden',
            1,
        ],
        [
            'conceals a confidential-associated sample',
            { confidential: true },
            'not-found',
            2,
        ],
        [
            'fails closed when the confidential lookup fails',
            { confidentialError: true },
            'confidential-check-failed',
            2,
        ],
        [
            'rejects an incomplete sample',
            { sampleStatus: 'processing' },
            'sample-not-completed',
            2,
        ],
        [
            'rejects a missing ready report',
            { reportReady: false },
            'report-not-ready',
            3,
        ],
    ] as const)('%s', async (_name, options, reason, queryCount) => {
        const { client, from } = createAccessClient(options)

        const result = await loadAuthorizedClientCoA(
            client,
            'client-1',
            'sample-uuid',
        )

        expect(result).toEqual({
            ok: false,
            clientId: 'client-1',
            sampleId: 'sample-uuid',
            reason,
        })
        expect(mockIsConfidentialAssociatedSample).not.toHaveBeenCalled()
        expect(from).toHaveBeenCalledTimes(queryCount)
    })
})

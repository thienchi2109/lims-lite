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
    sampleClientId = 'client-1',
    sampleStatus = 'completed',
    reportReady = true,
}: {
    sampleClientId?: string
    sampleStatus?: string
    reportReady?: boolean
} = {}) {
    const samplesQuery = createQuery({
        data: {
            id: 'sample-uuid',
            sample_id: 'XN-2026-0001',
            client_id: sampleClientId,
            status: sampleStatus,
        },
        error: null,
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
        if (table === 'coa_reports') {
            return reportsQuery
        }
        throw new Error(`Unexpected table: ${table}`)
    })

    return {
        client: { from } as unknown as ClientCoAAccessClient,
        from,
        reportsQuery,
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
        mockIsConfidentialAssociatedSample.mockResolvedValue({ data: false })
    })

    it('loads only the requested completed sample and latest ready report', async () => {
        const { client, reportsQuery, samplesQuery } = createAccessClient()

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

    it('rejects a sample owned by another client before confidential lookup', async () => {
        const { client, from } = createAccessClient({
            sampleClientId: 'client-2',
        })

        const result = await loadAuthorizedClientCoA(
            client,
            'client-1',
            'sample-uuid',
        )

        expect(result).toEqual({
            ok: false,
            clientId: 'client-1',
            reason: 'ownership-forbidden',
        })
        expect(mockIsConfidentialAssociatedSample).not.toHaveBeenCalled()
        expect(from).toHaveBeenCalledTimes(1)
    })

    it('conceals confidential-associated samples before report lookup', async () => {
        const { client, from } = createAccessClient()
        mockIsConfidentialAssociatedSample.mockResolvedValue({ data: true })

        const result = await loadAuthorizedClientCoA(
            client,
            'client-1',
            'sample-uuid',
        )

        expect(result).toEqual({
            ok: false,
            clientId: 'client-1',
            reason: 'not-found',
        })
        expect(from).toHaveBeenCalledTimes(1)
    })

    it('fails closed when confidential association lookup fails', async () => {
        const { client, from } = createAccessClient()
        mockIsConfidentialAssociatedSample.mockRejectedValue(
            new Error('sensitive database error'),
        )

        const result = await loadAuthorizedClientCoA(
            client,
            'client-1',
            'sample-uuid',
        )

        expect(result).toEqual({
            ok: false,
            clientId: 'client-1',
            reason: 'confidential-check-failed',
        })
        expect(from).toHaveBeenCalledTimes(1)
    })

    it('rejects incomplete samples before report lookup', async () => {
        const { client, from } = createAccessClient({
            sampleStatus: 'processing',
        })

        const result = await loadAuthorizedClientCoA(
            client,
            'client-1',
            'sample-uuid',
        )

        expect(result).toEqual({
            ok: false,
            clientId: 'client-1',
            reason: 'sample-not-completed',
        })
        expect(from).toHaveBeenCalledTimes(1)
    })

    it('rejects when the requested sample has no ready report', async () => {
        const { client } = createAccessClient({ reportReady: false })

        const result = await loadAuthorizedClientCoA(
            client,
            'client-1',
            'sample-uuid',
        )

        expect(result).toEqual({
            ok: false,
            clientId: 'client-1',
            reason: 'report-not-ready',
        })
    })
})

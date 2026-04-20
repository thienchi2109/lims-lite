import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.hoisted(() => vi.fn())
const mockGetUserConfidentialAccess = vi.hoisted(() => vi.fn())
const mockIsConfidentialAssociatedSample = vi.hoisted(() => vi.fn())
const mockGetActiveSignature = vi.hoisted(() => vi.fn())
const mockDownloadSignature = vi.hoisted(() => vi.fn())
const mockFetchSampleWithApprover = vi.hoisted(() => vi.fn())
const mockFetchTestingDate = vi.hoisted(() => vi.fn())
const mockFetchTestResults = vi.hoisted(() => vi.fn())
const mockGenerateHtmlHash = vi.hoisted(() => vi.fn())
const mockValidateSampleForCoAGeneration = vi.hoisted(() => vi.fn())
const mockFetchLatestSubmission = vi.hoisted(() => vi.fn())
const mockFetchSignatureDataUri = vi.hoisted(() => vi.fn())
const mockRenderCoATemplate = vi.hoisted(() => vi.fn())
const mockGetCoAStampDataUri = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

vi.mock('@/lib/data/confidential-samples', () => ({
    getUserConfidentialAccess: (...args: unknown[]) =>
        mockGetUserConfidentialAccess(...args),
    isConfidentialAssociatedSample: (...args: unknown[]) =>
        mockIsConfidentialAssociatedSample(...args),
}))

vi.mock('@/app/actions/signatures', () => ({
    getActiveSignature: (...args: unknown[]) => mockGetActiveSignature(...args),
    downloadSignature: (...args: unknown[]) => mockDownloadSignature(...args),
}))

vi.mock('@/lib/coa/helpers', () => ({
    fetchSampleWithApprover: (...args: unknown[]) =>
        mockFetchSampleWithApprover(...args),
    fetchTestingDate: (...args: unknown[]) => mockFetchTestingDate(...args),
    fetchTestResults: (...args: unknown[]) => mockFetchTestResults(...args),
    generateHtmlHash: (...args: unknown[]) => mockGenerateHtmlHash(...args),
    validateSampleForCoAGeneration: (...args: unknown[]) =>
        mockValidateSampleForCoAGeneration(...args),
    fetchLatestSubmission: (...args: unknown[]) => mockFetchLatestSubmission(...args),
    fetchSignatureDataUri: (...args: unknown[]) =>
        mockFetchSignatureDataUri(...args),
}))

vi.mock('@/lib/coa/template', () => ({
    renderCoATemplate: (...args: unknown[]) => mockRenderCoATemplate(...args),
}))

vi.mock('@/lib/coa/stamp', () => ({
    getCoAStampDataUri: (...args: unknown[]) => mockGetCoAStampDataUri(...args),
}))

import { generateCoA } from './coa'

type QueryResult = {
    data: unknown
    error: { message: string } | null
}

function createThenableQuery(result: QueryResult) {
    const query: Record<string, unknown> = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        is: vi.fn(() => query),
        maybeSingle: vi.fn(async () => result),
        single: vi.fn(async () => result),
        then: (
            onFulfilled: (value: QueryResult) => unknown,
            onRejected?: (reason: unknown) => unknown,
        ) => Promise.resolve(result).then(onFulfilled, onRejected),
    }

    return query
}

function mockSuccessfulClient() {
    const userResults: QueryResult[] = [
        { data: { role: 'analyst' }, error: null },
        { data: { full_name: 'Nguyễn Quản Lý' }, error: null },
    ]

    const from = vi.fn((table: string) => {
        if (table === 'users') {
            const result = userResults.shift()
            if (!result) throw new Error('Unexpected users query')
            return createThenableQuery(result)
        }

        if (table === 'coa_reports') {
            return {
                select: vi.fn(() => createThenableQuery({ data: null, error: null })),
                insert: vi.fn(() =>
                    createThenableQuery({ data: { id: 'coa-1' }, error: null }),
                ),
            }
        }

        throw new Error(`Unexpected table: ${table}`)
    })

    const upload = vi.fn(async () => ({ error: null }))

    mockCreateClient.mockResolvedValue({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: {
                    user: {
                        id: 'staff-1',
                    },
                },
                error: null,
            }),
        },
        from,
        storage: {
            from: vi.fn(() => ({
                upload,
                remove: vi.fn(),
            })),
        },
    })

    return { from, upload }
}

describe('generateCoA stamp rendering', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mockGetUserConfidentialAccess.mockResolvedValue({
            canAccessConfidential: true,
        })
        mockIsConfidentialAssociatedSample.mockResolvedValue({ data: false })
        mockValidateSampleForCoAGeneration.mockResolvedValue({ valid: true })
        mockFetchSampleWithApprover.mockResolvedValue({
            id: 'sample-1',
            sample_id_display: 'S-001',
            approved_by: 'manager-1',
            approved_at: '2026-04-20T00:00:00.000Z',
        })
        mockGetActiveSignature.mockResolvedValue({
            success: true,
            signature: {
                id: 'signature-1',
                signature_path: 'manager/signature.png',
            },
        })
        mockDownloadSignature.mockResolvedValue({
            success: true,
            dataUri: 'data:image/png;base64,signature-data',
        })
        mockFetchLatestSubmission.mockResolvedValue(null)
        mockFetchTestResults.mockResolvedValue([])
        mockFetchTestingDate.mockResolvedValue('2026-04-20')
        mockGetCoAStampDataUri.mockResolvedValue('data:image/png;base64,stamp-data')
        mockRenderCoATemplate.mockReturnValue('<html>stamped coa</html>')
        mockGenerateHtmlHash.mockReturnValue('html-hash')
    })

    it('passes the embedded manager stamp to the CoA template renderer', async () => {
        mockSuccessfulClient()

        const result = await generateCoA('sample-1')

        expect(result.success).toBe(true)
        expect(mockGetCoAStampDataUri).toHaveBeenCalledOnce()
        expect(mockRenderCoATemplate).toHaveBeenCalledWith(
            expect.objectContaining({
                approverSignature: 'data:image/png;base64,signature-data',
            }),
            {
                managerStampSrc: 'data:image/png;base64,stamp-data',
            },
        )
    })
})

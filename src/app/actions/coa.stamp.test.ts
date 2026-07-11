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
const mockFetchStoredSignatureDataUri = vi.hoisted(() => vi.fn())
const mockRenderCoATemplate = vi.hoisted(() => vi.fn())
const mockGetCoAStampDataUri = vi.hoisted(() => vi.fn())
const mockQueueCoAReportForGeneration = vi.hoisted(() => vi.fn())
const mockClaimCoAReportForRegeneration = vi.hoisted(() => vi.fn())
const mockCompleteCoAReportGeneration = vi.hoisted(() => vi.fn())
const mockFailCoAReportGeneration = vi.hoisted(() => vi.fn())
const mockFetchSubmissionById = vi.hoisted(() => vi.fn())
const mockFetchSnapshotTestResults = vi.hoisted(() => vi.fn())

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
    fetchStoredSignatureDataUri: (...args: unknown[]) =>
        mockFetchStoredSignatureDataUri(...args),
}))

vi.mock('@/lib/coa/template', () => ({
    renderCoATemplate: (...args: unknown[]) => mockRenderCoATemplate(...args),
}))

vi.mock('@/lib/coa/stamp', () => ({
    getCoAStampDataUri: (...args: unknown[]) => mockGetCoAStampDataUri(...args),
}))

vi.mock('@/lib/coa/report-provenance', () => ({
    queueCoAReportForGeneration: (...args: unknown[]) =>
        mockQueueCoAReportForGeneration(...args),
    claimCoAReportForRegeneration: (...args: unknown[]) =>
        mockClaimCoAReportForRegeneration(...args),
    completeCoAReportGeneration: (...args: unknown[]) =>
        mockCompleteCoAReportGeneration(...args),
    failCoAReportGeneration: (...args: unknown[]) =>
        mockFailCoAReportGeneration(...args),
    fetchSubmissionById: (...args: unknown[]) =>
        mockFetchSubmissionById(...args),
    fetchSnapshotTestResults: (...args: unknown[]) =>
        mockFetchSnapshotTestResults(...args),
}))

import { generateCoA, regenerateCoA } from './coa'

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
    }

    return query
}

function mockSuccessfulClient(
    existingCoa: { id: string; status: string; file_path: string | null } | null = null,
    customUserResults?: QueryResult[],
) {
    mockQueueCoAReportForGeneration.mockResolvedValue({
        reportId: existingCoa?.id ?? 'coa-1',
        status: existingCoa?.status ?? 'pending',
        filePath: existingCoa?.file_path ?? null,
        sourceSubmissionId: 'submission-source-1',
        claimed: true,
        generationClaimId: '77777777-7777-4777-8777-777777777777',
        previousStatus: existingCoa?.status === 'ready' ? 'ready' : null,
    })
    mockClaimCoAReportForRegeneration.mockResolvedValue({
        reportId: existingCoa?.id ?? 'coa-1',
        status: 'pending',
        filePath: existingCoa?.file_path ?? null,
        sourceSubmissionId: 'submission-source-1',
        claimed: true,
        generationClaimId: '77777777-7777-4777-8777-777777777777',
        previousStatus: existingCoa?.status === 'ready' ? 'ready' : 'failed',
    })
    mockCompleteCoAReportGeneration.mockResolvedValue({
        reportId: existingCoa?.id ?? 'coa-1',
        previousFilePath: existingCoa?.file_path ?? null,
    })
    mockFailCoAReportGeneration.mockResolvedValue(true)

    const userResults: QueryResult[] = customUserResults ?? [
        { data: { role: 'analyst' }, error: null },
        { data: { full_name: 'Nguyễn Quản Lý' }, error: null },
    ]
    const reportUpdateQuery = createThenableQuery({
        data: { id: existingCoa?.id ?? 'coa-1' },
        error: null,
    })
    const updateReport = vi.fn(() => reportUpdateQuery)

    const from = vi.fn((table: string) => {
        if (table === 'users') {
            const result = userResults.shift()
            if (!result) throw new Error('Unexpected users query')
            return createThenableQuery(result)
        }

        if (table === 'coa_reports') {
            return {
                select: vi.fn(() => createThenableQuery({ data: existingCoa, error: null })),
                insert: vi.fn(() =>
                    createThenableQuery({ data: { id: 'coa-1' }, error: null }),
                ),
                update: updateReport,
            }
        }

        throw new Error(`Unexpected table: ${table}`)
    })

    const upload = vi.fn(async () => ({ error: null }))
    const remove = vi.fn(async () => ({ error: null }))

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
                remove,
            })),
        },
    })

    return { from, upload, remove, reportUpdateQuery, updateReport }
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
        mockFetchSubmissionById.mockResolvedValue({
            submissionId: 'submission-source-1',
            performerId: 'analyst-1',
            performerName: 'Nguyễn Kỹ Thuật',
            signatureId: 'performer-signature-1',
            signatureHash: 'performer-signature-hash',
            signaturePath: 'analyst/source-signature.png',
            submittedAt: '2026-07-11T00:00:00.000Z',
            submissionNumber: 2,
            signatureMeaning: 'Tôi xác nhận đã thực hiện xét nghiệm',
        })
        mockFetchSnapshotTestResults.mockResolvedValue([
            {
                result_id: 'result-1',
                assay_name: 'Glucose',
                value: '5,2',
                unit: 'mmol/L',
                normal_range: '4,1 - 5,9 mmol/L',
                method_name: null,
                lab_specialty_name: 'Sinh hóa',
            },
        ])
        mockFetchStoredSignatureDataUri.mockResolvedValue({
            dataUri: 'data:image/png;base64,performer-signature',
            signatureId: 'performer-signature-1',
            signatureHash: 'performer-signature-hash',
        })
        mockFetchTestingDate.mockResolvedValue('2026-04-20')
        mockGetCoAStampDataUri.mockResolvedValue('data:image/svg+xml;base64,stamp-data')
        mockRenderCoATemplate.mockReturnValue('<html>stamped coa</html>')
        mockGenerateHtmlHash.mockReturnValue('html-hash')
    })

    it('passes the embedded manager stamp to the CoA template renderer', async () => {
        mockSuccessfulClient()

        const result = await generateCoA('sample-1')

        expect(result.success).toBe(true)
        expect(mockGetCoAStampDataUri).toHaveBeenCalledOnce()
        expect(mockCompleteCoAReportGeneration).toHaveBeenCalledWith(
            'coa-1',
            '77777777-7777-4777-8777-777777777777',
            expect.objectContaining({
                fileHash: 'html-hash',
                signatureId: 'signature-1',
            }),
        )
        expect(mockRenderCoATemplate).toHaveBeenCalledWith(
            expect.objectContaining({
                approverSignature: 'data:image/png;base64,signature-data',
            }),
            {
                managerStampSrc: 'data:image/svg+xml;base64,stamp-data',
            },
        )
    })

    it('returns ALREADY_READY before loading the manager stamp', async () => {
        mockSuccessfulClient({
            id: 'coa-existing',
            status: 'ready',
            file_path: 'sample/existing.html',
        })
        mockGetCoAStampDataUri.mockRejectedValue(new Error('missing stamp'))

        const result = await generateCoA('sample-1')

        expect(result).toEqual(
            expect.objectContaining({
                success: false,
                code: 'ALREADY_READY',
                shouldRecordFailure: false,
            }),
        )
        expect(mockGetCoAStampDataUri).not.toHaveBeenCalled()
        expect(mockRenderCoATemplate).not.toHaveBeenCalled()
    })

    it('renders final results from the report source submission snapshots', async () => {
        mockSuccessfulClient()
        mockFetchSubmissionById.mockResolvedValue({
            submissionId: 'submission-source-1',
            performerId: 'analyst-1',
            performerName: 'Nguyễn Kỹ Thuật',
            signatureId: 'performer-signature-1',
            signatureHash: 'performer-signature-hash',
            signaturePath: 'analyst/source-signature.png',
            submittedAt: '2026-07-11T00:00:00.000Z',
            submissionNumber: 2,
            signatureMeaning: 'Tôi xác nhận đã thực hiện xét nghiệm',
        })
        mockFetchSnapshotTestResults.mockResolvedValue([
            {
                result_id: 'result-1',
                assay_name: 'Glucose',
                value: '5,2',
                unit: 'mmol/L',
                normal_range: '4,1 - 5,9 mmol/L',
                method_name: 'Máy sinh hóa tự động AU400',
                lab_specialty_name: 'Sinh hóa',
            },
        ])

        const result = await generateCoA('sample-1')

        expect(result.success).toBe(true)
        expect(mockFetchSubmissionById).toHaveBeenCalledWith('submission-source-1')
        expect(mockFetchStoredSignatureDataUri).toHaveBeenCalledWith(
            'performer-signature-1',
            'analyst/source-signature.png',
            'performer-signature-hash',
        )
        expect(mockFetchSignatureDataUri).not.toHaveBeenCalled()
        expect(mockFetchSnapshotTestResults).toHaveBeenCalledWith('submission-source-1')
        expect(mockFetchLatestSubmission).not.toHaveBeenCalled()
        expect(mockFetchTestResults).not.toHaveBeenCalled()
        expect(mockRenderCoATemplate).toHaveBeenCalledWith(
            expect.objectContaining({
                results: [
                    expect.objectContaining({
                        normal_range: '4,1 - 5,9 mmol/L',
                    }),
                ],
            }),
            expect.any(Object),
        )
    })

    it('uses the assay-range fallback only for a historic report without a source', async () => {
        mockSuccessfulClient()
        mockQueueCoAReportForGeneration.mockResolvedValue({
            reportId: 'coa-historic',
            status: 'pending',
            filePath: null,
            sourceSubmissionId: null,
            claimed: true,
            generationClaimId: '77777777-7777-4777-8777-777777777777',
            previousStatus: 'failed',
        })
        mockFetchLatestSubmission.mockResolvedValue(null)
        mockFetchTestResults.mockResolvedValue([
            {
                result_id: 'result-legacy',
                assay_name: 'Glucose',
                value: '5,4',
                unit: 'mmol/L',
                normal_range: '4,0 - 6,0 mmol/L',
                method_name: null,
                lab_specialty_name: 'Sinh hóa',
            },
        ])

        const result = await generateCoA('sample-1')

        expect(result.success).toBe(true)
        expect(mockFetchLatestSubmission).toHaveBeenCalledWith('sample-1')
        expect(mockFetchTestResults).toHaveBeenCalledWith('sample-1')
        expect(mockFetchSubmissionById).not.toHaveBeenCalled()
        expect(mockFetchSnapshotTestResults).not.toHaveBeenCalled()
    })

    it('regenerates a failed report from its existing source submission', async () => {
        mockSuccessfulClient(
            {
                id: 'coa-failed',
                status: 'failed',
                file_path: 'sample/failed.html',
            },
            [
                { data: { role: 'manager' }, error: null },
                { data: { role: 'manager' }, error: null },
                { data: { full_name: 'Nguyễn Quản Lý' }, error: null },
            ],
        )
        mockClaimCoAReportForRegeneration.mockResolvedValue({
            reportId: 'coa-failed',
            status: 'pending',
            filePath: 'sample/failed.html',
            sourceSubmissionId: 'submission-source-1',
            claimed: true,
            generationClaimId: '77777777-7777-4777-8777-777777777777',
            previousStatus: 'failed',
        })
        mockFetchSnapshotTestResults.mockResolvedValue([
            {
                result_id: 'result-1',
                assay_name: 'Glucose',
                value: '5,2',
                unit: 'mmol/L',
                normal_range: '4,1 - 5,9 mmol/L',
                method_name: null,
                lab_specialty_name: 'Sinh hóa',
            },
        ])

        const result = await regenerateCoA('sample-1')

        expect(result.success).toBe(true)
        expect(mockClaimCoAReportForRegeneration).toHaveBeenCalledWith(
            'sample-1',
            1,
        )
        expect(mockFetchSnapshotTestResults).toHaveBeenCalledWith(
            'submission-source-1',
        )
        expect(mockFetchTestResults).not.toHaveBeenCalled()
    })

    it('returns a failed report to failed when retry generation fails', async () => {
        mockSuccessfulClient(
            {
                id: 'coa-failed',
                status: 'failed',
                file_path: 'sample/failed.html',
            },
            [
                { data: { role: 'manager' }, error: null },
                { data: { role: 'manager' }, error: null },
            ],
        )
        mockClaimCoAReportForRegeneration.mockResolvedValue({
            reportId: 'coa-failed',
            status: 'pending',
            filePath: 'sample/failed.html',
            sourceSubmissionId: 'submission-source-1',
            claimed: true,
            generationClaimId: '77777777-7777-4777-8777-777777777777',
            previousStatus: 'failed',
        })
        mockGetActiveSignature.mockResolvedValue({
            success: false,
            error: 'missing signature',
        })

        const result = await regenerateCoA('sample-1')

        expect(result.success).toBe(false)
        expect(mockFailCoAReportGeneration).toHaveBeenCalledWith(
            'coa-failed',
            '77777777-7777-4777-8777-777777777777',
            result.error,
            false,
        )
    })

    it('fails closed when the bound source submission cannot be loaded', async () => {
        mockSuccessfulClient()
        mockFetchSubmissionById.mockResolvedValue(null)

        const result = await generateCoA('sample-1')

        expect(result).toEqual(expect.objectContaining({
            success: false,
            error: 'Không thể tải hồ sơ nguồn đã duyệt của CoA',
        }))
        expect(mockFailCoAReportGeneration).toHaveBeenCalledWith(
            'coa-1',
            '77777777-7777-4777-8777-777777777777',
            'Không thể tải hồ sơ nguồn đã duyệt của CoA',
            false,
        )
        expect(mockRenderCoATemplate).not.toHaveBeenCalled()
    })

    it('fails closed when the bound source snapshots cannot be loaded', async () => {
        mockSuccessfulClient()
        mockFetchSnapshotTestResults.mockResolvedValue([])

        const result = await generateCoA('sample-1')

        expect(result).toEqual(expect.objectContaining({
            success: false,
            error: 'Không thể tải ảnh chụp kết quả đã duyệt của CoA',
        }))
        expect(mockFailCoAReportGeneration).toHaveBeenCalledWith(
            'coa-1',
            '77777777-7777-4777-8777-777777777777',
            'Không thể tải ảnh chụp kết quả đã duyệt của CoA',
            false,
        )
        expect(mockRenderCoATemplate).not.toHaveBeenCalled()
    })
})

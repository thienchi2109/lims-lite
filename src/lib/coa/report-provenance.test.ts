import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFrom = vi.fn()
const mockAdminFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        from: mockFrom,
        rpc: mockRpc,
    })),
    createAdminClient: vi.fn(() => ({
        from: mockAdminFrom,
    })),
}))

import {
    claimCoAReportForRegeneration,
    failCoAReportGeneration,
    fetchSubmissionById,
    fetchSnapshotTestResults,
    queueCoAReportForGeneration,
} from './report-provenance'

function createSnapshotQuery(data: unknown[]) {
    const query = {
        select: vi.fn(() => query),
        eq: vi.fn(async () => ({ data, error: null })),
    }

    return query
}

function createSubmissionQuery(data: unknown) {
    const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({ data, error: null })),
    }

    return query
}

describe('fetchSnapshotTestResults', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('uses the immutable submitted reference range instead of the current assay range', async () => {
        mockFrom.mockReturnValue(createSnapshotQuery([
            {
                result_id: '11111111-1111-4111-8111-111111111111',
                assay_name: 'Glucose',
                result_value: '5,2',
                unit: 'mmol/L',
                method_name: 'Máy sinh hóa tự động AU400',
                reference_range: '4,1 - 5,9 mmol/L',
                result: {
                    assay_definitions: {
                        lab_specialties: {
                            name: 'Sinh hóa',
                            display_order: 20,
                        },
                    },
                },
            },
        ]))

        const results = await fetchSnapshotTestResults(
            '22222222-2222-4222-8222-222222222222',
        )

        expect(results).toEqual([
            {
                result_id: '11111111-1111-4111-8111-111111111111',
                assay_name: 'Glucose',
                value: '5,2',
                unit: 'mmol/L',
                normal_range: '4,1 - 5,9 mmol/L',
                method_name: 'Máy sinh hóa tự động AU400',
                lab_specialty_name: 'Sinh hóa',
            },
        ])
    })
})

describe('queueCoAReportForGeneration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns the immutable source selected by the database queue RPC', async () => {
        mockRpc.mockResolvedValue({
            data: {
                report_id: '33333333-3333-4333-8333-333333333333',
                status: 'pending',
                file_path: null,
                source_submission_id: '22222222-2222-4222-8222-222222222222',
                claimed: true,
                generation_claim_id: '77777777-7777-4777-8777-777777777777',
                previous_status: null,
            },
            error: null,
        })

        const report = await queueCoAReportForGeneration(
            '44444444-4444-4444-8444-444444444444',
        )

        expect(mockRpc).toHaveBeenCalledWith('queue_coa_report_for_generation', {
            p_sample_id: '44444444-4444-4444-8444-444444444444',
            p_version: 1,
        })
        expect(report).toEqual({
            reportId: '33333333-3333-4333-8333-333333333333',
            status: 'pending',
            filePath: null,
            sourceSubmissionId: '22222222-2222-4222-8222-222222222222',
            claimed: true,
            generationClaimId: '77777777-7777-4777-8777-777777777777',
            previousStatus: null,
        })
    })

    it('returns an unclaimed pending report when another worker owns generation', async () => {
        mockRpc.mockResolvedValue({
            data: {
                report_id: '33333333-3333-4333-8333-333333333333',
                status: 'pending',
                file_path: null,
                source_submission_id: '22222222-2222-4222-8222-222222222222',
                claimed: false,
                generation_claim_id: null,
                previous_status: null,
            },
            error: null,
        })

        const report = await queueCoAReportForGeneration(
            '44444444-4444-4444-8444-444444444444',
        )

        expect(report).toEqual(
            expect.objectContaining({
                claimed: false,
                generationClaimId: null,
            }),
        )
    })
})

describe('CoA report generation transitions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('claims manager regeneration through the dedicated RPC', async () => {
        mockRpc.mockResolvedValue({
            data: {
                report_id: '33333333-3333-4333-8333-333333333333',
                status: 'pending',
                file_path: 'sample/old.html',
                source_submission_id: '22222222-2222-4222-8222-222222222222',
                claimed: true,
                generation_claim_id: '77777777-7777-4777-8777-777777777777',
                previous_status: 'ready',
            },
            error: null,
        })

        const report = await claimCoAReportForRegeneration(
            '44444444-4444-4444-8444-444444444444',
        )

        expect(mockRpc).toHaveBeenCalledWith(
            'claim_coa_report_regeneration',
            {
                p_sample_id: '44444444-4444-4444-8444-444444444444',
                p_version: 1,
            },
        )
        expect(report).toEqual(
            expect.objectContaining({
                claimed: true,
                previousStatus: 'ready',
            }),
        )
    })

    it('returns the historic regeneration blocked reason from the RPC', async () => {
        mockRpc.mockResolvedValue({
            data: {
                report_id: '33333333-3333-4333-8333-333333333333',
                status: 'ready',
                file_path: 'sample/historic.html',
                source_submission_id: null,
                claimed: false,
                generation_claim_id: null,
                previous_status: null,
                blocked_reason: 'HISTORIC_REPORT_WITHOUT_SOURCE',
            },
            error: null,
        })

        const report = await claimCoAReportForRegeneration(
            '44444444-4444-4444-8444-444444444444',
        )

        expect(report).toEqual(
            expect.objectContaining({
                claimed: false,
                blockedReason: 'HISTORIC_REPORT_WITHOUT_SOURCE',
            }),
        )
    })

    it('records generation failure with the same claim', async () => {
        mockRpc.mockResolvedValue({ data: true, error: null })

        const recorded = await failCoAReportGeneration(
            '33333333-3333-4333-8333-333333333333',
            '77777777-7777-4777-8777-777777777777',
            'Không thể tải chữ ký',
            true,
        )

        expect(mockRpc).toHaveBeenCalledWith('fail_coa_report_generation', {
            p_report_id: '33333333-3333-4333-8333-333333333333',
            p_generation_claim_id: '77777777-7777-4777-8777-777777777777',
            p_error_message: 'Không thể tải chữ ký',
            p_restore_ready: true,
        })
        expect(recorded).toBe(true)
    })
})

describe('fetchSubmissionById', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('loads the performer from the report source instead of selecting a later submission', async () => {
        const query = createSubmissionQuery({
            id: '22222222-2222-4222-8222-222222222222',
            user_id: '55555555-5555-4555-8555-555555555555',
            signature_id: '66666666-6666-4666-8666-666666666666',
            submitted_at: '2026-07-11T00:00:00.000Z',
            submission_number: 2,
            signature_meaning: 'Tôi xác nhận đã thực hiện xét nghiệm',
            user: {
                full_name: 'Nguyễn Kỹ Thuật',
            },
        })
        mockFrom.mockReturnValue(query)
        const signatureQuery = createSubmissionQuery({
            signature_hash: 'source-signature-hash',
            signature_path: '55555555/source-signature.png',
        })
        mockAdminFrom.mockReturnValue(signatureQuery)

        const submission = await fetchSubmissionById(
            '22222222-2222-4222-8222-222222222222',
        )

        expect(query.eq).toHaveBeenCalledWith(
            'id',
            '22222222-2222-4222-8222-222222222222',
        )
        expect(mockAdminFrom).toHaveBeenCalledWith('user_signatures')
        expect(signatureQuery.eq).toHaveBeenCalledWith(
            'id',
            '66666666-6666-4666-8666-666666666666',
        )
        expect(signatureQuery.eq).toHaveBeenCalledWith(
            'user_id',
            '55555555-5555-4555-8555-555555555555',
        )
        expect(submission).toEqual({
            submissionId: '22222222-2222-4222-8222-222222222222',
            performerId: '55555555-5555-4555-8555-555555555555',
            performerName: 'Nguyễn Kỹ Thuật',
            signatureId: '66666666-6666-4666-8666-666666666666',
            signatureHash: 'source-signature-hash',
            signaturePath: '55555555/source-signature.png',
            submittedAt: '2026-07-11T00:00:00.000Z',
            submissionNumber: 2,
            signatureMeaning: 'Tôi xác nhận đã thực hiện xét nghiệm',
        })
    })

    it('fails closed when the stored submission signature relation is missing', async () => {
        mockFrom.mockReturnValue(createSubmissionQuery({
            id: '22222222-2222-4222-8222-222222222222',
            user_id: '55555555-5555-4555-8555-555555555555',
            signature_id: '66666666-6666-4666-8666-666666666666',
            submitted_at: '2026-07-11T00:00:00.000Z',
            submission_number: 2,
            signature_meaning: 'Tôi xác nhận đã thực hiện xét nghiệm',
            user: {
                full_name: 'Nguyễn Kỹ Thuật',
            },
        }))
        mockAdminFrom.mockReturnValue(createSubmissionQuery(null))

        const submission = await fetchSubmissionById(
            '22222222-2222-4222-8222-222222222222',
        )

        expect(submission).toBeNull()
    })
})

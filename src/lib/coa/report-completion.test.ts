import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        from: mockFrom,
        rpc: mockRpc,
    })),
}))

import { completeCoAReportGeneration } from './report-completion'

function createReportQuery(
    data: unknown,
    error: { message: string } | null = null,
) {
    const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({ data, error })),
    }

    return query
}

const reportId = '33333333-3333-4333-8333-333333333333'
const generationClaimId = '77777777-7777-4777-8777-777777777777'
const completionInput = {
    filePath: 'sample/new.html',
    fileHash: 'html-hash',
    signatureId: '66666666-6666-4666-8666-666666666666',
}

describe('completeCoAReportGeneration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('completes generation only through the claim-bound RPC', async () => {
        mockRpc.mockResolvedValue({
            data: {
                report_id: reportId,
                previous_file_path: 'sample/old.html',
            },
            error: null,
        })

        const result = await completeCoAReportGeneration(
            reportId,
            generationClaimId,
            completionInput,
        )

        expect(mockRpc).toHaveBeenCalledWith(
            'complete_coa_report_generation',
            {
                p_report_id: reportId,
                p_generation_claim_id: generationClaimId,
                p_file_path: completionInput.filePath,
                p_file_hash: completionInput.fileHash,
                p_signature_id: completionInput.signatureId,
            },
        )
        expect(result).toEqual({
            status: 'completed',
            reportId,
            previousFilePath: 'sample/old.html',
        })
    })

    it('rejects completion when the database explicitly returns null', async () => {
        mockRpc.mockResolvedValue({ data: null, error: null })

        const result = await completeCoAReportGeneration(
            reportId,
            generationClaimId,
            completionInput,
        )

        expect(result).toEqual({ status: 'rejected' })
        expect(mockFrom).not.toHaveBeenCalled()
    })

    it('reconciles an RPC error when the uploaded report is already ready', async () => {
        mockRpc.mockResolvedValue({
            data: null,
            error: { message: 'network response lost' },
        })
        const reportQuery = createReportQuery({
            status: 'ready',
            file_path: completionInput.filePath,
            file_hash: completionInput.fileHash,
        })
        mockFrom.mockReturnValue(reportQuery)

        const result = await completeCoAReportGeneration(
            reportId,
            generationClaimId,
            completionInput,
        )

        expect(reportQuery.eq).toHaveBeenCalledWith('id', reportId)
        expect(result).toEqual({
            status: 'completed',
            reportId,
            previousFilePath: null,
        })
    })

    it('returns indeterminate when an RPC error cannot be reconciled', async () => {
        mockRpc.mockResolvedValue({
            data: null,
            error: { message: 'network response lost' },
        })
        mockFrom.mockReturnValue(createReportQuery(
            null,
            { message: 'reconciliation unavailable' },
        ))

        const result = await completeCoAReportGeneration(
            reportId,
            generationClaimId,
            completionInput,
        )

        expect(result).toEqual({ status: 'indeterminate' })
    })
})

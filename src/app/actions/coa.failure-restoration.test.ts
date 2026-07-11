import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.hoisted(() => vi.fn())
const mockValidateSampleForCoAGeneration = vi.hoisted(() => vi.fn())
const mockFailCoAReportGeneration = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

vi.mock('@/lib/data/confidential-samples', () => ({
    getUserConfidentialAccess: vi.fn(async () => ({
        canAccessConfidential: true,
        error: null,
    })),
    isConfidentialAssociatedSample: vi.fn(),
}))

vi.mock('@/app/actions/signatures', () => ({
    getActiveSignature: vi.fn(),
    downloadSignature: vi.fn(),
}))

vi.mock('@/lib/coa/helpers', () => ({
    fetchSampleWithApprover: vi.fn(),
    fetchTestingDate: vi.fn(),
    fetchTestResults: vi.fn(),
    generateHtmlHash: vi.fn(),
    validateSampleForCoAGeneration: (...args: unknown[]) =>
        mockValidateSampleForCoAGeneration(...args),
    fetchLatestSubmission: vi.fn(),
    fetchSignatureDataUri: vi.fn(),
    fetchStoredSignatureDataUri: vi.fn(),
}))

vi.mock('@/lib/coa/template', () => ({
    renderCoATemplate: vi.fn(),
}))

vi.mock('@/lib/coa/stamp', () => ({
    getCoAStampDataUri: vi.fn(),
}))

vi.mock('@/lib/coa/report-provenance', () => ({
    claimCoAReportForRegeneration: vi.fn(),
    completeCoAReportGeneration: vi.fn(),
    failCoAReportGeneration: (...args: unknown[]) =>
        mockFailCoAReportGeneration(...args),
    fetchSnapshotTestResults: vi.fn(),
    fetchSubmissionById: vi.fn(),
    queueCoAReportForGeneration: vi.fn(),
}))

import { generateCoA } from './coa'

const failureMessage = 'Mẫu không còn đủ điều kiện tạo CoA'

function createClaimedReport(previousStatus: 'ready' | 'failed' | null = null) {
    return {
        reportId: '33333333-3333-4333-8333-333333333333',
        status: 'pending' as const,
        filePath: previousStatus === 'ready' ? 'sample/existing.html' : null,
        sourceSubmissionId: '22222222-2222-4222-8222-222222222222',
        claimed: true,
        generationClaimId: '77777777-7777-4777-8777-777777777777',
        previousStatus,
    }
}

describe('failClaimedCoAGeneration', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        const roleQuery = {
            select: vi.fn(),
            eq: vi.fn(),
            single: vi.fn(async () => ({
                data: { role: 'analyst' },
                error: null,
            })),
        }
        roleQuery.select.mockReturnValue(roleQuery)
        roleQuery.eq.mockReturnValue(roleQuery)

        mockCreateClient.mockResolvedValue({
            auth: {
                getUser: vi.fn(async () => ({
                    data: { user: { id: '55555555-5555-4555-8555-555555555555' } },
                    error: null,
                })),
            },
            from: vi.fn(() => roleQuery),
        })
        mockValidateSampleForCoAGeneration.mockResolvedValue({
            valid: false,
            error: failureMessage,
        })
        mockFailCoAReportGeneration.mockResolvedValue(true)
    })

    it('keeps failure reporting enabled when persistence returns false', async () => {
        mockFailCoAReportGeneration.mockResolvedValue(false)

        const result = await generateCoA(
            '44444444-4444-4444-8444-444444444444',
            undefined,
            createClaimedReport(),
        )

        expect(result).toEqual({
            success: false,
            error: failureMessage,
            shouldRecordFailure: true,
        })
    })

    it('keeps failure reporting enabled when persistence throws', async () => {
        mockFailCoAReportGeneration.mockRejectedValue(
            new Error('Failure persistence unavailable'),
        )

        const result = await generateCoA(
            '44444444-4444-4444-8444-444444444444',
            undefined,
            createClaimedReport(),
        )

        expect(result).toEqual({
            success: false,
            error: failureMessage,
            shouldRecordFailure: true,
        })
        expect(mockFailCoAReportGeneration).toHaveBeenCalledOnce()
    })

    it('keeps failure reporting enabled when a ready restoration claim expired', async () => {
        mockFailCoAReportGeneration.mockResolvedValue(false)

        const result = await generateCoA(
            '44444444-4444-4444-8444-444444444444',
            undefined,
            createClaimedReport('ready'),
        )

        expect(mockFailCoAReportGeneration).toHaveBeenCalledWith(
            '33333333-3333-4333-8333-333333333333',
            '77777777-7777-4777-8777-777777777777',
            failureMessage,
            true,
        )
        expect(result).toEqual({
            success: false,
            error: failureMessage,
            shouldRecordFailure: true,
        })
    })

    it('suppresses duplicate reporting after restoring ready successfully', async () => {
        const result = await generateCoA(
            '44444444-4444-4444-8444-444444444444',
            undefined,
            createClaimedReport('ready'),
        )

        expect(mockFailCoAReportGeneration).toHaveBeenCalledWith(
            '33333333-3333-4333-8333-333333333333',
            '77777777-7777-4777-8777-777777777777',
            failureMessage,
            true,
        )
        expect(result).toEqual({
            success: false,
            error: failureMessage,
            shouldRecordFailure: false,
        })
    })
})

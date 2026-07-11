import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.fn()
const mockClaimCoAReportForRegeneration = vi.fn()
const mockGenerateValidation = vi.fn()
const mockFailCoAReportGeneration = vi.fn()

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

vi.mock('./signatures', () => ({
    getActiveSignature: vi.fn(),
    downloadSignature: vi.fn(),
}))

vi.mock('@/lib/coa/stamp', () => ({
    getCoAStampDataUri: vi.fn(),
}))

vi.mock('@/lib/coa/helpers', () => ({
    fetchSampleWithApprover: vi.fn(),
    fetchTestingDate: vi.fn(),
    fetchTestResults: vi.fn(),
    generateHtmlHash: vi.fn(),
    validateSampleForCoAGeneration: (...args: unknown[]) =>
        mockGenerateValidation(...args),
    fetchLatestSubmission: vi.fn(),
    fetchSignatureDataUri: vi.fn(),
    fetchStoredSignatureDataUri: vi.fn(),
}))

vi.mock('@/lib/coa/template', () => ({
    renderCoATemplate: vi.fn(),
}))

vi.mock('@/lib/coa/report-provenance', () => ({
    claimCoAReportForRegeneration: (...args: unknown[]) =>
        mockClaimCoAReportForRegeneration(...args),
    completeCoAReportGeneration: vi.fn(),
    failCoAReportGeneration: (...args: unknown[]) =>
        mockFailCoAReportGeneration(...args),
    fetchSnapshotTestResults: vi.fn(),
    fetchSubmissionById: vi.fn(),
    queueCoAReportForGeneration: vi.fn(),
}))

import { regenerateCoA } from './coa'

function createManagerClient(): void {
    const roleQuery = {
        select: vi.fn(),
        eq: vi.fn(),
        single: vi.fn(async () => ({
            data: { role: 'manager' },
            error: null,
        })),
    }
    roleQuery.select.mockReturnValue(roleQuery)
    roleQuery.eq.mockReturnValue(roleQuery)

    mockCreateClient.mockResolvedValue({
        auth: {
            getUser: vi.fn(async () => ({
                data: { user: { id: 'manager-1' } },
                error: null,
            })),
        },
        from: vi.fn((table: string) => {
            if (table !== 'users') {
                throw new Error(`Unexpected table: ${table}`)
            }
            return roleQuery
        }),
    })
}

describe('historic CoA regeneration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        createManagerClient()
    })

    it.each([
        ['ready', 'coa-historic-ready', 'sample/historic-ready.html'],
        ['failed', 'coa-historic-failed', 'sample/historic-failed.html'],
    ] as const)(
        'blocks a historic %s report without immutable provenance',
        async (status, reportId, filePath) => {
            mockClaimCoAReportForRegeneration.mockResolvedValue({
                reportId,
                status,
                filePath,
                sourceSubmissionId: null,
                claimed: false,
                generationClaimId: null,
                previousStatus: null,
                blockedReason: 'HISTORIC_REPORT_WITHOUT_SOURCE',
            })

            const result = await regenerateCoA('sample-1')

            expect(result).toEqual({
                success: false,
                shouldRecordFailure: false,
                error: 'Không thể tạo lại CoA lịch sử vì báo cáo chưa có nguồn dữ liệu đã duyệt bất biến',
            })
            expect(mockGenerateValidation).not.toHaveBeenCalled()
            expect(mockFailCoAReportGeneration).not.toHaveBeenCalled()
        },
    )
})

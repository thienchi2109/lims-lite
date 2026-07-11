import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRequireRole = vi.fn()
const mockIsAuthError = vi.fn()
const mockFrom = vi.fn()
const mockGetUserConfidentialAccess = vi.fn()
const mockIsConfidentialAssociatedSample = vi.fn()

vi.mock('@/lib/auth-helpers', () => ({
    requireRole: (...args: unknown[]) => mockRequireRole(...args),
    isAuthError: (...args: unknown[]) => mockIsAuthError(...args),
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        from: mockFrom,
    })),
}))

vi.mock('@/lib/data/confidential-samples', () => ({
    SAMPLE_NOT_FOUND_ERROR: 'Không tìm thấy mẫu',
    getUserConfidentialAccess: (...args: unknown[]) =>
        mockGetUserConfidentialAccess(...args),
    isConfidentialAssociatedSample: (...args: unknown[]) =>
        mockIsConfidentialAssociatedSample(...args),
}))

import { getSampleSubmissionReview } from '@/app/actions/submission-reviews'

const SAMPLE_ID = '11111111-1111-4111-8111-111111111111'
const ACTIVE_SUBMISSION_ID = '22222222-2222-4222-8222-222222222222'
const PRIOR_SUBMISSION_ID = '33333333-3333-4333-8333-333333333333'
const RESULT_ID = '44444444-4444-4444-8444-444444444444'
const ANALYST_ID = '55555555-5555-4555-8555-555555555555'

function createOrderedQuery<T>(data: T) {
    const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        order: vi.fn().mockResolvedValue({ data, error: null }),
    }

    return query
}

describe('getSampleSubmissionReview', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRequireRole.mockResolvedValue({ id: 'manager-1', role: 'manager' })
        mockIsAuthError.mockReturnValue(false)
        mockGetUserConfidentialAccess.mockResolvedValue({
            canAccessConfidential: true,
            role: 'manager',
        })
        mockIsConfidentialAssociatedSample.mockResolvedValue({ data: false })
    })

    it('returns active and prior immutable assessment snapshots in submission order', async () => {
        const submissionsQuery = createOrderedQuery([
            {
                id: ACTIVE_SUBMISSION_ID,
                sample_id: SAMPLE_ID,
                submitted_at: '2026-07-11T03:00:00.000Z',
                submission_number: 2,
                superseded_by: null,
                result_reference_assessments: [
                    {
                        id: '66666666-6666-4666-8666-666666666666',
                        submission_id: ACTIVE_SUBMISSION_ID,
                        result_id: RESULT_ID,
                        assessment: 'outside_reference_range',
                        assay_name: 'Glucose',
                        result_value: '5.0',
                        unit: 'mmol/L',
                        method_name: 'Hexokinase',
                        reference_range: '4.0 - 6.0',
                        analyst_id: ANALYST_ID,
                        assessed_at: '2026-07-11T03:00:00.000Z',
                    },
                ],
            },
            {
                id: PRIOR_SUBMISSION_ID,
                sample_id: SAMPLE_ID,
                submitted_at: '2026-07-10T03:00:00.000Z',
                submission_number: 1,
                superseded_by: ACTIVE_SUBMISSION_ID,
                result_reference_assessments: [
                    {
                        id: '77777777-7777-4777-8777-777777777777',
                        submission_id: PRIOR_SUBMISSION_ID,
                        result_id: RESULT_ID,
                        assessment: 'within_reference_range',
                        assay_name: 'Glucose',
                        result_value: '4.8',
                        unit: 'mmol/L',
                        method_name: 'Hexokinase',
                        reference_range: '3.9 - 5.8',
                        analyst_id: ANALYST_ID,
                        assessed_at: '2026-07-10T03:00:00.000Z',
                    },
                ],
            },
        ])

        mockFrom.mockImplementation((table: string) => {
            if (table === 'sample_submissions') return submissionsQuery
            throw new Error(`Unexpected table: ${table}`)
        })

        const result = await getSampleSubmissionReview(SAMPLE_ID)

        expect(result).toEqual({
            data: {
                submissions: [
                    expect.objectContaining({
                        id: ACTIVE_SUBMISSION_ID,
                        is_active: true,
                        assessments: [
                            expect.objectContaining({
                                assessment: 'outside_reference_range',
                                result_value: '5.0',
                                reference_range: '4.0 - 6.0',
                            }),
                        ],
                    }),
                    expect.objectContaining({
                        id: PRIOR_SUBMISSION_ID,
                        is_active: false,
                        assessments: [
                            expect.objectContaining({
                                assessment: 'within_reference_range',
                                result_value: '4.8',
                                reference_range: '3.9 - 5.8',
                            }),
                        ],
                    }),
                ],
            },
        })
        expect(submissionsQuery.eq).toHaveBeenCalledWith('sample_id', SAMPLE_ID)
        expect(submissionsQuery.order).toHaveBeenCalledWith('submission_number', {
            ascending: false,
        })
        expect(mockFrom).toHaveBeenCalledTimes(1)
    })

    it('hides confidential sample snapshots from managers without access', async () => {
        mockGetUserConfidentialAccess.mockResolvedValue({
            canAccessConfidential: false,
            role: 'manager',
        })
        mockIsConfidentialAssociatedSample.mockResolvedValue({ data: true })

        const result = await getSampleSubmissionReview(SAMPLE_ID)

        expect(result).toEqual({ error: 'Không tìm thấy mẫu' })
        expect(mockFrom).not.toHaveBeenCalled()
    })

    it('returns a controlled error for malformed nested assessment data', async () => {
        const submissionsQuery = createOrderedQuery([
            {
                id: ACTIVE_SUBMISSION_ID,
                sample_id: SAMPLE_ID,
                submitted_at: '2026-07-11T03:00:00.000Z',
                submission_number: 1,
                superseded_by: null,
                result_reference_assessments: { malformed: true },
            },
        ])
        mockFrom.mockReturnValue(submissionsQuery)

        await expect(getSampleSubmissionReview(SAMPLE_ID)).resolves.toEqual({
            error: 'Dữ liệu đánh giá đã gửi không hợp lệ',
        })
    })
})

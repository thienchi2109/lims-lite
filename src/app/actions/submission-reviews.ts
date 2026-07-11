'use server'

import { z } from 'zod'

import { isAuthError, requireRole } from '@/lib/auth-helpers'
import {
    getUserConfidentialAccess,
    isConfidentialAssociatedSample,
    SAMPLE_NOT_FOUND_ERROR,
} from '@/lib/data/confidential-samples'
import { createClient } from '@/lib/supabase/server'
import {
    ResultAssessmentSnapshotSchema,
    ReviewedSampleSubmissionSchema,
    SampleSubmissionReviewSchema,
    type SampleSubmissionReview,
} from '@/types'

const SampleIdSchema = z.string().uuid()
const SubmissionWithAssessmentsRowsSchema = z.array(
    ReviewedSampleSubmissionSchema.omit({
        assessments: true,
        is_active: true,
    })
        .extend({
            result_reference_assessments: z
                .array(ResultAssessmentSnapshotSchema)
                .nullable(),
        })
        .strict(),
)
type SampleSubmissionReviewResponse = {
    data?: SampleSubmissionReview
    error?: string
}

export async function getSampleSubmissionReview(
    sampleId: string,
): Promise<SampleSubmissionReviewResponse> {
    const auth = await requireRole('manager')
    if (isAuthError(auth)) return auth

    const parsedSampleId = SampleIdSchema.safeParse(sampleId)
    if (!parsedSampleId.success) {
        return { error: 'Mã mẫu không hợp lệ' }
    }

    const supabase = await createClient()
    const access = await getUserConfidentialAccess(auth.id, supabase)
    if (access.error) {
        return { error: 'Không thể xác minh quyền truy cập mẫu' }
    }

    if (!access.canAccessConfidential) {
        try {
            const confidentiality = await isConfidentialAssociatedSample(
                parsedSampleId.data,
            )
            if (confidentiality.data) {
                return { error: SAMPLE_NOT_FOUND_ERROR }
            }
        } catch (error) {
            console.error('Error checking confidential sample access:', error)
            return { error: 'Không thể xác minh quyền truy cập mẫu' }
        }
    }

    const { data: submissions, error: submissionsError } = await supabase
        .from('sample_submissions')
        .select(`
            id,
            sample_id,
            submitted_at,
            submission_number,
            superseded_by,
            result_reference_assessments (
                id,
                submission_id,
                result_id,
                assessment,
                assay_name,
                result_value,
                unit,
                method_name,
                reference_range,
                analyst_id,
                assessed_at
            )
        `)
        .eq('sample_id', parsedSampleId.data)
        .order('submission_number', { ascending: false })

    if (submissionsError) {
        console.error('Error loading sample submission history:', submissionsError)
        return { error: 'Không thể tải lịch sử đánh giá đã gửi' }
    }

    const submissionRows = SubmissionWithAssessmentsRowsSchema.safeParse(
        submissions ?? [],
    )
    if (!submissionRows.success) {
        console.error('Invalid sample submission snapshot rows:', submissionRows.error)
        return { error: 'Dữ liệu đánh giá đã gửi không hợp lệ' }
    }

    if (submissionRows.data.length === 0) {
        return { data: { submissions: [] } }
    }

    const review = SampleSubmissionReviewSchema.safeParse({
        submissions: submissionRows.data.map((submission) => {
            const {
                result_reference_assessments: assessments,
                ...submissionData
            } = submission

            return {
                ...submissionData,
                is_active: submission.superseded_by === null,
                assessments: [...(assessments ?? [])].sort((left, right) =>
                    left.assessed_at.localeCompare(right.assessed_at),
                ),
            }
        }),
    })

    if (!review.success) {
        console.error('Invalid sample submission review data:', review.error)
        return { error: 'Dữ liệu đánh giá đã gửi không hợp lệ' }
    }

    return { data: review.data }
}

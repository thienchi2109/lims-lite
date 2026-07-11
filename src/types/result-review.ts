import { z } from 'zod'

export const ResultReferenceAssessmentSchema = z.enum([
    'within_reference_range',
    'outside_reference_range',
])

export type ResultReferenceAssessment = z.infer<typeof ResultReferenceAssessmentSchema>

export const ResultReviewAssessmentSchema = z
    .object({
        result_id: z.string().uuid(),
        assessment: ResultReferenceAssessmentSchema,
        result_updated_at: z.iso.datetime({ offset: true }),
        assay_updated_at: z.iso.datetime({ offset: true }),
    })
    .strict()

export type ResultReviewAssessment = z.infer<typeof ResultReviewAssessmentSchema>

export const SubmitResultReviewSchema = z
    .object({
        sampleId: z.string().uuid(),
        assessments: z
            .array(ResultReviewAssessmentSchema)
            .min(1, 'Cần đánh giá ít nhất một kết quả'),
    })
    .strict()

export type SubmitResultReview = z.infer<typeof SubmitResultReviewSchema>

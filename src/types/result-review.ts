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

export const ResultAssessmentSnapshotSchema = z
    .object({
        id: z.string().uuid(),
        submission_id: z.string().uuid(),
        result_id: z.string().uuid(),
        assessment: ResultReferenceAssessmentSchema,
        assay_name: z.string(),
        result_value: z.string(),
        unit: z.string().nullable(),
        method_name: z.string().nullable(),
        reference_range: z.string().nullable(),
        analyst_id: z.string().uuid(),
        assessed_at: z.iso.datetime({ offset: true }),
    })
    .strict()

export type ResultAssessmentSnapshot = z.infer<typeof ResultAssessmentSnapshotSchema>

export const ReviewedSampleSubmissionSchema = z
    .object({
        id: z.string().uuid(),
        sample_id: z.string().uuid(),
        submitted_at: z.iso.datetime({ offset: true }),
        submission_number: z.number().int().positive(),
        superseded_by: z.string().uuid().nullable(),
        is_active: z.boolean(),
        assessments: z.array(ResultAssessmentSnapshotSchema),
    })
    .strict()

export type ReviewedSampleSubmission = z.infer<typeof ReviewedSampleSubmissionSchema>

export const SampleSubmissionReviewSchema = z
    .object({
        submissions: z.array(ReviewedSampleSubmissionSchema),
    })
    .strict()

export type SampleSubmissionReview = z.infer<typeof SampleSubmissionReviewSchema>

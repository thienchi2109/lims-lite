import { describe, expect, it } from 'vitest'

import { SubmitResultReviewSchema } from './result-review'

const SAMPLE_ID = '11111111-1111-4111-8111-111111111111'
const RESULT_ID = '22222222-2222-4222-8222-222222222222'

describe('SubmitResultReviewSchema', () => {
    it('accepts the exact assessment-aware submission contract', () => {
        const result = SubmitResultReviewSchema.parse({
            sampleId: SAMPLE_ID,
            assessments: [
                {
                    result_id: RESULT_ID,
                    assessment: 'within_reference_range',
                    result_updated_at: '2026-07-11T08:00:00.000Z',
                    assay_updated_at: '2026-07-11T07:00:00.000Z',
                },
            ],
        })

        expect(result.assessments).toHaveLength(1)
    })

    it('accepts PostgreSQL timestamp offsets used by revision tokens', () => {
        const result = SubmitResultReviewSchema.parse({
            sampleId: SAMPLE_ID,
            assessments: [
                {
                    result_id: RESULT_ID,
                    assessment: 'within_reference_range',
                    result_updated_at: '2026-01-01T13:41:55.10151+00:00',
                    assay_updated_at: '2026-07-08T13:01:35.228887+00:00',
                },
            ],
        })

        expect(result.assessments).toHaveLength(1)
    })

    it('rejects missing assessments and untrusted display fields', () => {
        expect(() =>
            SubmitResultReviewSchema.parse({
                sampleId: SAMPLE_ID,
                assessments: [],
            }),
        ).toThrow()

        expect(() =>
            SubmitResultReviewSchema.parse({
                sampleId: SAMPLE_ID,
                assessments: [
                    {
                        result_id: RESULT_ID,
                        assessment: 'outside_reference_range',
                        result_updated_at: '2026-07-11T08:00:00.000Z',
                        assay_updated_at: '2026-07-11T07:00:00.000Z',
                        result_value: 'tampered',
                    },
                ],
            }),
        ).toThrow()
    })
})

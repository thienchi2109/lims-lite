import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SubmittedAssessmentReview } from '@/components/submitted-assessment-review'
import type { SampleSubmissionReview } from '@/types'

const review: SampleSubmissionReview = {
    submissions: [
        {
            id: '22222222-2222-4222-8222-222222222222',
            sample_id: '11111111-1111-4111-8111-111111111111',
            submitted_at: '2026-07-11T03:00:00.000Z',
            submission_number: 2,
            superseded_by: null,
            is_active: true,
            assessments: [
                {
                    id: '66666666-6666-4666-8666-666666666666',
                    submission_id: '22222222-2222-4222-8222-222222222222',
                    result_id: '44444444-4444-4444-8444-444444444444',
                    assessment: 'outside_reference_range',
                    assay_name: 'Glucose',
                    result_value: '5.0',
                    unit: 'mmol/L',
                    method_name: 'Hexokinase',
                    reference_range: '4.0 - 6.0',
                    analyst_id: '55555555-5555-4555-8555-555555555555',
                    assessed_at: '2026-07-11T03:00:00.000Z',
                },
            ],
        },
        {
            id: '33333333-3333-4333-8333-333333333333',
            sample_id: '11111111-1111-4111-8111-111111111111',
            submitted_at: '2026-07-10T03:00:00.000Z',
            submission_number: 1,
            superseded_by: '22222222-2222-4222-8222-222222222222',
            is_active: false,
            assessments: [],
        },
    ],
}

describe('SubmittedAssessmentReview', () => {
    it('renders the submitted conclusion and snapshot context without recalculating it', () => {
        render(<SubmittedAssessmentReview review={review} />)

        expect(screen.getByText('Đánh giá đã gửi')).not.toBeNull()
        expect(screen.getByText('Lần gửi #2')).not.toBeNull()
        expect(screen.getByText('Glucose')).not.toBeNull()
        expect(screen.getByText('5.0')).not.toBeNull()
        expect(screen.getByText('mmol/L')).not.toBeNull()
        expect(screen.getByText('Hexokinase')).not.toBeNull()
        expect(screen.getByText('4.0 - 6.0')).not.toBeNull()

        // The stored assessment is intentionally "outside" although 5.0 is within 4.0-6.0.
        expect(screen.getByText('Ngoài khoảng tham chiếu')).not.toBeNull()
    })

    it('keeps prior submission history available', async () => {
        const user = userEvent.setup()
        render(<SubmittedAssessmentReview review={review} />)

        await user.click(screen.getByText('Lịch sử đánh giá (1)'))
        expect(screen.getByText('Lần gửi #1')).not.toBeNull()
    })
})

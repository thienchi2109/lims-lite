import { describe, expect, it } from 'vitest'

import type { ResultWithAssay } from '@/types'
import { buildResultReviewDraftData } from './result-review-draft'

describe('buildResultReviewDraftData', () => {
    it('copies persisted sample quality into the draft CoA data', () => {
        const result = {
            id: '22222222-2222-4222-8222-222222222222',
            sample_id_display: 'LIMS-001',
            sample_quality: false,
            sample_type: 'Máu',
            received_date: '2026-07-11T07:00:00.000Z',
            client_name: 'Nguyễn Văn A',
        } as ResultWithAssay

        const draftData = buildResultReviewDraftData(
            '11111111-1111-4111-8111-111111111111',
            [result],
        )

        expect(draftData.sample.sample_quality).toBe(false)
    })
})

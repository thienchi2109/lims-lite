import { describe, expect, it } from 'vitest'

import type { CoAData, CoAManualInputs } from '@/types'
import { renderPatientInfo } from '../patient-info'

function createCoAData(
    sampleQuality: boolean | null,
    manualInputs?: CoAManualInputs,
): CoAData {
    return {
        sample: {
            id: '11111111-1111-4111-8111-111111111111',
            sample_id_display: 'LIMS-001',
            approved_by: null,
            approved_at: null,
            client_name: 'Nguyễn Văn A',
            sample_type: 'Máu',
            received_date: '2026-07-11T07:00:00.000Z',
            sample_quality: sampleQuality,
        },
        results: [],
        approverName: '',
        approverSignature: null,
        signatureId: null,
        approvalDate: '',
        manualInputs,
    }
}

describe('renderPatientInfo sample quality', () => {
    it.each([
        [true, 'Đạt'],
        [false, 'Không đạt'],
        [null, 'Chưa đánh giá'],
    ] as const)('renders persisted sample quality %s as %s', (sampleQuality, expectedLabel) => {
        const html = renderPatientInfo(createCoAData(sampleQuality))

        expect(html).toMatch(
            new RegExp(`Chất lượng mẫu:</span>\\s*<span class="info-value">${expectedLabel}</span>`),
        )
    })

    it('ignores obsolete manual quality when it conflicts with persisted quality', () => {
        const html = renderPatientInfo(createCoAData(false, {
            referrer: 'Bác sĩ A',
            sampleQuality: 'Đạt',
        }))

        expect(html).toMatch(
            /Chất lượng mẫu:<\/span>\s*<span class="info-value">Không đạt<\/span>/,
        )
    })
})

import { describe, expect, it } from 'vitest'

import type { CoAData } from '@/types'
import { renderCoATemplate } from '../index'

const RESULT_ID = '22222222-2222-4222-8222-222222222222'

function createDraftCoAData(): CoAData {
    return {
        sample: {
            id: '11111111-1111-4111-8111-111111111111',
            sample_id_display: 'LIMS-001',
            approved_by: null,
            approved_at: null,
            client_name: 'Nguyễn Văn A',
            sample_type: 'Máu',
            received_date: '2026-07-11T07:00:00.000Z',
            client_dob: '1990-01-01',
            client_gender: 'Nam',
            client_address: 'Cần Thơ',
            client_health_insurance_num: 'BHYT-001',
        },
        results: [
            {
                result_id: RESULT_ID,
                assay_name: 'Glucose',
                value: '5.2',
                unit: 'mmol/L',
                normal_range: '4.1 - 5.9',
                method_name: 'Máy sinh hóa',
                lab_specialty_name: 'Sinh hóa',
            },
        ],
        approverName: '',
        approverSignature: null,
        signatureId: null,
        approvalDate: '',
        testingDate: '2026-07-11T08:30:00.000Z',
    }
}

describe('renderCoATemplate draft mode', () => {
    it('reuses the canonical document while suppressing final certification content', () => {
        const html = renderCoATemplate(createDraftCoAData(), {
            mode: 'draft',
            assessments: {
                [RESULT_ID]: 'within_reference_range',
            },
        })

        expect(html).toContain('BẢN NHÁP - CHƯA GỬI DUYỆT')
        expect(html).toContain('Khoảng tham chiếu')
        expect(html).toContain('4.1 - 5.9')
        expect(html).toContain('Đánh giá')
        expect(html).toContain('Trong khoảng tham chiếu')
        expect(html).toContain('Phiếu xem trước phục vụ rà soát trước khi gửi duyệt')
        expect(html).not.toContain('data-signature-id')
        expect(html).not.toContain('Chữ ký người thực hiện')
        expect(html).not.toContain('NGƯỜI PHÊ DUYỆT')
        expect(html).not.toContain('api.qrserver.com')
        expect(html).not.toContain('alt="QR Code"')
    })
})

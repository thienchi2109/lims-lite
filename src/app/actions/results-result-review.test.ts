import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockOrder = vi.fn()
const mockEq = vi.fn(() => ({ order: mockOrder }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    })),
}))

vi.mock('./qc-operations', () => ({
    getActiveQCSessionsForAssays: vi.fn(),
}))

import { getResultsBySample } from './results'

const SAMPLE_ID = '11111111-1111-4111-8111-111111111111'
const RESULT_ID = '22222222-2222-4222-8222-222222222222'
const ASSAY_ID = '33333333-3333-4333-8333-333333333333'

describe('getResultsBySample result review fields', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetUser.mockResolvedValue({ data: { user: { id: 'analyst-1' } } })
        mockOrder.mockResolvedValue({
            data: [
                {
                    id: RESULT_ID,
                    sample_id: SAMPLE_ID,
                    assay_id: ASSAY_ID,
                    method_id: null,
                    value: '5.2',
                    status: 'entered',
                    entered_by: null,
                    entered_at: '2026-07-11T08:30:00.000Z',
                    approved_by: null,
                    approved_at: null,
                    approval_note: null,
                    created_at: '2026-07-11T08:00:00.000Z',
                    updated_at: '2026-07-11T09:00:00.000Z',
                    assay: {
                        name: 'Glucose',
                        units: 'mmol/L',
                        normal_range: '4.1 - 5.9',
                        method_name: 'Máy sinh hóa',
                        validation_rules: {},
                        updated_at: '2026-07-10T09:00:00.000Z',
                        lab_specialties: {
                            name: 'Sinh hóa',
                            display_order: 1,
                        },
                    },
                    method: null,
                    sample: {
                        sample_id: 'LIMS-001',
                        status: 'in_progress',
                        type: 'Máu',
                        received_at: '2026-07-11T07:00:00.000Z',
                        sample_quality: false,
                        clients: {
                            name: 'Nguyễn Văn A',
                            date_of_birth: '1990-01-01',
                            gender: 'Nam',
                            address: 'Cần Thơ',
                            health_insurance_num: 'BHYT-001',
                        },
                    },
                    entered_by_user: null,
                },
            ],
            error: null,
        })
    })

    it('returns configured ranges, revision tokens, and sample context for draft review', async () => {
        const result = await getResultsBySample(SAMPLE_ID)

        expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('normal_range'))
        expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('updated_at'))
        expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('sample_quality'))
        expect(result).toEqual({
            data: [
                expect.objectContaining({
                    normal_range: '4.1 - 5.9',
                    assay_updated_at: '2026-07-10T09:00:00.000Z',
                    sample_id_display: 'LIMS-001',
                    sample_type: 'Máu',
                    received_date: '2026-07-11T07:00:00.000Z',
                    sample_quality: false,
                    client_name: 'Nguyễn Văn A',
                    client_dob: '1990-01-01',
                    client_gender: 'Nam',
                    client_address: 'Cần Thơ',
                    client_health_insurance_num: 'BHYT-001',
                }),
            ],
        })
    })
})

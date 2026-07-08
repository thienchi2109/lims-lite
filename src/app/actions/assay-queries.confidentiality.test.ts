import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRpc = vi.fn()
const mockCreateClient = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { getAssayDefinitionById, getAssayDefinitions } from './assay-queries'

describe('assay query confidentiality mapping', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCreateClient.mockResolvedValue({ rpc: mockRpc })
    })

    it('returns is_confidential from the list RPC payload', async () => {
        mockRpc.mockResolvedValue({
            data: [
                {
                    id: '11111111-1111-4111-8111-111111111111',
                    name: 'HIV Ag/Ab',
                    specialty_id: null,
                    specialty_name: 'Vi sinh',
                    specialty_order: 1,
                    units: 'Index',
                    validation_rules: {},
                    is_confidential: true,
                    methods: [],
                    created_at: '2026-03-25T00:00:00.000Z',
                    updated_at: '2026-03-25T00:00:00.000Z',
                    total_count: 1,
                },
            ],
            error: null,
        })

        const result = await getAssayDefinitions()

        expect(result).toEqual(
            expect.objectContaining({
                data: [
                    expect.objectContaining({
                        is_confidential: true,
                    }),
                ],
            }),
        )
    })

    it('returns is_confidential from the detail RPC payload', async () => {
        mockRpc.mockResolvedValue({
            data: [
                {
                    id: '11111111-1111-4111-8111-111111111111',
                    name: 'HIV Ag/Ab',
                    specialty_id: null,
                    units: 'Index',
                    validation_rules: {},
                    is_confidential: true,
                    methods: [],
                    created_at: '2026-03-25T00:00:00.000Z',
                    updated_at: '2026-03-25T00:00:00.000Z',
                },
            ],
            error: null,
        })

        const result = await getAssayDefinitionById('11111111-1111-4111-8111-111111111111')

        expect(result).toEqual(
            expect.objectContaining({
                data: expect.objectContaining({
                    is_confidential: true,
                }),
            }),
        )
    })

    it('maps method_name from list and detail RPC payloads', async () => {
        mockRpc.mockResolvedValueOnce({
            data: [
                {
                    id: '11111111-1111-4111-8111-111111111111',
                    name: 'Anti HCV',
                    specialty_id: null,
                    specialty_name: 'Miễn dịch',
                    specialty_order: 1,
                    units: 'S/CO',
                    validation_rules: {},
                    is_confidential: false,
                    method_name: 'CLIA',
                    methods: [],
                    created_at: '2026-03-25T00:00:00.000Z',
                    updated_at: '2026-03-25T00:00:00.000Z',
                    total_count: 1,
                },
            ],
            error: null,
        })

        await expect(getAssayDefinitions()).resolves.toEqual(
            expect.objectContaining({
                data: [
                    expect.objectContaining({
                        method_name: 'CLIA',
                    }),
                ],
            }),
        )

        mockRpc.mockResolvedValueOnce({
            data: [
                {
                    id: '11111111-1111-4111-8111-111111111111',
                    name: 'Anti HCV',
                    specialty_id: null,
                    units: 'S/CO',
                    validation_rules: {},
                    is_confidential: false,
                    method_name: 'ELISA',
                    methods: [],
                    created_at: '2026-03-25T00:00:00.000Z',
                    updated_at: '2026-03-25T00:00:00.000Z',
                },
            ],
            error: null,
        })

        await expect(getAssayDefinitionById('11111111-1111-4111-8111-111111111111')).resolves.toEqual(
            expect.objectContaining({
                data: expect.objectContaining({
                    method_name: 'ELISA',
                }),
            }),
        )
    })

    it('fails closed when the list RPC omits is_confidential', async () => {
        mockRpc.mockResolvedValue({
            data: [
                {
                    id: '11111111-1111-4111-8111-111111111111',
                    name: 'HIV Ag/Ab',
                    specialty_id: null,
                    specialty_name: 'Vi sinh',
                    specialty_order: 1,
                    units: 'Index',
                    validation_rules: {},
                    methods: [],
                    created_at: '2026-03-25T00:00:00.000Z',
                    updated_at: '2026-03-25T00:00:00.000Z',
                    total_count: 1,
                },
            ],
            error: null,
        })

        const result = await getAssayDefinitions()

        expect(result).toEqual({
            error: 'Thiếu trạng thái bảo mật của chỉ tiêu xét nghiệm',
        })
    })

    it('fails closed when the detail RPC omits is_confidential', async () => {
        mockRpc.mockResolvedValue({
            data: [
                {
                    id: '11111111-1111-4111-8111-111111111111',
                    name: 'HIV Ag/Ab',
                    specialty_id: null,
                    units: 'Index',
                    validation_rules: {},
                    methods: [],
                    created_at: '2026-03-25T00:00:00.000Z',
                    updated_at: '2026-03-25T00:00:00.000Z',
                },
            ],
            error: null,
        })

        const result = await getAssayDefinitionById('11111111-1111-4111-8111-111111111111')

        expect(result).toEqual({
            error: 'Thiếu trạng thái bảo mật của chỉ tiêu xét nghiệm',
        })
    })
})

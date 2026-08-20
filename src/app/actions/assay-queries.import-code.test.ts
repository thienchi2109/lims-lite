import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRpc = vi.fn()
const mockCreateClient = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { getAssayDefinitionById, getAssayDefinitions } from './assay-queries'

const assayRow = {
    id: '11111111-1111-4111-8111-111111111111',
    import_code: 'CT-000001',
    name: 'Anti HCV',
    specialty_id: null,
    specialty_name: 'Miễn dịch',
    specialty_order: 1,
    units: 'S/CO',
    method_name: 'CLIA',
    normal_range: null,
    validation_rules: {},
    is_confidential: false,
    methods: [],
    created_at: '2026-08-20T00:00:00.000Z',
    updated_at: '2026-08-20T00:00:00.000Z',
}

describe('assay query import code mapping', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCreateClient.mockResolvedValue({ rpc: mockRpc })
    })

    it('preserves import_code from paginated list rows', async () => {
        mockRpc.mockResolvedValue({
            data: [{ ...assayRow, total_count: 1 }],
            error: null,
        })

        await expect(getAssayDefinitions()).resolves.toEqual(
            expect.objectContaining({
                data: [
                    expect.objectContaining({
                        import_code: 'CT-000001',
                        method_name: 'CLIA',
                    }),
                ],
            }),
        )
    })

    it('preserves import_code from detail rows', async () => {
        mockRpc.mockResolvedValue({
            data: [assayRow],
            error: null,
        })

        await expect(
            getAssayDefinitionById('11111111-1111-4111-8111-111111111111'),
        ).resolves.toEqual(
            expect.objectContaining({
                data: expect.objectContaining({
                    import_code: 'CT-000001',
                    method_name: 'CLIA',
                }),
            }),
        )
    })
})

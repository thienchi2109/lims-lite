import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.fn()
const mockRpc = vi.fn()
const mockRevalidatePath = vi.fn()
const mockRequireRole = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

vi.mock('@/lib/auth-helpers', () => ({
    requireRole: (...args: unknown[]) => mockRequireRole(...args),
    isAuthError: (value: unknown) => Boolean(value && typeof value === 'object' && 'error' in value),
}))

import { assignTests } from './sample-tests'

const assignmentPayload = {
    sampleId: '11111111-1111-4111-8111-111111111111',
    sampleTypeId: '55555555-5555-4555-8555-555555555555',
    sampleTypeCode: 'LM-000001',
    expectedRevisionNumber: 7,
    tests: [{
        assayId: '33333333-3333-4333-8333-333333333333',
        methodId: '44444444-4444-4444-8444-444444444444',
    }],
} as Parameters<typeof assignTests>[0]

describe('supplemental assignment v2 Server Action contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRequireRole.mockResolvedValue({
            id: '22222222-2222-4222-8222-222222222222',
            role: 'analyst',
        })
        mockRpc.mockResolvedValue({
            data: {
                inserted_count: 1,
                new_status: 'assigned',
                compatibility_revision_number: 7,
            },
            error: null,
        })
        mockCreateClient.mockResolvedValue({ rpc: mockRpc })
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('uses assign_tests_to_sample_v2 with sample-type id and expected revision', async () => {
        const result = await assignTests(assignmentPayload)

        expect(mockRequireRole).toHaveBeenCalledWith(['analyst', 'manager'])
        expect(mockRpc).toHaveBeenCalledWith('assign_tests_to_sample_v2', {
            p_sample_id: '11111111-1111-4111-8111-111111111111',
            p_sample_type_id: '55555555-5555-4555-8555-555555555555',
            p_tests: [{
                assayId: '33333333-3333-4333-8333-333333333333',
                methodId: '44444444-4444-4444-8444-444444444444',
            }],
            p_expected_revision_number: 7,
        })
        expect(result).toEqual({
            success: true,
            data: {
                inserted_count: 1,
                new_status: 'assigned',
                compatibility_revision_number: 7,
            },
        })
    })

    it('rejects legacy assignment payloads before any RPC call', async () => {
        const result = await assignTests({
            sampleId: '11111111-1111-4111-8111-111111111111',
            tests: assignmentPayload.tests,
        } as never)

        expect(result).toEqual({
            error: 'Dữ liệu chỉ định đã cũ. Vui lòng tải lại trang và chọn lại loại mẫu.',
        })
        expect(mockRpc).not.toHaveBeenCalled()
    })

    it('maps stale revision SQLSTATE to a safe reload message', async () => {
        mockRpc.mockResolvedValueOnce({
            data: null,
            error: {
                code: 'P1101',
                message: 'Compatibility catalog revision is stale',
                details: 'expected_revision_number=7 current_revision_number=8',
            },
        })

        const result = await assignTests(assignmentPayload)

        expect(result).toEqual({
            error: 'Catalog tương thích đã thay đổi. Vui lòng tải lại trang và chọn lại loại mẫu.',
        })
    })
})

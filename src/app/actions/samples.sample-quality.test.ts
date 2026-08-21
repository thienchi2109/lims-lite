import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockRequireRole = vi.fn()
const mockIsAuthError = vi.fn()
const mockCreateClient = vi.fn()
const mockRpc = vi.fn()

vi.mock('@/lib/auth-helpers', () => ({
    requireAuth: vi.fn(),
    requireRole: (...args: unknown[]) => mockRequireRole(...args),
    isAuthError: (...args: unknown[]) => mockIsAuthError(...args),
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}))

import { accessionAndAssignTests, createSample } from './samples'

const analyst = {
    id: '11111111-1111-4111-8111-111111111111',
    role: 'analyst',
}

function createSamplePayload(sampleQuality?: boolean) {
    return {
        client_id: '22222222-2222-4222-8222-222222222222',
        client_name: 'Nguyen Van A',
        type: 'Máu',
        sampleTypeId: '55555555-5555-4555-8555-555555555555',
        sampleTypeCode: 'LM-000001',
        expectedRevisionNumber: 7,
        received_at: '2026-07-20T08:30:00.000Z',
        ...(sampleQuality === undefined ? {} : { sample_quality: sampleQuality }),
    } as Parameters<typeof createSample>[0]
}

function createAssignedPayload(sampleQuality?: boolean) {
    return {
        client_id: '22222222-2222-4222-8222-222222222222',
        client_name: 'Nguyen Van A',
        type: 'Máu',
        sampleTypeId: '55555555-5555-4555-8555-555555555555',
        sampleTypeCode: 'LM-000001',
        expectedRevisionNumber: 7,
        received_at: '2026-07-20T08:30:00.000Z',
        tests: [{
            assayId: '33333333-3333-4333-8333-333333333333',
            methodId: '44444444-4444-4444-8444-444444444444',
        }],
        ...(sampleQuality === undefined ? {} : { sample_quality: sampleQuality }),
    } as Parameters<typeof accessionAndAssignTests>[0]
}

describe('sample quality Server Action contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRequireRole.mockResolvedValue(analyst)
        mockIsAuthError.mockReturnValue(false)
        mockRpc.mockResolvedValue({ data: { id: 'sample-1' }, error: null })
        mockCreateClient.mockResolvedValue({ rpc: mockRpc })
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('passes acceptable quality to create_sample_atomic_v2 with the exact RPC contract', async () => {
        await createSample(createSamplePayload(true))

        expect(mockRequireRole).toHaveBeenCalledWith('analyst')
        expect(mockRpc).toHaveBeenCalledWith('create_sample_atomic_v2', {
            p_client_id: '22222222-2222-4222-8222-222222222222',
            p_client_name: 'Nguyen Van A',
            p_received_at: '2026-07-20T08:30:00.000Z',
            p_received_by: analyst.id,
            p_sample_type_id: '55555555-5555-4555-8555-555555555555',
            p_sample_quality: true,
            p_expected_revision_number: 7,
        })
    })

    it('passes unacceptable quality to accession_and_assign_tests_v2 with the exact RPC contract', async () => {
        await accessionAndAssignTests(createAssignedPayload(false))

        expect(mockRequireRole).toHaveBeenCalledWith('analyst')
        expect(mockRpc).toHaveBeenCalledWith('accession_and_assign_tests_v2', {
            p_client_id: '22222222-2222-4222-8222-222222222222',
            p_client_name: 'Nguyen Van A',
            p_received_at: '2026-07-20T08:30:00.000Z',
            p_tests: [{
                assayId: '33333333-3333-4333-8333-333333333333',
                methodId: '44444444-4444-4444-8444-444444444444',
            }],
            p_sample_type_id: '55555555-5555-4555-8555-555555555555',
            p_sample_quality: false,
            p_expected_revision_number: 7,
        })
    })

    it('rejects legacy accession payloads with a reload instruction before any RPC call', async () => {
        const legacyPayload = {
            client_id: '22222222-2222-4222-8222-222222222222',
            client_name: 'Nguyen Van A',
            type: 'Máu',
            received_at: '2026-07-20T08:30:00.000Z',
            sample_quality: true,
            tests: [{
                assayId: '33333333-3333-4333-8333-333333333333',
                methodId: '44444444-4444-4444-8444-444444444444',
            }],
        }

        const result = await accessionAndAssignTests(legacyPayload as never)

        expect(result).toEqual({
            error: 'Dữ liệu chỉ định đã cũ. Vui lòng tải lại trang và chọn lại loại mẫu.',
        })
        expect(mockRpc).not.toHaveBeenCalled()
    })

    it('maps assignment v2 SQLSTATE errors to safe Vietnamese messages', async () => {
        mockRpc.mockResolvedValueOnce({
            data: null,
            error: {
                code: 'P1105',
                message: 'Assay and sample type are incompatible',
                details: 'assay_id=hidden sample_type_id=hidden',
            },
        })

        const result = await accessionAndAssignTests(createAssignedPayload(true))

        expect(result).toEqual({
            error: 'Chỉ tiêu đã chọn không tương thích với loại mẫu. Vui lòng chọn lại.',
        })
    })

    it('preserves an unacceptable quality sample response without changing workflow state', async () => {
        const sample = {
            id: 'sample-1',
            sample_quality: false,
            status: 'received',
        }
        mockRpc.mockResolvedValueOnce({ data: sample, error: null })

        const result = await createSample(createSamplePayload(false))

        expect(result).toEqual({ data: sample })
    })

    it('preserves an unacceptable quality accession response and its results', async () => {
        const rpcResult = {
            sample: {
                id: 'sample-1',
                sample_quality: false,
                status: 'assigned',
            },
            results: [{ id: 'result-1', status: 'pending' }],
        }
        mockRpc.mockResolvedValueOnce({ data: rpcResult, error: null })

        const result = await accessionAndAssignTests(createAssignedPayload(false))

        expect(result).toEqual({ data: rpcResult })
    })

    it.each([
        ['createSample', createSample, createSamplePayload()],
        ['accessionAndAssignTests', accessionAndAssignTests, createAssignedPayload()],
    ])('rejects missing quality before any database call in %s', async (
        _name,
        action,
        payload,
    ) => {
        const result = await action(payload as never)

        expect(result).toEqual({
            error: expect.stringMatching(/sample_quality|chất lượng mẫu/i),
        })
        expect(mockRpc).not.toHaveBeenCalled()
    })

    it.each([
        ['createSample', createSample, createSamplePayload(true)],
        ['accessionAndAssignTests', accessionAndAssignTests, createAssignedPayload(false)],
    ])('keeps analyst authorization ahead of %s', async (
        _name,
        action,
        payload,
    ) => {
        mockRequireRole.mockResolvedValueOnce({
            error: 'Only analyst can perform this action',
        })
        mockIsAuthError.mockReturnValueOnce(true)

        const result = await action(payload as never)

        expect(result).toEqual({ error: 'Only analyst can perform this action' })
        expect(mockRequireRole).toHaveBeenCalledWith('analyst')
        expect(mockCreateClient).not.toHaveBeenCalled()
        expect(mockRpc).not.toHaveBeenCalled()
    })
})

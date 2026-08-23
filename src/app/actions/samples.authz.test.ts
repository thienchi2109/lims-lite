import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRequireAuth = vi.fn()
const mockRequireRole = vi.fn()
const mockIsAuthError = vi.fn()
const mockRpc = vi.fn()
const mockUpdateEq = vi.fn()
const mockUpdate = vi.fn()
const mockFrom = vi.fn()
const mockRevalidatePath = vi.fn()

vi.mock('server-only', () => ({}))

vi.mock('@/lib/auth-helpers', () => ({
    requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
    requireRole: (...args: unknown[]) => mockRequireRole(...args),
    isAuthError: (...args: unknown[]) => mockIsAuthError(...args),
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        rpc: mockRpc,
        from: mockFrom,
    })),
}))

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

import { accessionAndAssignTests, createSample, recordSampleLabelPrint, updateSample } from './samples'

const TEST_ANALYST = { id: '11111111-1111-4111-8111-111111111111', role: 'analyst' }
const TEST_MANAGER = { id: '22222222-2222-4222-8222-222222222222', role: 'manager' }

describe('sample mutation authorization', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mockIsAuthError.mockReturnValue(false)
        mockRequireRole.mockResolvedValue(TEST_ANALYST)
        mockRequireAuth.mockResolvedValue(TEST_MANAGER)
        mockRpc.mockResolvedValue({ data: { id: 'sample-1' }, error: null })
        mockUpdateEq.mockResolvedValue({
            data: [{ id: 'sample-1', client_name: 'Updated client' }],
            error: null,
        })
        mockUpdate.mockReturnValue({
            eq: mockUpdateEq,
            select: vi.fn(),
        })
        mockFrom.mockReturnValue({
            update: () => ({
                eq: () => ({
                    select: vi.fn(async () => ({
                        data: [{ id: 'sample-1', client_name: 'Updated client' }],
                        error: null,
                    })),
                }),
            }),
        })
    })

    it('rejects createSample when caller is not an analyst', async () => {
        mockRequireRole.mockResolvedValueOnce({ error: 'Only analyst can perform this action' })
        mockIsAuthError.mockReturnValueOnce(true)

        const result = await createSample({
            client_id: '33333333-3333-4333-8333-333333333333',
            type: 'Máu',
        })

        expect(result).toEqual({ error: 'Only analyst can perform this action' })
        expect(mockRequireRole).toHaveBeenCalledWith('analyst')
        expect(mockRpc).not.toHaveBeenCalled()
    })

    it('rejects accessionAndAssignTests when caller is not an analyst', async () => {
        mockRequireRole.mockResolvedValueOnce({ error: 'Only analyst can perform this action' })
        mockIsAuthError.mockReturnValueOnce(true)

        const result = await accessionAndAssignTests({
            client_id: '33333333-3333-4333-8333-333333333333',
            client_name: 'Nguyen Van A',
            type: 'Máu',
            tests: [{ assayId: '44444444-4444-4444-8444-444444444444', methodId: '55555555-5555-4555-8555-555555555555' }],
        })

        expect(result).toEqual({ error: 'Only analyst can perform this action' })
        expect(mockRequireRole).toHaveBeenCalledWith('analyst')
        expect(mockRpc).not.toHaveBeenCalled()
    })

    it('keeps updateSample available to authenticated managers for metadata edits', async () => {
        const result = await updateSample({
            id: '66666666-6666-4666-8666-666666666666',
            client_name: 'Updated client',
        })

        expect(mockRequireAuth).toHaveBeenCalled()
        expect(result).toEqual({
            data: expect.objectContaining({
                id: 'sample-1',
                client_name: 'Updated client',
            }),
        })
    })

    it('records sample label print requests through the audited RPC for authenticated staff', async () => {
        const result = await recordSampleLabelPrint({
            sampleId: '77777777-7777-4777-8777-777777777777',
            copies: 1,
            preset: 'thermal-35x23-sheet-2up',
        })

        expect(mockRequireAuth).toHaveBeenCalled()
        expect(mockRpc).toHaveBeenCalledWith('record_sample_label_print', {
            p_sample_id: '77777777-7777-4777-8777-777777777777',
            p_copies: 1,
            p_label_preset: 'thermal-35x23-sheet-2up',
        })
        expect(result).toEqual({ data: { id: 'sample-1' } })
    })
})

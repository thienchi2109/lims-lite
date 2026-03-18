import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSingle = vi.fn()
const mockSelectEq = vi.fn()
const mockUpdateEq = vi.fn()
const mockSelect = vi.fn()
const mockUpdate = vi.fn()
const mockFrom = vi.fn()
const mockRequireRole = vi.fn()
const mockRevalidatePath = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        from: mockFrom,
    })),
}))

vi.mock('@/lib/auth-helpers', () => ({
    requireRole: (...args: unknown[]) => mockRequireRole(...args),
    isAuthError: vi.fn(() => false),
}))

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

import { discardSample } from '@/app/actions/sample-approvals'

const TEST_SAMPLE_ID = 'a1111111-1111-4111-8111-111111111111'
const TEST_MANAGER_ID = 'b2222222-2222-4222-8222-222222222222'

describe('discardSample status gate', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mockRequireRole.mockResolvedValue({ id: TEST_MANAGER_ID, role: 'manager' })

        mockSelectEq.mockReturnValue({ single: mockSingle })
        mockUpdate.mockReturnValue({ eq: mockUpdateEq })
        mockSelect.mockReturnValue({ eq: mockSelectEq })

        mockFrom.mockImplementation((table: string) => {
            if (table !== 'samples') {
                throw new Error(`Unexpected table: ${table}`)
            }
            return {
                select: mockSelect,
                update: mockUpdate,
            }
        })

        mockUpdateEq.mockResolvedValue({ error: null })
    })

    it('allows discarding samples in in_progress status', async () => {
        mockSingle.mockResolvedValue({
            data: { id: TEST_SAMPLE_ID, status: 'in_progress' },
            error: null,
        })

        const result = await discardSample({
            sampleId: TEST_SAMPLE_ID,
            reason: 'Discard after manager review',
        })

        expect(result).toEqual({ success: true })
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'discarded',
                rejection_reason: 'Discard after manager review',
                rejected_by: TEST_MANAGER_ID,
            }),
        )
        expect(mockRevalidatePath).toHaveBeenCalledWith('/manager/samples')
    })

    it('rejects non-discardable statuses (completed) and does not update', async () => {
        mockSingle.mockResolvedValue({
            data: { id: TEST_SAMPLE_ID, status: 'completed' },
            error: null,
        })

        const result = await discardSample({
            sampleId: TEST_SAMPLE_ID,
            reason: 'Should not discard completed',
        })

        expect(result).toEqual({
            error: 'Cannot discard samples with status "completed". Only received, assigned, in_progress, or review samples can be discarded.',
        })
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(mockRevalidatePath).not.toHaveBeenCalled()
    })
})

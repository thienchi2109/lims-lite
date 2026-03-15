/**
 * Tests for useCoaActions hook.
 *
 * Verifies CoA generation handler: calling regenerateCoA,
 * updating status via setter, and toast notifications.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCoaActions } from '../use-coa-actions'

vi.mock('@/lib/api-client', () => ({
    regenerateCoAClient: vi.fn(),
}))

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}))

import { regenerateCoAClient } from '@/lib/api-client'
import { toast } from 'sonner'

const mockRegenerateCoA = vi.mocked(regenerateCoAClient)

describe('useCoaActions', () => {
    const setCoaStatus = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('starts with isGeneratingCoA=false', () => {
        const { result } = renderHook(() => useCoaActions('sample-1', setCoaStatus))
        expect(result.current.isGeneratingCoA).toBe(false)
    })

    it('calls regenerateCoA with sampleId', async () => {
        mockRegenerateCoA.mockResolvedValue({ success: true })

        const { result } = renderHook(() => useCoaActions('sample-1', setCoaStatus))

        await act(async () => { await result.current.handleGenerateCoA() })

        expect(mockRegenerateCoA).toHaveBeenCalledWith('sample-1')
    })

    it('sets coaStatus to ready and toasts on success', async () => {
        mockRegenerateCoA.mockResolvedValue({ success: true })

        const { result } = renderHook(() => useCoaActions('sample-1', setCoaStatus))

        await act(async () => { await result.current.handleGenerateCoA() })

        expect(setCoaStatus).toHaveBeenCalledWith('ready')
        expect(toast.success).toHaveBeenCalledWith('Đã tạo CoA thành công')
    })

    it('sets coaStatus to failed and toasts on server error', async () => {
        mockRegenerateCoA.mockResolvedValue({ success: false, error: 'DB error' })

        const { result } = renderHook(() => useCoaActions('sample-1', setCoaStatus))

        await act(async () => { await result.current.handleGenerateCoA() })

        expect(setCoaStatus).toHaveBeenCalledWith('failed')
        expect(toast.error).toHaveBeenCalledWith('Lỗi khi tạo CoA: DB error')
    })

    it('toasts on unexpected throw', async () => {
        mockRegenerateCoA.mockRejectedValue(new Error('Network down'))

        const { result } = renderHook(() => useCoaActions('sample-1', setCoaStatus))

        await act(async () => { await result.current.handleGenerateCoA() })

        expect(toast.error).toHaveBeenCalledWith('Có lỗi không mong đợi khi tạo CoA')
    })
})

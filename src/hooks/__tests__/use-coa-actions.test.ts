/**
 * Tests for useCoaActions hook.
 *
 * Verifies CoA generation handler: calling regenerateCoA,
 * updating status via setter, and toast notifications.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
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

    it('sets coaStatus to failed and surfaces thrown client-wrapper errors', async () => {
        mockRegenerateCoA.mockRejectedValue(new Error('Network down'))
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const { result } = renderHook(() => useCoaActions('sample-1', setCoaStatus))

        await act(async () => { await result.current.handleGenerateCoA() })

        expect(setCoaStatus).toHaveBeenCalledWith('failed')
        expect(toast.error).toHaveBeenCalledWith('Lỗi khi tạo CoA: Network down')
        consoleErrorSpy.mockRestore()
    })

    it('falls back to a generic message for non-Error throws', async () => {
        mockRegenerateCoA.mockRejectedValue('boom')
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const { result } = renderHook(() => useCoaActions('sample-1', setCoaStatus))

        await act(async () => { await result.current.handleGenerateCoA() })

        expect(setCoaStatus).toHaveBeenCalledWith('failed')
        expect(toast.error).toHaveBeenCalledWith('Lỗi khi tạo CoA: Có lỗi không mong đợi khi tạo CoA')
        consoleErrorSpy.mockRestore()
    })

    it('ignores stale generation results after the sample changes', async () => {
        let resolveGeneration!: (value: { success: true }) => void
        const pendingGeneration = new Promise<{ success: true }>((resolve) => {
            resolveGeneration = resolve
        })
        mockRegenerateCoA.mockReturnValueOnce(pendingGeneration as any)

        const { result, rerender } = renderHook(
            ({ id }) => useCoaActions(id, setCoaStatus),
            { initialProps: { id: 'sample-A' } },
        )

        let generationPromise!: Promise<void>
        act(() => {
            generationPromise = result.current.handleGenerateCoA()
        })

        await waitFor(() => expect(result.current.isGeneratingCoA).toBe(true))

        rerender({ id: 'sample-B' })

        await waitFor(() => expect(result.current.isGeneratingCoA).toBe(false))

        await act(async () => {
            resolveGeneration({ success: true })
            await generationPromise
        })

        expect(setCoaStatus).not.toHaveBeenCalledWith('ready')
        expect(setCoaStatus).not.toHaveBeenCalledWith('failed')
    })

    it('keeps the current sample marked as generating when returning to it mid-request', async () => {
        let resolveGeneration!: (value: { success: true }) => void
        const pendingGeneration = new Promise<{ success: true }>((resolve) => {
            resolveGeneration = resolve
        })
        mockRegenerateCoA.mockReturnValueOnce(pendingGeneration as any)

        const { result, rerender } = renderHook(
            ({ id }) => useCoaActions(id, setCoaStatus),
            { initialProps: { id: 'sample-A' } },
        )

        let generationPromise!: Promise<void>
        act(() => {
            generationPromise = result.current.handleGenerateCoA()
        })

        await waitFor(() => expect(result.current.isGeneratingCoA).toBe(true))

        rerender({ id: 'sample-B' })
        await waitFor(() => expect(result.current.isGeneratingCoA).toBe(false))

        rerender({ id: 'sample-A' })
        await waitFor(() => expect(result.current.isGeneratingCoA).toBe(true))

        await act(async () => {
            resolveGeneration({ success: true })
            await generationPromise
        })

        expect(result.current.isGeneratingCoA).toBe(false)
    })
})

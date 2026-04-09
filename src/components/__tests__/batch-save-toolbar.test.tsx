import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BatchSaveToolbar } from '../batch-save-toolbar'

describe('BatchSaveToolbar', () => {
    it('shows a success state after saving clears all pending changes', async () => {
        vi.useFakeTimers()

        const { rerender } = render(
            <BatchSaveToolbar
                pendingCount={2}
                onSave={vi.fn()}
                onDiscard={vi.fn()}
                isSaving
                isVisible
            />
        )
        await act(async () => {})

        rerender(
            <BatchSaveToolbar
                pendingCount={0}
                onSave={vi.fn()}
                onDiscard={vi.fn()}
                isSaving={false}
                isVisible={false}
            />
        )

        await act(async () => {})

        expect(screen.getByText('Đã lưu thay đổi thành công!')).toBeDefined()

        vi.useRealTimers()
    })
})

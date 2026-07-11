import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRefresh = vi.hoisted(() => vi.fn())
const mockRegenerateCoAClient = vi.hoisted(() => vi.fn())
const mockToastSuccess = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: mockRefresh }),
}))

vi.mock('@/lib/api-client', () => ({
    regenerateCoAClient: (...args: unknown[]) =>
        mockRegenerateCoAClient(...args),
}))

vi.mock('sonner', () => ({
    toast: {
        success: (...args: unknown[]) => mockToastSuccess(...args),
        error: vi.fn(),
    },
}))

import { CoAActionButton } from '@/components/coa-action-button'

describe('CoAActionButton', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRegenerateCoAClient.mockResolvedValue({ success: true })
    })

    it('retries a failed CoA through the API client', async () => {
        const user = userEvent.setup()

        render(
            <CoAActionButton
                sampleId="11111111-1111-4111-8111-111111111111"
                coaStatus="failed"
            />,
        )

        await user.click(
            screen.getByRole('button', { name: 'Tạo lại CoA' }),
        )

        expect(mockRegenerateCoAClient).toHaveBeenCalledWith(
            '11111111-1111-4111-8111-111111111111',
        )
        await waitFor(() => {
            expect(mockToastSuccess).toHaveBeenCalledWith(
                'Đã tạo CoA thành công',
            )
            expect(mockRefresh).toHaveBeenCalledOnce()
        })
    })
})

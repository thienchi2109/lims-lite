import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockInvalidateQueries = vi.fn()
const mockRefresh = vi.fn()
const mockPush = vi.fn()

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children }: { children: any }) => <>{children}</>,
    DialogContent: ({ children }: { children: any }) => <>{children}</>,
    DialogHeader: ({ children }: { children: any }) => <>{children}</>,
    DialogFooter: ({ children }: { children: any }) => <>{children}</>,
    DialogTitle: ({ children }: { children: any }) => <>{children}</>,
    DialogDescription: ({ children }: { children: any }) => <>{children}</>,
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
    }),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        refresh: mockRefresh,
        push: mockPush,
    }),
}))

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('@/lib/api-client', () => ({
    rejectSampleClient: vi.fn(),
}))

import { rejectSampleClient } from '@/lib/api-client'
import { RejectSampleDialog } from '../reject-sample-dialog'
import { approvalKeys, rejectionKeys } from '@/types/query-keys'

const mockRejectSampleClient = vi.mocked(rejectSampleClient)

describe('RejectSampleDialog rejection invalidation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('invalidates approval and rejection counts after a successful reject', async () => {
        mockRejectSampleClient.mockResolvedValue({ success: true })

        render(<RejectSampleDialog sampleId="sample-1" open onOpenChange={vi.fn()} />)

        fireEvent.change(screen.getByPlaceholderText('Nhập lý do từ chối...'), {
            target: { value: 'Need to re-check' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Từ chối mẫu' }))

        await waitFor(() =>
            expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: approvalKeys.count }),
        )
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: rejectionKeys.count })
    })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockInvalidateQueries = vi.fn()
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
        push: mockPush,
    }),
    useSearchParams: () => new URLSearchParams('page=2'),
    usePathname: () => '/manager/approvals',
}))

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('@/lib/api-client', () => ({
    discardSampleClient: vi.fn(),
}))

import { discardSampleClient } from '@/lib/api-client'
import { DiscardSampleDialog } from '../discard-sample-dialog'
import { approvalKeys, rejectionKeys } from '@/types/query-keys'

const mockDiscardSampleClient = vi.mocked(discardSampleClient)

describe('DiscardSampleDialog rejection invalidation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('invalidates approval and rejection counts after a successful discard', async () => {
        mockDiscardSampleClient.mockResolvedValue({ success: true })

        render(<DiscardSampleDialog sampleId="sample-1" open onOpenChange={vi.fn()} />)

        fireEvent.change(screen.getByPlaceholderText('Nhập lý do loại bỏ...'), {
            target: { value: 'Discard reason' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Xác nhận loại bỏ' }))

        await waitFor(() =>
            expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: approvalKeys.count }),
        )
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: rejectionKeys.count })
    })
})

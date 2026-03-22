import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockInvalidateQueries = vi.fn()
const mockPush = vi.fn()

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) => (open ? <>{children}</> : null),
    DialogContent: ({ children }: { children?: ReactNode }) => <>{children}</>,
    DialogHeader: ({ children }: { children?: ReactNode }) => <>{children}</>,
    DialogFooter: ({ children }: { children?: ReactNode }) => <>{children}</>,
    DialogTitle: ({ children }: { children?: ReactNode }) => <>{children}</>,
    DialogDescription: ({ children }: { children?: ReactNode }) => <>{children}</>,
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

    it('invalidates approval queue caches and badge counts after a successful discard', async () => {
        mockDiscardSampleClient.mockResolvedValue({ success: true })

        const onOpenChange = vi.fn()
        const { rerender } = render(
            <DiscardSampleDialog sampleId="sample-1" open={false} onOpenChange={onOpenChange} />,
        )

        expect(screen.queryByRole('button', { name: 'Xác nhận loại bỏ' })).toBeNull()

        rerender(<DiscardSampleDialog sampleId="sample-1" open onOpenChange={onOpenChange} />)

        fireEvent.change(screen.getByPlaceholderText('Nhập lý do loại bỏ...'), {
            target: { value: 'Discard reason' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Xác nhận loại bỏ' }))

        await waitFor(() =>
            expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: approvalKeys.count }),
        )
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: approvalKeys.all })
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: rejectionKeys.count })
    })
})

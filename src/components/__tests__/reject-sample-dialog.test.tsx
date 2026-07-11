import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockInvalidateQueries = vi.fn()
const mockRefetchQueries = vi.fn()
const mockRefresh = vi.fn()
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
        refetchQueries: mockRefetchQueries,
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

    it('invalidates approval queue caches and badge counts after a successful reject', async () => {
        const user = userEvent.setup()
        mockRejectSampleClient.mockResolvedValue({ success: true })

        const onOpenChange = vi.fn()
        const { rerender } = render(
            <RejectSampleDialog sampleId="sample-1" open={false} onOpenChange={onOpenChange} />,
        )

        expect(screen.queryByRole('button', { name: 'Từ chối mẫu' })).toBeNull()

        rerender(<RejectSampleDialog sampleId="sample-1" open onOpenChange={onOpenChange} />)

        await user.type(
            screen.getByPlaceholderText('Nhập lý do từ chối...'),
            'Cần kiểm tra lại',
        )
        await user.click(screen.getByRole('button', { name: 'Từ chối mẫu' }))

        await waitFor(() =>
            expect(mockInvalidateQueries).toHaveBeenCalledWith({
                queryKey: approvalKeys.all,
                refetchType: 'all',
            }),
        )
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: approvalKeys.all,
            refetchType: 'all',
        })
        expect(mockInvalidateQueries).not.toHaveBeenCalledWith({
            queryKey: approvalKeys.count,
        })
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: rejectionKeys.count })
        expect(mockRefetchQueries).not.toHaveBeenCalled()
    })
})

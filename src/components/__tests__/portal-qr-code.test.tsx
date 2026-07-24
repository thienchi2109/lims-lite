import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockOpenDetachedHtmlDocument = vi.hoisted(() => vi.fn())
const mockToastError = vi.hoisted(() => vi.fn())

vi.mock('@/lib/detached-html-document', () => ({
    openDetachedHtmlDocument: mockOpenDetachedHtmlDocument,
}))

vi.mock('sonner', () => ({
    toast: { error: mockToastError },
}))

import { PortalQRCode } from '../portal-qr-code'

describe('PortalQRCode', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('prints the portal QR document in a detached browsing context', () => {
        render(<PortalQRCode size={240} showInstructions />)

        fireEvent.click(screen.getByRole('button', { name: 'In mã QR' }))

        expect(mockOpenDetachedHtmlDocument).toHaveBeenCalledWith(
            expect.stringContaining('Cổng Tra Cứu Giấy Chứng Nhận Xét Nghiệm'),
            {
                autoPrint: true,
                onBlocked: expect.any(Function),
                onFailed: expect.any(Function),
            },
        )

        const html = mockOpenDetachedHtmlDocument.mock.calls[0]?.[0] ?? ''
        expect(html).toContain('api.qrserver.com')
        expect(html).not.toContain('window.print()')

        mockOpenDetachedHtmlDocument.mock.calls[0]?.[1]?.onBlocked()
        mockOpenDetachedHtmlDocument.mock.calls[0]?.[1]?.onFailed()
        expect(mockToastError).toHaveBeenCalledWith('Trình duyệt đã chặn cửa sổ in')
        expect(mockToastError).toHaveBeenCalledWith('Không thể mở tài liệu in')
    })
})

/**
 * Tests for usePrintHandlers hook.
 *
 * Verifies print template generation and CoA body printing,
 * including popup blocked scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { usePrintHandlers } from '../use-print-handlers'

vi.mock('@/hooks/use-sample-detail', () => ({
    fetchSampleDetail: vi.fn(),
}))

vi.mock('@/lib/print-template', () => ({
    generatePrintTemplate: vi.fn(),
}))

vi.mock('@/lib/sample-label-print-client', () => ({
    printSampleBarcodeLabel: vi.fn(),
}))

const mockPendingPrintDocument = vi.hoisted(() => ({
    render: vi.fn(),
    close: vi.fn(),
}))
const mockOpenPendingDetachedHtmlDocument = vi.hoisted(() => vi.fn())

vi.mock('@/lib/detached-html-document', () => ({
    openPendingDetachedHtmlDocument: mockOpenPendingDetachedHtmlDocument,
}))

vi.mock('sonner', () => ({
    toast: { error: vi.fn() },
}))

import { fetchSampleDetail } from '@/hooks/use-sample-detail'
import { generatePrintTemplate } from '@/lib/print-template'
import { printSampleBarcodeLabel } from '@/lib/sample-label-print-client'
import { toast } from 'sonner'

const mockFetchDetail = vi.mocked(fetchSampleDetail)
const mockTemplate = vi.mocked(generatePrintTemplate)
const mockPrintSampleBarcodeLabel = vi.mocked(printSampleBarcodeLabel)

describe('usePrintHandlers', () => {
    const results = [{ id: 'r1', assay_name: 'Glucose', value: '5.0' }] as any[]

    beforeEach(() => {
        vi.clearAllMocks()
        mockOpenPendingDetachedHtmlDocument.mockReturnValue(mockPendingPrintDocument)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('handlePrint', () => {
        it('loads the test-order HTML into preview state without opening a new tab', async () => {
            let resolveDetail: ((value: any) => void) | undefined
            const detailPromise = new Promise((resolve) => {
                resolveDetail = resolve
            })

            mockFetchDetail.mockReturnValue(detailPromise as Promise<any>)
            mockTemplate.mockReturnValue('<html>Print Content</html>')
            const openSpy = vi.spyOn(window, 'open')

            const { result } = renderHook(() => usePrintHandlers('sample-1', results))

            let printPromise: Promise<void>

            act(() => {
                printPromise = result.current.handlePrint()
            })

            await waitFor(() => {
                expect(result.current.printPreview.loading).toBe(true)
                expect(result.current.printPreview.open).toBe(true)
            })

            resolveDetail?.({ id: 'sample-1', sample_code: 'S001' } as any)

            await act(async () => {
                await printPromise
            })

            expect(openSpy).not.toHaveBeenCalled()
            expect(mockFetchDetail).toHaveBeenCalledWith('sample-1')
            expect(mockTemplate).toHaveBeenCalled()
            expect(result.current.printPreview).toMatchObject({
                open: true,
                loading: false,
                error: null,
                html: '<html>Print Content</html>',
            })
        })

        it('closes and clears the test-order preview', async () => {
            mockFetchDetail.mockResolvedValue({ id: 'sample-1', sample_code: 'S001' } as any)
            mockTemplate.mockReturnValue('<html>Print Content</html>')

            const { result } = renderHook(() => usePrintHandlers('sample-1', results))

            await act(async () => { await result.current.handlePrint() })
            expect(result.current.printPreview.open).toBe(true)

            act(() => { result.current.closePrintPreview() })

            expect(result.current.printPreview).toMatchObject({
                open: false,
                loading: false,
                error: null,
                html: null,
            })
        })

        it('keeps the preview open with an error when test-order HTML cannot be prepared', async () => {
            const error = new Error('network failed')
            mockFetchDetail.mockRejectedValue(error)
            mockTemplate.mockReturnValue('<html></html>')
            const openSpy = vi.spyOn(window, 'open')
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

            const { result } = renderHook(() => usePrintHandlers('sample-1', results))

            await act(async () => { await result.current.handlePrint() })

            expect(openSpy).not.toHaveBeenCalled()
            expect(errorSpy).toHaveBeenCalledWith(error)
            expect(toast.error).toHaveBeenCalledWith('Có lỗi xảy ra khi chuẩn bị Phiếu chỉ định')
            expect(result.current.printPreview).toMatchObject({
                open: true,
                loading: false,
                error: 'Có lỗi xảy ra khi chuẩn bị Phiếu chỉ định',
                html: null,
            })
        })
    })

    describe('handlePrintCoABody', () => {
        it('fetches CoA HTML and prints with body-only styles', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
                text: () => Promise.resolve('<html><head></head><body>CoA</body></html>'),
            } as Response)

            const { result } = renderHook(() => usePrintHandlers('sample-1', results))

            await act(async () => { await result.current.handlePrintCoABody() })

            expect(mockOpenPendingDetachedHtmlDocument).toHaveBeenCalledWith({
                onBlocked: expect.any(Function),
                onFailed: expect.any(Function),
            })
            expect(mockOpenPendingDetachedHtmlDocument.mock.invocationCallOrder[0]).toBeLessThan(
                vi.mocked(global.fetch).mock.invocationCallOrder[0],
            )
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/coa/view?sample_id=sample-1',
                { cache: 'no-store' },
            )
            expect(mockPendingPrintDocument.render).toHaveBeenCalledWith(
                expect.stringContaining('.header { visibility: hidden'),
                { autoPrint: true },
            )

            const onBlocked = mockOpenPendingDetachedHtmlDocument.mock.calls[0]?.[0]?.onBlocked
            const onFailed = mockOpenPendingDetachedHtmlDocument.mock.calls[0]?.[0]?.onFailed
            onBlocked()
            onFailed()
            expect(toast.error).toHaveBeenCalledWith('Trình duyệt đã chặn cửa sổ in')
            expect(toast.error).toHaveBeenCalledWith('Không thể mở tài liệu in')
        })

        it('removes electronic signatures and stamp while preserving manual-signing fields', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(`
                    <!DOCTYPE html>
                    <html>
                        <head></head>
                        <body>
                            <div class="signatures">
                                <div class="sig-col">
                                    <div class="sig-title">Người thực hiện</div>
                                    <img
                                        src="data:image/png;base64,analyst-signature-data"
                                        alt="Chữ ký người thực hiện"
                                        class="signature-image"
                                    />
                                    <div class="sig-name">KTV. Nguyễn Phân Tích</div>
                                </div>
                                <div class="sig-col">
                                    <div class="sig-date">Cần Thơ, ngày 01 tháng 08 năm 2026</div>
                                    <div class="sig-title">Lãnh đạo khoa Xét nghiệm</div>
                                    <div class="manager-signature-stack">
                                        <img
                                            src="data:image/png;base64,manager-signature-data"
                                            alt="Chữ ký"
                                            class="signature-image manager-signature-image"
                                        />
                                        <img
                                            src="data:image/svg+xml;base64,manager-stamp-data"
                                            alt="Con dấu"
                                            class="manager-stamp-image"
                                            data-coa-stamp="manager"
                                        />
                                    </div>
                                    <div class="sig-name">Nguyễn Quản Lý</div>
                                </div>
                            </div>
                        </body>
                    </html>
                `),
            } as Response)

            const { result } = renderHook(() => usePrintHandlers('sample-1', results))

            await act(async () => { await result.current.handlePrintCoABody() })

            const renderedHtml = mockPendingPrintDocument.render.mock.calls[0]?.[0] as string
            const renderedDocument = new DOMParser().parseFromString(renderedHtml, 'text/html')

            expect(renderedDocument.querySelector('.signature-image')).toBeNull()
            expect(
                renderedDocument.querySelector('.manager-stamp-image, [data-coa-stamp="manager"]'),
            ).toBeNull()
            expect(renderedHtml).not.toContain('analyst-signature-data')
            expect(renderedHtml).not.toContain('manager-signature-data')
            expect(renderedHtml).not.toContain('manager-stamp-data')
            expect(renderedDocument.body.textContent).toContain('Người thực hiện')
            expect(renderedDocument.body.textContent).toContain('KTV. Nguyễn Phân Tích')
            expect(renderedDocument.body.textContent).toContain('Lãnh đạo khoa Xét nghiệm')
            expect(renderedDocument.body.textContent).toContain('Nguyễn Quản Lý')
            expect(renderedDocument.body.textContent).toContain(
                'Cần Thơ, ngày 01 tháng 08 năm 2026',
            )
            expect(renderedDocument.querySelector('.manager-signature-stack')).not.toBeNull()
        })

        it('closes the detached print shell when loading CoA HTML fails', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: false,
            } as Response)

            const { result } = renderHook(() => usePrintHandlers('sample-1', results))

            await act(async () => { await result.current.handlePrintCoABody() })

            expect(mockPendingPrintDocument.render).not.toHaveBeenCalled()
            expect(mockPendingPrintDocument.close).toHaveBeenCalledTimes(1)
            expect(toast.error).toHaveBeenCalledWith('Không thể tải phiếu kết quả')
            errorSpy.mockRestore()
        })
    })

    describe('handlePrintBarcodeLabel', () => {
        it('delegates to the audited sample barcode label print flow', async () => {
            mockPrintSampleBarcodeLabel.mockResolvedValueOnce(undefined)

            const { result } = renderHook(() => usePrintHandlers('sample-1', results))

            await act(async () => { await result.current.handlePrintBarcodeLabel() })

            expect(mockPrintSampleBarcodeLabel).toHaveBeenCalledWith('sample-1', {
                preset: 'thermal-35x23-sheet-2up',
            })
        })
    })
})

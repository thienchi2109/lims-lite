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
    let mockPrintWindow: any

    beforeEach(() => {
        vi.clearAllMocks()
        mockPrintWindow = {
            document: { write: vi.fn(), close: vi.fn(), open: vi.fn() },
            print: vi.fn(),
            close: vi.fn(),
            onload: null as (() => void) | null,
        }
        // Simulate onload firing synchronously for tests
        Object.defineProperty(mockPrintWindow, 'onload', {
            set(fn: () => void) { fn?.() },
            get() { return null },
        })
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
            vi.spyOn(window, 'open').mockReturnValue(mockPrintWindow)
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
                text: () => Promise.resolve('<html><head></head><body>CoA</body></html>'),
            } as Response)

            const { result } = renderHook(() => usePrintHandlers('sample-1', results))

            await act(async () => { await result.current.handlePrintCoABody() })

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/coa/view?sample_id=sample-1',
                { cache: 'no-store' },
            )
            // Verify body-only styles were injected
            const writtenHtml = mockPrintWindow.document.write.mock.calls[1]?.[0] ?? ''
            expect(writtenHtml).toContain('.header { visibility: hidden')
        })

        it('toasts error when popup is blocked', async () => {
            vi.spyOn(window, 'open').mockReturnValue(null)

            const { result } = renderHook(() => usePrintHandlers('sample-1', results))

            await act(async () => { await result.current.handlePrintCoABody() })

            expect(toast.error).toHaveBeenCalledWith('Trình duyệt đã chặn cửa sổ in')
        })
    })

    describe('handlePrintBarcodeLabel', () => {
        it('delegates to the audited sample barcode label print flow', async () => {
            mockPrintSampleBarcodeLabel.mockResolvedValueOnce(undefined)

            const { result } = renderHook(() => usePrintHandlers('sample-1', results))

            await act(async () => { await result.current.handlePrintBarcodeLabel() })

            expect(mockPrintSampleBarcodeLabel).toHaveBeenCalledWith('sample-1', {
                preset: 'small-tube',
            })
        })
    })
})

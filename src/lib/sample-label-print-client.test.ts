import { beforeEach, describe, expect, it, vi } from 'vitest'
import { printSampleBarcodeLabel } from './sample-label-print-client'
import type { SampleWithUser } from '@/types'

const mockFetchSampleDetail = vi.hoisted(() => vi.fn())
const mockRecordSampleLabelPrintClient = vi.hoisted(() => vi.fn())
const mockGenerateSampleLabelHtml = vi.hoisted(() => vi.fn())
const mockPendingPrintDocument = vi.hoisted(() => ({
    render: vi.fn(),
    close: vi.fn(),
}))
const mockOpenPendingDetachedHtmlDocument = vi.hoisted(() => vi.fn())
const mockToastError = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/use-sample-detail', () => ({
    fetchSampleDetail: mockFetchSampleDetail,
}))

vi.mock('@/lib/api-client', () => ({
    recordSampleLabelPrintClient: mockRecordSampleLabelPrintClient,
}))

vi.mock('@/lib/sample-label-template', () => ({
    DEFAULT_SAMPLE_LABEL_PRESET: 'thermal-35x23-sheet-2up',
    generateSampleLabelHtml: mockGenerateSampleLabelHtml,
}))

vi.mock('@/lib/detached-html-document', () => ({
    openPendingDetachedHtmlDocument: mockOpenPendingDetachedHtmlDocument,
}))

vi.mock('sonner', () => ({
    toast: { error: mockToastError },
}))

const sample = {
    id: 'sample-uuid',
    sample_id: 'CDC-XN-21052026-0001',
    type: 'Máu',
    received_at: '2026-05-21T08:35:00.000Z',
    received_by_name: 'Tran Thi Binh',
} as SampleWithUser

describe('printSampleBarcodeLabel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFetchSampleDetail.mockResolvedValue(sample)
        mockRecordSampleLabelPrintClient.mockResolvedValue({ data: { ok: true } })
        mockGenerateSampleLabelHtml.mockReturnValue('<html><body>label</body></html>')
        mockOpenPendingDetachedHtmlDocument.mockReturnValue(mockPendingPrintDocument)
    })

    it('opens a detached shell before requests and renders only after audit succeeds', async () => {
        await printSampleBarcodeLabel('sample-uuid', { preset: 'small-tube' })

        expect(mockOpenPendingDetachedHtmlDocument).toHaveBeenCalledWith({
            onBlocked: expect.any(Function),
            onFailed: expect.any(Function),
        })
        expect(mockFetchSampleDetail).toHaveBeenCalledWith('sample-uuid')
        expect(mockRecordSampleLabelPrintClient).toHaveBeenCalledWith({
            sampleId: 'sample-uuid',
            copies: 1,
            preset: 'small-tube',
        })
        expect(mockGenerateSampleLabelHtml).toHaveBeenCalledWith(sample, { preset: 'small-tube' })
        expect(mockOpenPendingDetachedHtmlDocument.mock.invocationCallOrder[0]).toBeLessThan(
            mockFetchSampleDetail.mock.invocationCallOrder[0],
        )
        expect(mockRecordSampleLabelPrintClient.mock.invocationCallOrder[0]).toBeLessThan(
            mockPendingPrintDocument.render.mock.invocationCallOrder[0],
        )
        expect(mockPendingPrintDocument.render).toHaveBeenCalledWith(
            '<html><body>label</body></html>',
            { autoPrint: true },
        )

        const onBlocked = mockOpenPendingDetachedHtmlDocument.mock.calls[0]?.[0]?.onBlocked
        const onFailed = mockOpenPendingDetachedHtmlDocument.mock.calls[0]?.[0]?.onFailed
        onBlocked()
        onFailed()
        expect(mockToastError).toHaveBeenCalledWith('Trình duyệt đã chặn cửa sổ in')
        expect(mockToastError).toHaveBeenCalledWith('Không thể mở tài liệu in')
    })

    it('closes the detached shell when audit recording fails', async () => {
        mockRecordSampleLabelPrintClient.mockResolvedValueOnce({ error: 'Không có quyền in nhãn' })

        await printSampleBarcodeLabel('sample-uuid')

        expect(mockPendingPrintDocument.render).not.toHaveBeenCalled()
        expect(mockPendingPrintDocument.close).toHaveBeenCalledTimes(1)
        expect(mockToastError).toHaveBeenCalledWith('Không có quyền in nhãn')
    })

    it('uses the printer stock preset by default', async () => {
        await printSampleBarcodeLabel('sample-uuid')

        expect(mockRecordSampleLabelPrintClient).toHaveBeenCalledWith({
            sampleId: 'sample-uuid',
            copies: 1,
            preset: 'thermal-35x23-sheet-2up',
        })
        expect(mockGenerateSampleLabelHtml).toHaveBeenCalledWith(sample, {
            preset: 'thermal-35x23-sheet-2up',
        })
    })
})

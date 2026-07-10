import { beforeEach, describe, expect, it, vi } from 'vitest'
import { printSampleBarcodeLabel } from './sample-label-print-client'
import type { SampleWithUser } from '@/types'

const mockFetchSampleDetail = vi.hoisted(() => vi.fn())
const mockRecordSampleLabelPrintClient = vi.hoisted(() => vi.fn())
const mockGenerateSampleLabelHtml = vi.hoisted(() => vi.fn())
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
    let printWindow: {
        document: {
            open: ReturnType<typeof vi.fn>
            write: ReturnType<typeof vi.fn>
            close: ReturnType<typeof vi.fn>
        }
        print: ReturnType<typeof vi.fn>
        close: ReturnType<typeof vi.fn>
        onload: (() => void) | null
    }

    beforeEach(() => {
        vi.clearAllMocks()
        printWindow = {
            document: {
                open: vi.fn(),
                write: vi.fn(),
                close: vi.fn(),
            },
            print: vi.fn(),
            close: vi.fn(),
            onload: null,
        }
        Object.defineProperty(printWindow, 'onload', {
            set(fn: () => void) { fn?.() },
            get() { return null },
        })
        mockFetchSampleDetail.mockResolvedValue(sample)
        mockRecordSampleLabelPrintClient.mockResolvedValue({ data: { ok: true } })
        mockGenerateSampleLabelHtml.mockReturnValue('<html><body>label</body></html>')
        vi.spyOn(window, 'open').mockReturnValue(printWindow as Window)
    })

    it('records the audit event before opening the print preview', async () => {
        await printSampleBarcodeLabel('sample-uuid', { preset: 'small-tube' })

        expect(mockFetchSampleDetail).toHaveBeenCalledWith('sample-uuid')
        expect(mockRecordSampleLabelPrintClient).toHaveBeenCalledWith({
            sampleId: 'sample-uuid',
            copies: 1,
            preset: 'small-tube',
        })
        expect(mockGenerateSampleLabelHtml).toHaveBeenCalledWith(sample, { preset: 'small-tube' })
        expect(mockRecordSampleLabelPrintClient.mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(window.open).mock.invocationCallOrder[0],
        )
        expect(printWindow.print).toHaveBeenCalledTimes(1)
    })

    it('does not open print preview when audit recording fails', async () => {
        mockRecordSampleLabelPrintClient.mockResolvedValueOnce({ error: 'Không có quyền in nhãn' })

        await printSampleBarcodeLabel('sample-uuid')

        expect(window.open).not.toHaveBeenCalled()
        expect(printWindow.print).not.toHaveBeenCalled()
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

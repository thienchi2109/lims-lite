'use client'

import { fetchSampleDetail } from '@/hooks/use-sample-detail'
import { recordSampleLabelPrintClient } from '@/lib/api-client'
import {
    DEFAULT_SAMPLE_LABEL_PRESET,
    generateSampleLabelHtml,
    type SampleLabelPreset,
} from '@/lib/sample-label-template'
import { toast } from 'sonner'

interface PrintSampleBarcodeLabelOptions {
    preset?: SampleLabelPreset
}

export async function printSampleBarcodeLabel(
    sampleId: string,
    options: PrintSampleBarcodeLabelOptions = {},
) {
    const preset = options.preset ?? DEFAULT_SAMPLE_LABEL_PRESET

    try {
        const sample = await fetchSampleDetail(sampleId)
        const auditResult = await recordSampleLabelPrintClient({
            sampleId,
            copies: 1,
            preset,
        })

        if (auditResult?.error) {
            toast.error(String(auditResult.error))
            return
        }

        const printWindow = window.open('', '_blank')
        if (!printWindow) {
            toast.error('Trình duyệt đã chặn cửa sổ in')
            return
        }

        const html = generateSampleLabelHtml(sample, { preset })
        printWindow.document.open()
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.onload = () => printWindow.print()
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Có lỗi xảy ra khi in nhãn barcode'
        toast.error(message)
        console.error(error)
    }
}

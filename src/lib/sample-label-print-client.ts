'use client'

import { fetchSampleDetail } from '@/hooks/use-sample-detail'
import { recordSampleLabelPrintClient } from '@/lib/api-client'
import {
    DEFAULT_SAMPLE_LABEL_PRESET,
    generateSampleLabelHtml,
    type SampleLabelPreset,
} from '@/lib/sample-label-template'
import { openPendingDetachedHtmlDocument } from '@/lib/detached-html-document'
import { toast } from 'sonner'

interface PrintSampleBarcodeLabelOptions {
    preset?: SampleLabelPreset
}

export async function printSampleBarcodeLabel(
    sampleId: string,
    options: PrintSampleBarcodeLabelOptions = {},
) {
    const preset = options.preset ?? DEFAULT_SAMPLE_LABEL_PRESET
    const printDocument = openPendingDetachedHtmlDocument({
        onBlocked: () => toast.error('Trình duyệt đã chặn cửa sổ in'),
        onFailed: () => toast.error('Không thể mở tài liệu in'),
    })

    try {
        const sample = await fetchSampleDetail(sampleId)
        const auditResult = await recordSampleLabelPrintClient({
            sampleId,
            copies: 1,
            preset,
        })

        if (auditResult?.error) {
            printDocument.close()
            toast.error(String(auditResult.error))
            return
        }

        const html = generateSampleLabelHtml(sample, { preset })
        printDocument.render(html, { autoPrint: true })
    } catch (error) {
        printDocument.close()
        const message = error instanceof Error ? error.message : 'Có lỗi xảy ra khi in nhãn barcode'
        toast.error(message)
        console.error(error)
    }
}

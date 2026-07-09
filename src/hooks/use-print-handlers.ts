'use client'

/**
 * usePrintHandlers Hook
 *
 * Provides print handlers for the AssignedTestsPanel:
 * - handlePrint: prints the test order form (A5)
 * - handlePrintCoABody: prints CoA result table (body only, no header/footer)
 */

import { useCallback, useState } from 'react'
import { fetchSampleDetail } from '@/hooks/use-sample-detail'
import { generatePrintTemplate } from '@/lib/print-template'
import { printSampleBarcodeLabel } from '@/lib/sample-label-print-client'
import { toast } from 'sonner'
import type { ResultWithAssay } from '@/types'

export interface UsePrintHandlersReturn {
    handlePrint: () => Promise<void>
    handlePrintCoABody: () => Promise<void>
    handlePrintBarcodeLabel: () => Promise<void>
    closePrintPreview: () => void
    printPreview: {
        open: boolean
        loading: boolean
        error: string | null
        html: string | null
    }
}

export function usePrintHandlers(
    sampleId: string,
    results: ResultWithAssay[],
): UsePrintHandlersReturn {
    const [printPreview, setPrintPreview] = useState({
        open: false,
        loading: false,
        error: null as string | null,
        html: null as string | null,
    })

    const handlePrint = useCallback(async () => {
        setPrintPreview({
            open: true,
            loading: true,
            error: null,
            html: null,
        })

        try {
            const sampleData = await fetchSampleDetail(sampleId)
            const currentDate = new Date().toLocaleDateString('vi-VN')
            const htmlContent = generatePrintTemplate(sampleData, results, currentDate)
            setPrintPreview({
                open: true,
                loading: false,
                error: null,
                html: htmlContent,
            })
        } catch (err) {
            const message = 'Có lỗi xảy ra khi chuẩn bị Phiếu chỉ định'
            setPrintPreview({
                open: true,
                loading: false,
                error: message,
                html: null,
            })
            console.error(err)
            toast.error(message)
        }
    }, [sampleId, results])

    const closePrintPreview = useCallback(() => {
        setPrintPreview({
            open: false,
            loading: false,
            error: null,
            html: null,
        })
    }, [])

    const handlePrintCoABody = useCallback(async () => {
        const printWindow = window.open('', '_blank')
        if (!printWindow) {
            toast.error('Trình duyệt đã chặn cửa sổ in')
            return
        }

        printWindow.document.write(
            '<html><head><title>Đang tải...</title></head><body><p style="font-family:sans-serif;text-align:center;margin-top:40px;">Đang tải...</p></body></html>'
        )

        try {
            const response = await fetch(`/api/coa/view?sample_id=${sampleId}`, { cache: 'no-store' })
            if (!response.ok) {
                throw new Error('Không thể tải phiếu kết quả')
            }

            let html = await response.text()

            const bodyOnlyStyles = `<style>
                .header { visibility: hidden !important; border-color: transparent !important; }
                .absolute-footer { display: none !important; }
                .watermark { display: none !important; }
                .content { padding-bottom: 32px !important; }
            </style>`

            if (html.includes('</head>')) {
                html = html.replace('</head>', `${bodyOnlyStyles}</head>`)
            } else {
                html = bodyOnlyStyles + html
            }

            printWindow.document.open()
            printWindow.document.write(html)
            printWindow.document.close()
            printWindow.onload = () => printWindow.print()
        } catch (err) {
            printWindow.close()
            const message = err instanceof Error ? err.message : 'Không thể tải phiếu kết quả'
            toast.error(message)
            console.error(err)
        }
    }, [sampleId])

    const handlePrintBarcodeLabel = useCallback(async () => {
        await printSampleBarcodeLabel(sampleId, { preset: 'thermal-35x22-2up' })
    }, [sampleId])

    return {
        handlePrint,
        handlePrintCoABody,
        handlePrintBarcodeLabel,
        closePrintPreview,
        printPreview,
    }
}

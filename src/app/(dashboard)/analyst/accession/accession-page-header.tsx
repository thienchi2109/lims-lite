'use client'

import { WalkthroughTrigger } from '@/components/walkthrough'
import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AccessionImportPreview } from './accession-import-preview'

export function AccessionPageHeader() {
    const [downloading, setDownloading] = useState(false)

    async function downloadTemplate() {
        setDownloading(true)
        let objectUrl: string | undefined
        let anchor: HTMLAnchorElement | undefined
        try {
            const response = await fetch('/api/accession/template', {
                cache: 'no-store', credentials: 'same-origin',
            })
            if (!response.ok) {
                let message = 'Chưa thể tải template Excel. Vui lòng thử lại sau.'
                if (response.status === 401) message = 'Vui lòng đăng nhập để tải template Excel.'
                else if (response.status === 403) message = 'Bạn không có quyền tải template Excel hoặc cần xác thực OTP email.'
                toast.error(message)
                return
            }
            const filename = /^attachment; filename="([A-Za-z0-9._-]+\.xlsx)"$/.exec(response.headers.get('Content-Disposition') ?? '')?.[1]
            if (!filename || response.headers.get('Content-Type') !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
                throw new Error('Invalid template response')
            }
            objectUrl = URL.createObjectURL(await response.blob())
            anchor = document.createElement('a')
            anchor.href = objectUrl
            anchor.download = filename
            document.body.appendChild(anchor)
            anchor.click()
        } catch {
            toast.error('Chưa thể tải template Excel. Vui lòng thử lại sau.')
        } finally {
            anchor?.remove()
            if (objectUrl) URL.revokeObjectURL(objectUrl)
            setDownloading(false)
        }
    }

    return (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Tiếp nhận mẫu mới
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Nhập thông tin mẫu hoặc quét mã QR để tiếp nhận
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} disabled={downloading} aria-busy={downloading}>
                    {downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                    {downloading ? 'Đang tải template…' : 'Tải template Excel'}
                </Button>
                <AccessionImportPreview />
                <WalkthroughTrigger
                    tourId="accession"
                    className="hidden xl:inline-flex"
                />
            </div>
        </div>
    )
}

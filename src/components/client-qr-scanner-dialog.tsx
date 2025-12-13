'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { QRScanner } from '@/components/qr-scanner'

interface ClientQrScannerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onScan: (decodedText: string) => void | Promise<void>
}

export function ClientQrScannerDialog({ open, onOpenChange, onScan }: ClientQrScannerDialogProps) {
    const [scannerPayload, setScannerPayload] = useState('')
    const scannerInputRef = useRef<HTMLInputElement>(null)
    const lastHandledPayloadRef = useRef<string>('')

    const sanitizeScannerPayload = (value: string) =>
        value
            .replace(/\uFEFF/g, '')
            .replace(/[\u001c\u001d\u001e\u001f]/g, '|')
            .replace(/[\r\n]/g, '')
            .trim()

    useEffect(() => {
        if (!open) {
            setScannerPayload('')
            lastHandledPayloadRef.current = ''
            return
        }

        setScannerPayload('')
        lastHandledPayloadRef.current = ''

        const timer = window.setTimeout(() => {
            scannerInputRef.current?.focus()
        }, 0)

        return () => window.clearTimeout(timer)
    }, [open])

    useEffect(() => {
        if (!open) return

        const payload = sanitizeScannerPayload(scannerPayload)
        const tokenCount = payload.split('|').filter(Boolean).length
        if (!payload || tokenCount < 3) return
        if (payload === lastHandledPayloadRef.current) return

        const timer = window.setTimeout(() => {
            const finalPayload = sanitizeScannerPayload(scannerPayload)
            const finalTokenCount = finalPayload.split('|').filter(Boolean).length
            if (!finalPayload || finalTokenCount < 3) return
            if (finalPayload === lastHandledPayloadRef.current) return

            lastHandledPayloadRef.current = finalPayload
            void onScan(finalPayload)
        }, 300)

        return () => window.clearTimeout(timer)
    }, [scannerPayload, open, onScan])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-slate-950 border-slate-800 text-slate-100">
                <DialogHeader>
                    <DialogTitle>Quét mã QR CCCD</DialogTitle>
                    <DialogDescription className="text-slate-300">
                        Có thể dùng camera hoặc máy quét QR (USB/Bluetooth) để tự động điền thông tin khách hàng
                    </DialogDescription>
                </DialogHeader>
                <div className="p-4">
                    <div className="space-y-2 mb-4">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Máy quét QR (USB/Bluetooth)
                        </div>
                        <Input
                            ref={scannerInputRef}
                            value={scannerPayload}
                            onChange={(e) => setScannerPayload(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key !== 'Enter') return
                                e.preventDefault()
                                const payload = sanitizeScannerPayload(scannerPayload)
                                if (!payload) return
                                if (payload === lastHandledPayloadRef.current) return
                                lastHandledPayloadRef.current = payload
                                void onScan(payload)
                            }}
                            placeholder="Đặt con trỏ ở đây rồi quét CCCD…"
                            className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500"
                            inputMode="none"
                            autoComplete="off"
                        />
                        <div className="text-xs text-slate-500">
                            Nếu máy quét tự gửi Enter, hệ thống sẽ xử lý ngay; nếu không, sẽ tự xử lý sau khi quét xong.
                        </div>
                    </div>
                    <QRScanner onScan={onScan} onError={(err) => console.error(err)} />
                </div>
            </DialogContent>
        </Dialog>
    )
}


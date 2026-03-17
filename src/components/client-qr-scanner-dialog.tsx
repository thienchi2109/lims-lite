'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QRScanner } from '@/components/qr-scanner'

export type SerialConnectionState =
    | 'unsupported'
    | 'permission_required'
    | 'connecting'
    | 'connected'
    | 'error'

export interface ClientQrScannerDialogSerialController {
    state: SerialConnectionState
    error: string | null
    connect: () => void | Promise<void>
    disconnect: () => void | Promise<void>
}

interface ClientQrScannerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onScan: (decodedText: string) => void | Promise<void>
    serialController?: ClientQrScannerDialogSerialController
}

export function ClientQrScannerDialog({
    open,
    onOpenChange,
    onScan,
    serialController,
}: ClientQrScannerDialogProps) {
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
                        {serialController
                            ? 'Ưu tiên máy quét CCCD qua cổng COM. Nếu chưa sẵn sàng, vẫn có thể dùng camera hoặc máy quét dạng bàn phím.'
                            : 'Có thể dùng camera hoặc máy quét QR (USB/Bluetooth) để tự động điền thông tin khách hàng'}
                    </DialogDescription>
                </DialogHeader>
                <div className="p-4">
                    {serialController ? (
                        <div className="space-y-2 mb-4 rounded-lg border border-sky-900/70 bg-sky-950/40 p-3">
                            <div className="text-xs font-semibold uppercase tracking-wider text-sky-300">
                                Máy quét CCCD qua cổng COM
                            </div>

                            {serialController.state === 'connected' ? (
                                <>
                                    <div className="text-sm text-emerald-300">Đã kết nối scanner CCCD</div>
                                    <div className="text-xs text-sky-100/80">
                                        Có thể quét nhiều CCCD liên tiếp trong session này mà không cần chọn lại cổng COM.
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                                        onClick={() => {
                                            void serialController.disconnect()
                                        }}
                                    >
                                        Ngắt kết nối scanner
                                    </Button>
                                </>
                            ) : null}

                            {serialController.state === 'connecting' ? (
                                <>
                                    <div className="text-sm text-sky-100">Đang kết nối scanner CCCD...</div>
                                    <div className="text-xs text-sky-100/80">
                                        Nếu trình duyệt hiển thị hộp chọn thiết bị, hãy chọn đúng cổng COM của scanner.
                                    </div>
                                    <Button
                                        type="button"
                                        disabled
                                        className="bg-sky-600 text-white hover:bg-sky-600"
                                    >
                                        Đang kết nối scanner...
                                    </Button>
                                </>
                            ) : null}

                            {serialController.state === 'unsupported' ? (
                                <div className="text-xs text-amber-200">
                                    Trình duyệt này không hỗ trợ Web Serial. Dùng Chrome hoặc Edge trên máy tính để quét CCCD qua cổng COM.
                                </div>
                            ) : null}

                            {serialController.state === 'permission_required' || serialController.state === 'error' ? (
                                <>
                                    <div className="text-xs text-sky-100/80">
                                        {serialController.state === 'error' && serialController.error
                                            ? serialController.error
                                            : 'Lần đầu trên trình duyệt này, bấm kết nối rồi chọn đúng cổng COM của scanner CCCD.'}
                                    </div>
                                    <Button
                                        type="button"
                                        className="bg-sky-600 text-white hover:bg-sky-500"
                                        onClick={() => {
                                            void serialController.connect()
                                        }}
                                    >
                                        Kết nối scanner CCCD
                                    </Button>
                                </>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="space-y-2 mb-4">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            {serialController
                                ? 'Máy quét QR dạng bàn phím (dự phòng)'
                                : 'Máy quét QR (USB/Bluetooth)'}
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
                            {serialController
                                ? 'Dùng khi scanner đang ở chế độ keyboard. Nếu máy quét tự gửi Enter, hệ thống sẽ xử lý ngay; nếu không, sẽ tự xử lý sau khi quét xong.'
                                : 'Nếu máy quét tự gửi Enter, hệ thống sẽ xử lý ngay; nếu không, sẽ tự xử lý sau khi quét xong.'}
                        </div>
                    </div>
                    <QRScanner onScan={onScan} onError={(err) => console.error(err)} />
                </div>
            </DialogContent>
        </Dialog>
    )
}


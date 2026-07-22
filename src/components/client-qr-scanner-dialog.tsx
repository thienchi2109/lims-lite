'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QRScanner } from '@/components/qr-scanner'
import {
    useScanner,
    useScannerConsumer,
    type ScannerConnection,
} from '@/components/scanner/use-scanner'
import type { ParsedClientIdentityQr } from '@/lib/qr/parse-client-identity-qr'
import { Unplug, Plug, Keyboard, Camera } from 'lucide-react'

const CLIENT_IDENTITY_SCANNER_KINDS = ['identity-qr', 'unknown'] as const

interface ClientQrScannerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onScan: (decodedText: string) => void | Promise<void>
    onIdentityScan: (identity: ParsedClientIdentityQr) => void | Promise<void>
    onInvalidScan: () => void
}

type ClientQrScannerDialogBodyProps = {
    onScan: (decodedText: string) => void | Promise<void>
    serialConnection: ScannerConnection
}

/**
 * Inline keyboard-mode scanner input.
 * Fires onScan when payload has ≥ 3 pipe-delimited tokens (auto or Enter).
 */
function KeyboardScannerInput({ onScan }: { onScan: (text: string) => void | Promise<void> }) {
    const [payload, setPayload] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const lastHandledRef = useRef('')

    const sanitize = (v: string) =>
        v.replace(/\uFEFF/g, '')
            .replace(/[\u001c\u001d\u001e\u001f]/g, '|')
            .replace(/[\r\n]/g, '')
            .trim()

    useEffect(() => {
        const t = window.setTimeout(() => inputRef.current?.focus(), 0)
        return () => window.clearTimeout(t)
    }, [])

    useEffect(() => {
        const clean = sanitize(payload)
        if (!clean || clean.split('|').filter(Boolean).length < 3) return
        if (clean === lastHandledRef.current) return

        const t = window.setTimeout(() => {
            const final = sanitize(payload)
            if (!final || final.split('|').filter(Boolean).length < 3) return
            if (final === lastHandledRef.current) return
            lastHandledRef.current = final
            void onScan(final)
        }, 300)
        return () => window.clearTimeout(t)
    }, [payload, onScan])

    return (
        <Input
            ref={inputRef}
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                const clean = sanitize(payload)
                if (!clean || clean === lastHandledRef.current) return
                lastHandledRef.current = clean
                void onScan(clean)
            }}
            placeholder="Đặt con trỏ ở đây rồi quét CCCD…"
            className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm"
            inputMode="none"
            autoComplete="off"
        />
    )
}

function ClientQrScannerDialogBody({
    onScan,
    serialConnection,
}: ClientQrScannerDialogBodyProps) {
    const isSerialConnected = serialConnection.state === 'connected'
    const isSerialConnecting = serialConnection.state === 'connecting'
    const showSerialConnect =
        serialConnection.state === 'permission_required' || serialConnection.state === 'error'
    const isSerialUnsupported = serialConnection.state === 'unsupported'

    // When COM scanner is connected → no need for camera
    const showCamera = !isSerialConnected

    return (
        <div className="space-y-4 pt-2">
            {/* ── COM Scanner Section ── */}
            {!isSerialUnsupported ? (
                <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3.5 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <Plug className="h-3.5 w-3.5" />
                        Scanner CCCD (COM)
                    </div>

                    {isSerialConnected ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                </span>
                                <span className="text-sm text-emerald-300">Đã kết nối</span>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-slate-400 hover:text-slate-200"
                                onClick={() => void serialConnection.disconnect()}
                            >
                                <Unplug className="h-3 w-3 mr-1" />
                                Ngắt
                            </Button>
                        </div>
                    ) : null}

                    {isSerialConnecting ? (
                        <div className="text-sm text-sky-300 animate-pulse">
                            Đang kết nối…
                        </div>
                    ) : null}

                    {showSerialConnect ? (
                        <>
                            {serialConnection.state === 'error' && serialConnection.error ? (
                                <div className="text-xs text-amber-300/80">{serialConnection.error}</div>
                            ) : null}
                            <Button
                                type="button"
                                size="sm"
                                className="w-full bg-sky-600 text-white hover:bg-sky-500"
                                onClick={() => void serialConnection.connect()}
                            >
                                <Plug className="h-3.5 w-3.5 mr-1.5" />
                                Kết nối scanner CCCD
                            </Button>
                        </>
                    ) : null}
                </div>
            ) : null}

            {/* ── Keyboard Scanner Input ── */}
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <Keyboard className="h-3.5 w-3.5" />
                    {!isSerialUnsupported
                        ? 'Quét bằng bàn phím (dự phòng)'
                        : 'Máy quét QR (USB / Bluetooth)'}
                </div>
                <KeyboardScannerInput onScan={onScan} />
            </div>

            {/* ── Camera Scanner — hidden when COM is connected ── */}
            {showCamera ? (
                <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <Camera className="h-3.5 w-3.5" />
                        Camera
                    </div>
                    <QRScanner onScan={onScan} />
                </div>
            ) : null}
        </div>
    )
}

export function ClientQrScannerDialog({
    open,
    onOpenChange,
    onScan,
    onIdentityScan,
    onInvalidScan,
}: ClientQrScannerDialogProps) {
    const scanner = useScanner()

    useScannerConsumer({
        enabled: open,
        kinds: CLIENT_IDENTITY_SCANNER_KINDS,
        priority: 300,
        onEvent: (event) => {
            if (event.kind === 'identity-qr') {
                return onIdentityScan(event.identity)
            }

            if (event.kind === 'unknown') {
                onInvalidScan()
            }
        },
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto p-4 sm:max-w-md sm:p-6 bg-slate-950 border-slate-800 text-slate-100">
                <DialogHeader>
                    <DialogTitle>Quét mã QR CCCD</DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Ưu tiên dùng scanner qua cổng COM, hoặc quét bằng bàn phím / camera.
                    </DialogDescription>
                </DialogHeader>
                {open ? (
                    <ClientQrScannerDialogBody
                        onScan={onScan}
                        serialConnection={scanner}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    )
}

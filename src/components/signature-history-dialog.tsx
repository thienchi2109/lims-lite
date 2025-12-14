'use client'

import { useEffect, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, History as HistoryIcon } from 'lucide-react'
import { getSignatureHistoryClient } from '@/lib/api-client'
import type { SignatureHistoryItem } from '@/types'

/**
 * Signature History Dialog Component
 *
 * Features:
 * - Display all signature uploads (active and inactive)
 * - Show upload date, file size, MIME type
 * - Indicate which signature is currently active
 * - Provide audit trail for compliance
 *
 * Phase 3.5.7: Signature History Viewer
 */
interface SignatureHistoryDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function SignatureHistoryDialog({
    open,
    onOpenChange,
}: SignatureHistoryDialogProps) {
    const [history, setHistory] = useState<SignatureHistoryItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (open) {
            loadHistory()
        }
    }, [open])

    async function loadHistory() {
        try {
            setLoading(true)
            setError(null)

            const result = await getSignatureHistoryClient()

            if (!result.success) {
                setError(result.error)
                return
            }

            setHistory(result.history)
        } catch (err) {
            console.error('Failed to load signature history:', err)
            setError('Không thể tải lịch sử chữ ký')
        } finally {
            setLoading(false)
        }
    }

    function formatFileSize(bytes: number): string {
        return (bytes / 1024).toFixed(1) + 'KB'
    }

    function formatDate(dateString: string): string {
        return new Date(dateString).toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    function getMimeTypeLabel(mimeType: string): string {
        return mimeType === 'image/png' ? 'PNG' : 'JPEG'
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Lịch sử chữ ký điện tử</DialogTitle>
                    <DialogDescription>
                        Danh sách tất cả chữ ký đã tải lên (cho mục đích kiểm toán)
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Error alert */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Loading state */}
                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                            <span className="ml-2 text-sm text-slate-600">Đang tải...</span>
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && !error && history.length === 0 && (
                        <div className="text-center py-12">
                            <HistoryIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-sm text-slate-600">
                                Chưa có lịch sử chữ ký
                            </p>
                        </div>
                    )}

                    {/* History list */}
                    {!loading && !error && history.length > 0 && (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {history.map((item) => (
                                <div
                                    key={item.id}
                                    className={`border rounded-lg p-4 ${
                                        item.is_active
                                            ? 'border-blue-200 bg-blue-50'
                                            : 'border-slate-200 bg-white'
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                {item.is_active && (
                                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Đang sử dụng
                                                    </div>
                                                )}
                                                <span className="text-xs text-slate-500 font-mono">
                                                    ID: {item.id.substring(0, 8)}...
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                                <div>
                                                    <span className="text-slate-500">Tải lên:</span>
                                                    <span className="ml-2 text-slate-900">
                                                        {formatDate(item.uploaded_at)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500">Định dạng:</span>
                                                    <span className="ml-2 text-slate-900">
                                                        {getMimeTypeLabel(item.mime_type)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500">Kích thước:</span>
                                                    <span className="ml-2 text-slate-900">
                                                        {formatFileSize(item.file_size)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Info note */}
                    {!loading && !error && history.length > 0 && (
                        <Alert>
                            <AlertDescription className="text-xs">
                                Lịch sử này được lưu giữ để đáp ứng yêu cầu 21 CFR Part 11.
                                Các chữ ký cũ không thể xóa khỏi hệ thống.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

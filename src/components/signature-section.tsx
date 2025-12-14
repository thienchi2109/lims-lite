'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileSignature, Upload, History, Loader2 } from 'lucide-react'
import { SignatureUploadDialog } from '@/components/signature-upload-dialog'
import { SignatureHistoryDialog } from '@/components/signature-history-dialog'
import { getActiveSignatureClient, downloadSignatureClient } from '@/lib/api-client'
import type { ActiveSignature } from '@/types'

/**
 * Manager E-Signature Section Component
 *
 * Features:
 * - Display current active signature with preview
 * - Upload new signature (replaces old one)
 * - View signature history for audit trail
 * - Handle "no signature" state with upload CTA
 *
 * Phase 3.5.6: Manager Settings Page
 */
export function SignatureSection() {
    const [activeSignature, setActiveSignature] = useState<ActiveSignature | null>(null)
    const [signatureDataUri, setSignatureDataUri] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
    const [historyDialogOpen, setHistoryDialogOpen] = useState(false)

    // Load active signature on mount
    useEffect(() => {
        loadActiveSignature()
    }, [])

    async function loadActiveSignature() {
        try {
            setLoading(true)
            setError(null)

            // Get active signature metadata
            const result = await getActiveSignatureClient()

            if (!result.success) {
                // No active signature - this is not an error, just empty state
                if (result.error.includes('Chưa có chữ ký')) {
                    setActiveSignature(null)
                    setSignatureDataUri(null)
                } else {
                    setError(result.error)
                }
                return
            }

            setActiveSignature(result.signature)

            // Download signature as base64 data URI for preview
            const downloadResult = await downloadSignatureClient(result.signature.signature_path)

            if (!downloadResult.success) {
                setError(downloadResult.error)
                return
            }

            setSignatureDataUri(downloadResult.dataUri)
        } catch (err) {
            console.error('Failed to load active signature:', err)
            setError('Không thể tải thông tin chữ ký')
        } finally {
            setLoading(false)
        }
    }

    function handleUploadSuccess() {
        setUploadDialogOpen(false)
        loadActiveSignature() // Reload signature after upload
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                <span className="ml-2 text-sm text-slate-600">Đang tải...</span>
            </div>
        )
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )
    }

    // No signature uploaded yet
    if (!activeSignature || !signatureDataUri) {
        return (
            <>
                <div className="text-center py-12">
                    <FileSignature className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        Chưa có chữ ký điện tử
                    </h3>
                    <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
                        Tải lên chữ ký điện tử để sử dụng cho việc phê duyệt Giấy chứng nhận phân tích (CoA).
                        Chữ ký phải là file PNG hoặc JPEG, dung lượng tối đa 500KB.
                    </p>
                    <Button onClick={() => setUploadDialogOpen(true)}>
                        <Upload className="h-4 w-4 mr-2" />
                        Tải lên chữ ký
                    </Button>
                </div>

                <SignatureUploadDialog
                    open={uploadDialogOpen}
                    onOpenChange={setUploadDialogOpen}
                    onSuccess={handleUploadSuccess}
                />
            </>
        )
    }

    // Has active signature
    return (
        <>
            <div className="space-y-6">
                {/* Active signature preview */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-900">
                            Chữ ký hiện tại
                        </h3>
                        <span className="text-xs text-slate-500">
                            Tải lên: {new Date(activeSignature.uploaded_at).toLocaleDateString('vi-VN')}
                        </span>
                    </div>

                    <div className="border rounded-lg p-6 bg-slate-50">
                        <div className="flex items-center justify-center">
                            <img
                                src={signatureDataUri}
                                alt="Chữ ký điện tử"
                                className="max-h-32 object-contain"
                                style={{ maxWidth: '100%' }}
                            />
                        </div>
                    </div>

                    <p className="text-xs text-slate-500 mt-2">
                        Hash: {activeSignature.signature_hash.substring(0, 16)}...
                    </p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={() => setUploadDialogOpen(true)}
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        Thay đổi chữ ký
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setHistoryDialogOpen(true)}
                    >
                        <History className="h-4 w-4 mr-2" />
                        Lịch sử chữ ký
                    </Button>
                </div>

                <Alert>
                    <AlertDescription className="text-sm">
                        Khi bạn tải lên chữ ký mới, chữ ký cũ sẽ được lưu vào lịch sử.
                        Các Giấy chứng nhận phân tích (CoA) đã được tạo sẽ giữ nguyên chữ ký cũ.
                    </AlertDescription>
                </Alert>
            </div>

            <SignatureUploadDialog
                open={uploadDialogOpen}
                onOpenChange={setUploadDialogOpen}
                onSuccess={handleUploadSuccess}
            />

            <SignatureHistoryDialog
                open={historyDialogOpen}
                onOpenChange={setHistoryDialogOpen}
            />
        </>
    )
}

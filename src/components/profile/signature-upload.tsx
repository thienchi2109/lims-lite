'use client'

/**
 * SignatureUpload Component
 *
 * Allows analysts and managers to upload electronic signatures for sample submissions and CoA generation.
 * Features:
 * - Drag-and-drop file upload with react-dropzone
 * - Client-side validation (format, size)
 * - Real-time upload status
 * - Signature preview and status indicator
 *
 * Usage:
 * <SignatureUpload />
 */

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { useSignatureStatus } from '@/hooks/use-signature-status'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, Check, Loader2, AlertCircle } from 'lucide-react'
import { SIGNATURE_VALIDATION } from '@/types/workflow'
import { SIGNATURE_PROFILE_REQUIRED_MESSAGE } from '@/lib/signature-readiness'

/**
 * Get the upload prompt text based on current state
 * Extracted from nested ternary for readability
 */
function getUploadPromptText(
    isUploading: boolean,
    isDragActive: boolean,
    hasSignature: boolean
): string {
    if (isUploading) return 'Đang tải lên...'
    if (isDragActive) return 'Thả file vào đây'
    if (hasSignature) return 'Nhấn để thay đổi chữ ký'
    return 'Kéo thả file hoặc nhấn để chọn'
}

export default function SignatureUpload() {
    const [isUploading, setIsUploading] = useState(false)
    const { hasSignature, signature, isLoading, refetch } = useSignatureStatus()

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0]
        if (!file) return

        // Client-side validation: empty file check
        if (file.size === 0) {
            toast.error('File rỗng không được chấp nhận')
            return
        }

        // Client-side validation: max size
        if (file.size > SIGNATURE_VALIDATION.maxFileSize) {
            toast.error(`Kích thước file tối đa ${SIGNATURE_VALIDATION.maxFileSize / 1024}KB`)
            return
        }

        // Client-side validation: MIME type (type-safe check)
        const allowedTypes: readonly string[] = SIGNATURE_VALIDATION.allowedMimeTypes
        if (!allowedTypes.includes(file.type)) {
            toast.error('Chỉ chấp nhận file PNG hoặc JPEG')
            return
        }

        setIsUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            // Call upload API
            const response = await fetch('/api/signatures/upload', {
                method: 'POST',
                body: formData
            })

            const result = await response.json()

            if (result.success) {
                toast.success('Đã tải lên chữ ký thành công')
                // Refetch signature status to update UI
                refetch()
            } else {
                toast.error(result.error || 'Tải lên thất bại')
            }
        } catch (error) {
            toast.error('Đã xảy ra lỗi khi tải lên')
            console.error('Signature upload error:', error)
        } finally {
            setIsUploading(false)
        }
    }, [refetch])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/png': ['.png'],
            'image/jpeg': ['.jpg', '.jpeg']
        },
        maxFiles: 1,
        maxSize: SIGNATURE_VALIDATION.maxFileSize,
        disabled: isUploading,
    })

    // Format uploaded date in Vietnamese
    const uploadedDate = signature?.uploaded_at
        ? new Date(signature.uploaded_at).toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : null

    return (
        <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    Chữ ký điện tử
                    {hasSignature && (
                        <span className="flex items-center gap-1 text-sm font-normal text-green-600 dark:text-green-400">
                            <Check className="h-4 w-4" />
                            Đã cập nhật
                        </span>
                    )}
                </CardTitle>
                <CardDescription className="text-sm">
                    Chữ ký của bạn sẽ được sử dụng khi nộp kết quả xét nghiệm và hiển thị trên phiếu kết quả.
                    Định dạng: PNG hoặc JPEG, tối đa {SIGNATURE_VALIDATION.maxFileSize / 1024}KB.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Upload Dropzone */}
                <div
                    {...getRootProps()}
                    className={`
                        relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                        transition-all duration-200
                        ${isDragActive
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 scale-[1.02]'
                            : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600'
                        }
                        ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
                        ${hasSignature ? 'bg-slate-50 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-900'}
                    `}
                    aria-label="Khu vực tải lên chữ ký"
                >
                    <input {...getInputProps()} aria-label="Chọn file chữ ký" />

                    {/* Upload Icon/Status */}
                    <div className="mb-3">
                        {isUploading ? (
                            <Loader2 className="h-10 w-10 mx-auto text-blue-500 animate-spin" />
                        ) : hasSignature ? (
                            <div className="h-10 w-10 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                        ) : (
                            <Upload className="h-10 w-10 mx-auto text-slate-400 dark:text-slate-500" />
                        )}
                    </div>

                    {/* Upload Text */}
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {getUploadPromptText(isUploading, isDragActive, hasSignature)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            PNG hoặc JPEG, tối đa {SIGNATURE_VALIDATION.maxFileSize / 1024}KB
                        </p>
                    </div>
                </div>

                {/* Current Signature Status */}
                {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Đang kiểm tra trạng thái...
                    </div>
                ) : hasSignature && uploadedDate ? (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30">
                        <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-green-900 dark:text-green-100">
                                Chữ ký đã được cập nhật
                            </p>
                            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                                Tải lên lúc: {uploadedDate}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
                        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                                Chưa có chữ ký
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                {SIGNATURE_PROFILE_REQUIRED_MESSAGE}
                            </p>
                        </div>
                    </div>
                )}

                {/* Helper Text */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        <strong className="text-slate-600 dark:text-slate-300">Lưu ý:</strong>{' '}
                        Chữ ký của bạn sẽ được lưu trữ an toàn và chỉ được sử dụng cho mục đích xác thực kết quả xét nghiệm.
                        Mỗi lần tải lên mới sẽ thay thế chữ ký hiện tại.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}

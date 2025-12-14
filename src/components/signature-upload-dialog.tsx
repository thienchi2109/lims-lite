'use client'

import { useState, useRef, ChangeEvent } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, X, Loader2, CheckCircle2, FileSignature } from 'lucide-react'
import { uploadSignatureClient } from '@/lib/api-client'
import { SIGNATURE_VALIDATION } from '@/types'

/**
 * Signature Upload Dialog Component
 *
 * Features:
 * - File upload with drag & drop
 * - Client-side validation (format, size, dimensions)
 * - Image preview before upload
 * - Upload progress feedback
 * - Success/error states
 *
 * Phase 3.5.6: Manager Settings Page
 */
interface SignatureUploadDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function SignatureUploadDialog({
    open,
    onOpenChange,
    onSuccess,
}: SignatureUploadDialogProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadSuccess, setUploadSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    function resetState() {
        setSelectedFile(null)
        setPreviewUrl(null)
        setUploading(false)
        setUploadSuccess(false)
        setError(null)
    }

    function handleClose() {
        if (!uploading) {
            resetState()
            onOpenChange(false)
        }
    }

    async function validateFile(file: File): Promise<{ valid: true } | { valid: false; error: string }> {
        // Validate file size
        if (file.size > SIGNATURE_VALIDATION.maxFileSize) {
            return {
                valid: false,
                error: `Kích thước file tối đa ${SIGNATURE_VALIDATION.maxFileSize / 1024}KB`
            }
        }

        if (file.size === 0) {
            return { valid: false, error: 'File rỗng' }
        }

        // Validate MIME type
        if (!SIGNATURE_VALIDATION.allowedMimeTypes.includes(file.type as any)) {
            return { valid: false, error: 'Chỉ chấp nhận file PNG hoặc JPEG' }
        }

        // Validate image dimensions
        const dimensions = await getImageDimensions(file)

        if (dimensions.width < SIGNATURE_VALIDATION.minWidth) {
            return {
                valid: false,
                error: `Chiều rộng tối thiểu ${SIGNATURE_VALIDATION.minWidth}px (file của bạn: ${dimensions.width}px)`
            }
        }

        if (dimensions.width > SIGNATURE_VALIDATION.maxWidth) {
            return {
                valid: false,
                error: `Chiều rộng tối đa ${SIGNATURE_VALIDATION.maxWidth}px (file của bạn: ${dimensions.width}px)`
            }
        }

        if (dimensions.height < SIGNATURE_VALIDATION.minHeight) {
            return {
                valid: false,
                error: `Chiều cao tối thiểu ${SIGNATURE_VALIDATION.minHeight}px (file của bạn: ${dimensions.height}px)`
            }
        }

        if (dimensions.height > SIGNATURE_VALIDATION.maxHeight) {
            return {
                valid: false,
                error: `Chiều cao tối đa ${SIGNATURE_VALIDATION.maxHeight}px (file của bạn: ${dimensions.height}px)`
            }
        }

        return { valid: true }
    }

    function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
        return new Promise((resolve, reject) => {
            const img = new Image()
            const url = URL.createObjectURL(file)

            img.onload = () => {
                URL.revokeObjectURL(url)
                resolve({ width: img.width, height: img.height })
            }

            img.onerror = () => {
                URL.revokeObjectURL(url)
                reject(new Error('Không thể đọc file ảnh'))
            }

            img.src = url
        })
    }

    async function handleFileSelect(file: File) {
        setError(null)

        // Validate file
        const validation = await validateFile(file)
        if (!validation.valid) {
            setError(validation.error)
            return
        }

        // Create preview URL
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
        setSelectedFile(file)
    }

    async function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (file) {
            await handleFileSelect(file)
        }
    }

    function handleRemoveFile() {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl)
        }
        setSelectedFile(null)
        setPreviewUrl(null)
        setError(null)

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    async function handleUpload() {
        if (!selectedFile) return

        try {
            setUploading(true)
            setError(null)

            const formData = new FormData()
            formData.append('file', selectedFile)

            const result = await uploadSignatureClient(formData)

            if (!result.success) {
                setError(result.error)
                return
            }

            setUploadSuccess(true)

            // Wait a moment to show success state, then close
            setTimeout(() => {
                onSuccess()
                resetState()
            }, 1500)
        } catch (err) {
            console.error('Upload failed:', err)
            setError(err instanceof Error ? err.message : 'Tải lên thất bại')
        } finally {
            setUploading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Tải lên chữ ký điện tử</DialogTitle>
                    <DialogDescription>
                        Chọn file ảnh chữ ký (PNG hoặc JPEG). Kích thước: {SIGNATURE_VALIDATION.minWidth}x{SIGNATURE_VALIDATION.minHeight}px đến {SIGNATURE_VALIDATION.maxWidth}x{SIGNATURE_VALIDATION.maxHeight}px, tối đa {SIGNATURE_VALIDATION.maxFileSize / 1024}KB.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Error alert */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Success state */}
                    {uploadSuccess && (
                        <Alert className="bg-green-50 border-green-200">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-800">
                                Tải lên chữ ký thành công!
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* File preview or upload area */}
                    {!selectedFile && !uploadSuccess && (
                        <div
                            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-slate-400 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <FileSignature className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                            <p className="text-sm font-medium text-slate-700 mb-1">
                                Nhấn để chọn file
                            </p>
                            <p className="text-xs text-slate-500">
                                PNG hoặc JPEG, tối đa {SIGNATURE_VALIDATION.maxFileSize / 1024}KB
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg"
                                onChange={handleFileInputChange}
                                className="hidden"
                            />
                        </div>
                    )}

                    {selectedFile && previewUrl && !uploadSuccess && (
                        <div className="space-y-3">
                            <div className="border rounded-lg p-4 bg-slate-50 relative">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="absolute top-2 right-2"
                                    onClick={handleRemoveFile}
                                    disabled={uploading}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                                <div className="flex items-center justify-center">
                                    <img
                                        src={previewUrl}
                                        alt="Preview"
                                        className="max-h-32 object-contain"
                                        style={{ maxWidth: '100%' }}
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-slate-600 text-center">
                                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)}KB)
                            </p>
                        </div>
                    )}

                    {/* Action buttons */}
                    {!uploadSuccess && (
                        <div className="flex gap-3 justify-end pt-4">
                            <Button
                                variant="outline"
                                onClick={handleClose}
                                disabled={uploading}
                            >
                                Hủy
                            </Button>
                            <Button
                                onClick={handleUpload}
                                disabled={!selectedFile || uploading}
                            >
                                {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {uploading ? 'Đang tải lên...' : 'Tải lên'}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

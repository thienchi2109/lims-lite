'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FileSignature, X, CheckCircle2, Upload } from 'lucide-react'
import { SIGNATURE_VALIDATION } from '@/types'

/**
 * Signature Upload Field Component
 *
 * Reusable component for signature file upload with validation.
 * Used in:
 * - Manager account creation (optional)
 * - Manager settings page (via SignatureUploadDialog)
 *
 * Features:
 * - File selection with preview
 * - Client-side validation (format, size, dimensions)
 * - Optional/required modes
 * - Visual feedback
 *
 * Phase 3.5.5: Manager Account Creation
 */
interface SignatureUploadFieldProps {
    value: File | null
    onChange: (file: File | null) => void
    error?: string
    required?: boolean
}

export function SignatureUploadField({
    value,
    onChange,
    error,
    required = false
}: SignatureUploadFieldProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [validationError, setValidationError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

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
        if (!SIGNATURE_VALIDATION.allowedMimeTypes.some((mimeType) => mimeType === file.type)) {
            return { valid: false, error: 'Chỉ chấp nhận file PNG hoặc JPEG' }
        }

        // Validate image dimensions
        try {
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
        } catch (err) {
            return { valid: false, error: 'Không thể đọc kích thước ảnh' }
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
        setValidationError(null)

        // Validate file
        const validation = await validateFile(file)
        if (!validation.valid) {
            setValidationError(validation.error)
            onChange(null)
            return
        }

        // Create preview URL
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
        onChange(file)
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
        setPreviewUrl(null)
        setValidationError(null)
        onChange(null)

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-900">
                    Chữ ký điện tử {required && <span className="text-red-500">*</span>}
                    {!required && <span className="text-slate-500 font-normal">(Tùy chọn)</span>}
                </label>
            </div>

            {/* Error alerts */}
            {(error || validationError) && (
                <Alert variant="destructive">
                    <AlertDescription>{error || validationError}</AlertDescription>
                </Alert>
            )}

            {/* File preview or upload area */}
            {!value && !previewUrl ? (
                <div
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-slate-400 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <FileSignature className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-700 mb-1">
                        Nhấn để chọn file
                    </p>
                    <p className="text-xs text-slate-500">
                        PNG hoặc JPEG, {SIGNATURE_VALIDATION.minWidth}x{SIGNATURE_VALIDATION.minHeight}px đến {SIGNATURE_VALIDATION.maxWidth}x{SIGNATURE_VALIDATION.maxHeight}px, tối đa {SIGNATURE_VALIDATION.maxFileSize / 1024}KB
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleFileInputChange}
                        className="hidden"
                    />
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="border rounded-lg p-4 bg-slate-50 relative">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={handleRemoveFile}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center justify-center">
                            <img
                                src={previewUrl || ''}
                                alt="Preview"
                                className="max-h-24 object-contain"
                                style={{ maxWidth: '100%' }}
                            />
                        </div>
                    </div>
                    {value && (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>{value.name} ({(value.size / 1024).toFixed(1)}KB)</span>
                        </div>
                    )}
                </div>
            )}

            {!required && !value && (
                <p className="text-xs text-slate-500">
                    Bạn có thể tải lên chữ ký sau trong phần Cài đặt
                </p>
            )}
        </div>
    )
}

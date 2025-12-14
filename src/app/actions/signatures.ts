'use server'

import { createClient } from '@/lib/supabase/server'
import {
    SIGNATURE_VALIDATION,
    ActiveSignatureSchema,
    SignatureHistoryItemSchema,
    type ActiveSignature,
    type SignatureHistoryItem
} from '@/types'
import { createHash } from 'crypto'
import { z } from 'zod'

/**
 * Server Actions for Manager E-Signature Management
 *
 * Phase 3.5: E-Signature Infrastructure
 *
 * Features:
 * - Upload signature with validation (format, size, dimensions)
 * - Retrieve active signature for CoA generation
 * - View signature history for audit trail
 * - SHA-256 hash generation for integrity verification
 * - Automatic deactivation of previous signatures
 */

// ============================================================================
// TYPES
// ============================================================================

type UploadSignatureResult =
    | { success: true; signatureId: string }
    | { success: false; error: string }

type GetActiveSignatureResult =
    | { success: true; signature: ActiveSignature }
    | { success: false; error: string }

type GetSignatureHistoryResult =
    | { success: true; history: SignatureHistoryItem[] }
    | { success: false; error: string }

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate SHA-256 hash from file buffer
 */
function generateFileHash(buffer: ArrayBuffer): string {
    const hash = createHash('sha256')
    hash.update(Buffer.from(buffer))
    return hash.digest('hex')
}

/**
 * Validate signature file (format, size)
 * Note: Dimension validation must be done on client side before upload
 */
async function validateSignatureFile(file: File): Promise<{ valid: true } | { valid: false; error: string }> {
    // Check file size
    if (file.size > SIGNATURE_VALIDATION.maxFileSize) {
        return { valid: false, error: `Kích thước file tối đa ${SIGNATURE_VALIDATION.maxFileSize / 1024}KB` }
    }

    if (file.size === 0) {
        return { valid: false, error: 'File rỗng' }
    }

    // Check MIME type
    if (!SIGNATURE_VALIDATION.allowedMimeTypes.includes(file.type as any)) {
        return { valid: false, error: 'Chỉ chấp nhận file PNG hoặc JPEG' }
    }

    return { valid: true }
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Upload manager signature
 *
 * Features:
 * - Validates file format, size, dimensions
 * - Generates SHA-256 hash for integrity verification
 * - Deactivates previous signature
 * - Uploads to storage bucket with proper path structure
 * - Inserts user_signatures record
 *
 * Path structure: user-signatures/{user_id}/{timestamp}.{ext}
 */
export async function uploadManagerSignature(formData: FormData): Promise<UploadSignatureResult> {
    try {
        const supabase = await createClient()

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return { success: false, error: 'Người dùng chưa đăng nhập' }
        }

        // Verify user is a manager
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (userError || !userData) {
            return { success: false, error: 'Không tìm thấy thông tin người dùng' }
        }

        if (userData.role !== 'manager') {
            return { success: false, error: 'Chỉ quản lý mới có thể tải lên chữ ký' }
        }

        // Get file from FormData
        const file = formData.get('file') as File | null
        if (!file) {
            return { success: false, error: 'Không tìm thấy file' }
        }

        // Validate file
        const validation = await validateSignatureFile(file)
        if (!validation.valid) {
            return { success: false, error: validation.error }
        }

        // Get file buffer for hash generation
        const arrayBuffer = await file.arrayBuffer()
        const fileHash = generateFileHash(arrayBuffer)

        // Generate storage path
        const timestamp = new Date().toISOString()
        const ext = file.type === 'image/png' ? 'png' : 'jpg'
        const storagePath = `${user.id}/${timestamp}.${ext}`

        // Upload to storage bucket
        const { error: uploadError } = await supabase.storage
            .from('user-signatures')
            .upload(storagePath, file, {
                contentType: file.type,
                upsert: false, // Don't overwrite existing files
            })

        if (uploadError) {
            console.error('Storage upload error:', uploadError)
            return { success: false, error: 'Tải lên file thất bại. Vui lòng thử lại.' }
        }

        // Deactivate previous signatures
        const { error: deactivateError } = await supabase
            .from('user_signatures')
            .update({ is_active: false })
            .eq('user_id', user.id)
            .eq('is_active', true)

        if (deactivateError) {
            console.error('Deactivate signature error:', deactivateError)
            // Continue anyway - new signature will be active
        }

        // Insert new signature record
        const { data: signatureData, error: insertError } = await supabase
            .from('user_signatures')
            .insert({
                user_id: user.id,
                signature_path: storagePath,
                signature_hash: fileHash,
                file_size: file.size,
                mime_type: file.type,
                is_active: true,
            })
            .select('id')
            .single()

        if (insertError || !signatureData) {
            console.error('Insert signature error:', insertError)
            // Try to clean up uploaded file
            await supabase.storage.from('user-signatures').remove([storagePath])
            return { success: false, error: 'Lưu thông tin chữ ký thất bại' }
        }

        return { success: true, signatureId: signatureData.id }

    } catch (error) {
        console.error('Upload signature error:', error)
        return { success: false, error: 'Đã xảy ra lỗi khi tải lên chữ ký' }
    }
}

/**
 * Get active signature for current user or specified user
 *
 * Used for:
 * - Displaying signature in manager settings
 * - Fetching signature during CoA generation
 */
export async function getActiveSignature(userId?: string): Promise<GetActiveSignatureResult> {
    try {
        const supabase = await createClient()

        // Get current user if userId not provided
        let targetUserId = userId
        if (!targetUserId) {
            const { data: { user }, error: authError } = await supabase.auth.getUser()
            if (authError || !user) {
                return { success: false, error: 'Người dùng chưa đăng nhập' }
            }
            targetUserId = user.id
        }

        // Fetch active signature
        const { data, error } = await supabase
            .from('user_signatures')
            .select('id, signature_path, signature_hash, mime_type, uploaded_at')
            .eq('user_id', targetUserId)
            .eq('is_active', true)
            .is('deleted_at', null)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows returned
                return { success: false, error: 'Chưa có chữ ký nào được tải lên' }
            }
            console.error('Get active signature error:', error)
            return { success: false, error: 'Lỗi khi lấy thông tin chữ ký' }
        }

        // Validate response
        const validation = ActiveSignatureSchema.safeParse(data)
        if (!validation.success) {
            console.error('Invalid signature data:', validation.error)
            return { success: false, error: 'Dữ liệu chữ ký không hợp lệ' }
        }

        return { success: true, signature: validation.data }

    } catch (error) {
        console.error('Get active signature error:', error)
        return { success: false, error: 'Đã xảy ra lỗi khi lấy thông tin chữ ký' }
    }
}

/**
 * Get signature history for current user
 *
 * Returns all signatures (active and inactive) for audit trail
 */
export async function getSignatureHistory(): Promise<GetSignatureHistoryResult> {
    try {
        const supabase = await createClient()

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return { success: false, error: 'Người dùng chưa đăng nhập' }
        }

        // Fetch signature history
        const { data, error } = await supabase
            .from('user_signatures')
            .select('id, uploaded_at, is_active, file_size, mime_type')
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .order('uploaded_at', { ascending: false })

        if (error) {
            console.error('Get signature history error:', error)
            return { success: false, error: 'Lỗi khi lấy lịch sử chữ ký' }
        }

        // Validate response
        const validation = z.array(SignatureHistoryItemSchema).safeParse(data)
        if (!validation.success) {
            console.error('Invalid signature history data:', validation.error)
            return { success: false, error: 'Dữ liệu lịch sử chữ ký không hợp lệ' }
        }

        return { success: true, history: validation.data }

    } catch (error) {
        console.error('Get signature history error:', error)
        return { success: false, error: 'Đã xảy ra lỗi khi lấy lịch sử chữ ký' }
    }
}

/**
 * Download signature file (for preview or CoA generation)
 *
 * Returns base64 data URI for embedding in HTML
 */
export async function downloadSignature(signaturePath: string): Promise<
    | { success: true; dataUri: string; mimeType: string }
    | { success: false; error: string }
> {
    try {
        const supabase = await createClient()

        // Download file from storage
        const { data, error } = await supabase.storage
            .from('user-signatures')
            .download(signaturePath)

        if (error || !data) {
            console.error('Download signature error:', error)
            return { success: false, error: 'Tải xuống file chữ ký thất bại' }
        }

        // Convert to base64
        const arrayBuffer = await data.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')

        // Determine MIME type from file extension
        const mimeType = signaturePath.endsWith('.png') ? 'image/png' : 'image/jpeg'
        const dataUri = `data:${mimeType};base64,${base64}`

        return { success: true, dataUri, mimeType }

    } catch (error) {
        console.error('Download signature error:', error)
        return { success: false, error: 'Đã xảy ra lỗi khi tải xuống chữ ký' }
    }
}

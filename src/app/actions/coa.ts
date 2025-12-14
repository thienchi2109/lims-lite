'use server'

import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import { getActiveSignature, downloadSignature } from './signatures'

/**
 * Certificate of Analysis (CoA) Generation
 *
 * Phase 3.5: Integrated with Manager E-Signature
 * Phase 4: HTML Generation and Access Control (To be implemented)
 *
 * Features:
 * - Fetches approver's active signature
 * - Verifies signature integrity (SHA-256 hash)
 * - Converts signature to base64 data URI for HTML embedding
 * - Links signature_id to coa_reports record for 21 CFR Part 11 compliance
 */

// ============================================================================
// TYPES
// ============================================================================

type GenerateCoAResult =
    | { success: true; coaId: string; filePath: string }
    | { success: false; error: string }

interface SampleData {
    id: string
    sample_id_display: string
    approved_by: string | null
    approved_at: string | null
    client_name?: string
    // ... other sample fields to be added in Phase 4
}

interface CoAData {
    sample: SampleData
    results: any[] // To be defined in Phase 4
    approverName: string
    approverSignature: string // base64 data URI
    signatureId: string
    approvalDate: string
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetch sample data with approver information
 */
async function fetchSampleWithApprover(sampleId: string): Promise<SampleData | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('samples')
        .select(`
            id,
            sample_id_display,
            approved_by,
            approved_at,
            clients!inner (
                name
            )
        `)
        .eq('id', sampleId)
        .single()

    if (error || !data) {
        console.error('Fetch sample error:', error)
        return null
    }

    return {
        id: data.id,
        sample_id_display: data.sample_id_display,
        approved_by: data.approved_by,
        approved_at: data.approved_at,
        client_name: (data.clients as any)?.name
    }
}

/**
 * Verify signature hash integrity
 */
async function verifySignatureHash(
    signatureBuffer: ArrayBuffer,
    expectedHash: string
): Promise<boolean> {
    const hash = createHash('sha256')
    hash.update(Buffer.from(signatureBuffer))
    const computedHash = hash.digest('hex')
    return computedHash === expectedHash
}

/**
 * Generate HTML from template (Phase 4 - to be implemented)
 * For now, this is a placeholder
 */
function renderCoATemplate(coaData: CoAData): string {
    // TODO Phase 4: Implement actual HTML template rendering
    // This should use the template from docs/references/CoATemplate.html
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Giấy chứng nhận phân tích - ${coaData.sample.sample_id_display}</title>
        </head>
        <body>
            <h1>GIẤY CHỨNG NHẬN PHÂN TÍCH</h1>
            <p>Mẫu: ${coaData.sample.sample_id_display}</p>
            <p>Khách hàng: ${coaData.sample.client_name || 'N/A'}</p>

            <!-- Signature Section -->
            <div class="signature-section">
                <div class="signature-block">
                    <p class="signature-title">LÃNH ĐẠO KHOA XÉT NGHIỆM</p>
                    <img src="${coaData.approverSignature}" alt="Chữ ký" class="signature-image" />
                    <p class="approver-name">${coaData.approverName}</p>
                    <p class="approval-date">Ngày ${coaData.approvalDate}</p>
                </div>
            </div>

            <!-- Hidden metadata for verification -->
            <div style="display:none">
                <span data-signature-id="${coaData.signatureId}"></span>
            </div>
        </body>
        </html>
    `
}

/**
 * Generate file hash for integrity verification
 */
function generateHtmlHash(html: string): string {
    const hash = createHash('sha256')
    hash.update(html, 'utf8')
    return hash.digest('hex')
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generate Certificate of Analysis (CoA) for approved sample
 *
 * Workflow:
 * 1. Fetch sample data with approver information
 * 2. Fetch approver's active signature
 * 3. Download signature file from storage
 * 4. Verify signature integrity (hash check)
 * 5. Convert signature to base64 data URI
 * 6. Generate HTML with embedded signature
 * 7. Upload HTML to coa-reports storage bucket
 * 8. Insert coa_reports record with signature_id linkage
 *
 * Requirements:
 * - Sample must be approved (status = 'approved' or 'completed')
 * - Approver must have an active signature uploaded
 * - Signature file must pass integrity verification
 *
 * Compliance:
 * - Signature embedded in immutable HTML file
 * - signature_id creates permanent link to signature version
 * - File hash verifies integrity of entire document
 * - Satisfies 21 CFR Part 11 §11.70 (signature/record linking)
 */
export async function generateCoA(sampleId: string): Promise<GenerateCoAResult> {
    try {
        const supabase = await createClient()

        // Step 1: Fetch sample data
        const sample = await fetchSampleWithApprover(sampleId)
        if (!sample) {
            return { success: false, error: 'Không tìm thấy thông tin mẫu' }
        }

        if (!sample.approved_by) {
            return { success: false, error: 'Mẫu chưa được phê duyệt' }
        }

        const approverId = sample.approved_by

        // Step 2: Fetch approver's active signature
        const signatureResult = await getActiveSignature(approverId)
        if (!signatureResult.success) {
            return {
                success: false,
                error: 'Người phê duyệt chưa tải lên chữ ký điện tử. ' +
                    'Vui lòng tải lên chữ ký trong Cài đặt tài khoản trước khi tạo CoA.'
            }
        }

        const signature = signatureResult.signature

        // Step 3: Download signature file from storage
        const downloadResult = await downloadSignature(signature.signature_path)
        if (!downloadResult.success) {
            return {
                success: false,
                error: 'Không thể tải xuống file chữ ký. File có thể đã bị xóa. ' +
                    'Vui lòng tải lên chữ ký mới trong Cài đặt tài khoản.'
            }
        }

        // Step 4: Verify signature integrity
        // Download the actual file for hash verification
        const { data: signatureFileData, error: downloadError } = await supabase.storage
            .from('user-signatures')
            .download(signature.signature_path)

        if (downloadError || !signatureFileData) {
            return {
                success: false,
                error: 'Không thể tải xuống file chữ ký để xác minh'
            }
        }

        const signatureBuffer = await signatureFileData.arrayBuffer()
        const hashValid = await verifySignatureHash(signatureBuffer, signature.signature_hash)

        if (!hashValid) {
            return {
                success: false,
                error: 'Xác minh tính toàn vẹn chữ ký thất bại. ' +
                    'File chữ ký có thể đã bị thay đổi. Vui lòng tải lên chữ ký mới.'
            }
        }

        // Step 5: Get signature as base64 data URI (already done by downloadSignature)
        const signatureDataUri = downloadResult.dataUri

        // Step 6: Get approver name
        const { data: approverData, error: approverError } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', approverId)
            .single()

        if (approverError || !approverData) {
            return { success: false, error: 'Không tìm thấy thông tin người phê duyệt' }
        }

        // Step 7: Generate HTML with embedded signature
        const coaData: CoAData = {
            sample,
            results: [], // TODO Phase 4: Fetch test results
            approverName: approverData.full_name,
            approverSignature: signatureDataUri,
            signatureId: signature.id,
            approvalDate: sample.approved_at ? new Date(sample.approved_at).toLocaleDateString('vi-VN') : 'N/A'
        }

        const html = renderCoATemplate(coaData)
        const htmlHash = generateHtmlHash(html)

        // Step 8: Upload HTML to storage
        const timestamp = new Date().toISOString()
        const version = 1 // TODO Phase 4: Implement versioning logic
        const filePath = `${sampleId}/${version}-${timestamp}.html`

        const { error: uploadError } = await supabase.storage
            .from('coa-reports')
            .upload(filePath, html, {
                contentType: 'text/html',
                upsert: false,
            })

        if (uploadError) {
            console.error('HTML upload error:', uploadError)
            return { success: false, error: 'Tải lên file CoA thất bại' }
        }

        // Step 9: Insert coa_reports record with signature_id
        const { data: coaData_db, error: insertError } = await supabase
            .from('coa_reports')
            .insert({
                sample_id: sampleId,
                file_path: filePath,
                file_hash: htmlHash,
                signature_id: signature.id, // ✅ Immutable link to signature version
                version,
                status: 'ready',
            })
            .select('id')
            .single()

        if (insertError || !coaData_db) {
            console.error('Insert coa_reports error:', insertError)
            // Try to clean up uploaded file
            await supabase.storage.from('coa-reports').remove([filePath])
            return { success: false, error: 'Lưu thông tin CoA thất bại' }
        }

        return {
            success: true,
            coaId: coaData_db.id,
            filePath
        }

    } catch (error) {
        console.error('Generate CoA error:', error)
        return { success: false, error: 'Đã xảy ra lỗi khi tạo CoA' }
    }
}

/**
 * Regenerate CoA (for failed generations)
 *
 * This function can be called when:
 * - Previous CoA generation failed
 * - Manager wants to regenerate with updated signature
 * - Template was updated and needs regeneration
 */
export async function regenerateCoA(sampleId: string): Promise<GenerateCoAResult> {
    // For now, just call generateCoA
    // In Phase 4, this should handle versioning properly
    return generateCoA(sampleId)
}

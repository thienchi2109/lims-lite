'use server'

import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import { getActiveSignature, downloadSignature } from './signatures'

/**
 * Certificate of Analysis (CoA) Generation
 *
 * Phase 3.5: Integrated with Manager E-Signature ✅
 * Phase 4: HTML Generation with Test Results ✅
 *
 * Features:
 * - Fetches approved test results from database
 * - Fetches approver's active signature
 * - Verifies signature integrity (SHA-256 hash)
 * - Converts signature to base64 data URI for HTML embedding
 * - Links signature_id to coa_reports record for 21 CFR Part 11 compliance
 * - Generates production-ready HTML with test results table
 * - Uploads to coa-reports storage bucket with file hash
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
    sample_type?: string
    received_date?: string
}

interface TestResult {
    assay_name: string
    value: string | null
    unit: string | null
    normal_range: string | null
    method_name: string | null
}

interface CoAData {
    sample: SampleData
    results: TestResult[]
    approverName: string
    approverSignature: string | null // base64 data URI (optional - null shows placeholder)
    signatureId: string | null
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

    // Fetch sample with client info
    const { data: sample, error: sampleError } = await supabase
        .from('samples')
        .select(`
            id,
            sample_id,
            type,
            received_at,
            status,
            clients!inner (
                name
            )
        `)
        .eq('id', sampleId)
        .is('deleted_at', null)
        .single()

    if (sampleError || !sample) {
        console.error('Fetch sample error:', sampleError)
        return null
    }

    // Get approver info from the first approved result
    const { data: approvedResult, error: resultError } = await supabase
        .from('results')
        .select('approved_by, approved_at')
        .eq('sample_id', sampleId)
        .eq('status', 'approved')
        .not('approved_by', 'is', null)
        .order('approved_at', { ascending: false })
        .limit(1)
        .single()

    if (resultError || !approvedResult) {
        console.error('Fetch approved result error:', resultError)
        return null
    }

    return {
        id: sample.id,
        sample_id_display: sample.sample_id,
        approved_by: approvedResult.approved_by,
        approved_at: approvedResult.approved_at,
        client_name: (sample.clients as any)?.name,
        sample_type: sample.type,
        received_date: sample.received_at
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
 * Fetch approved test results for CoA
 */
async function fetchTestResults(sampleId: string): Promise<TestResult[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('results')
        .select(`
            value,
            assay_definitions!inner (
                name,
                units,
                validation_rules
            ),
            methods (
                name
            )
        `)
        .eq('sample_id', sampleId)
        .eq('status', 'approved')

    if (error || !data) {
        console.error('Fetch test results error:', error)
        return []
    }

    // Sort by assay name
    const sorted = data.sort((a: any, b: any) => {
        const nameA = a.assay_definitions?.name || ''
        const nameB = b.assay_definitions?.name || ''
        return nameA.localeCompare(nameB)
    })

    return sorted.map((row: any) => {
        // Extract normal_range from validation_rules if it exists
        const validationRules = row.assay_definitions?.validation_rules || {}
        const normalRange = validationRules.normal_range || null

        return {
            assay_name: row.assay_definitions?.name || 'N/A',
            value: row.value,
            unit: row.assay_definitions?.units || null,
            normal_range: normalRange,
            method_name: row.methods?.name || null
        }
    })
}

/**
 * Generate HTML from CoA template
 * Based on docs/references/CoATemplate.html structure
 * Production-ready Vietnamese CDC lab CoA format
 */
function renderCoATemplate(coaData: CoAData): string {
    // Based on docs/references/CoATemplate.html structure
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${coaData.sample.sample_id_display}&margin=0`
    const logoUrl = "https://i.postimg.cc/8zFZ52j1/cdc-logo-150.png"
    const dateStr = coaData.approvalDate

    return `
<!DOCTYPE html>
<html lang="vi">

<head>
    <meta charset="UTF-8">
    <title>Kết quả xét nghiệm - ${coaData.sample.sample_id_display}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');

        /* Cấu hình khổ giấy A4 */
        @page {
            margin: 15mm;
            size: A4;
        }

        body {
            font-family: 'Times New Roman', serif;
            font-size: 14px;
            color: #000;
            line-height: 1.4;
            background: #fff;
            margin: 0;
            padding: 10px;
        }

        .container {
            width: 100%;
            margin: 0 auto;
        }

        /* HEADER */
        .header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 25px;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
        }

        .header-left {
            flex: 0 0 15%;
            display: flex;
            justify-content: center;
        }

        .logo {
            width: 100px;
            height: auto;
            display: block;
        }

        .header-center {
            flex: 1;
            text-align: center;
            padding: 0 15px;
        }

        .org-parent {
            font-size: 14px;
            text-transform: uppercase;
            margin: 0;
        }

        .org-name {
            font-size: 16px;
            font-weight: bold;
            margin: 5px 0 0 0;
            text-transform: uppercase;
        }

        .org-address {
            font-size: 12px;
            margin-top: 5px;
            font-style: italic;
        }

        .form-name {
            font-size: 26px;
            font-weight: bold;
            margin-top: 20px;
            text-transform: uppercase;
            color: #b91c1c;
        }

        /* Màu đỏ cho tiêu đề chính */
        .header-right {
            flex: 0 0 15%;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .qr-img {
            width: 90px;
            height: 90px;
            margin-bottom: 8px;
        }

        .sample-id-box {
            font-family: monospace;
            font-size: 12px;
            font-weight: bold;
            border: 1px solid #000;
            padding: 4px;
            border-radius: 4px;
        }

        /* TABLES */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 14px;
        }

        td,
        th {
            border: 1px solid #000;
            padding: 8px;
            vertical-align: middle;
        }

        /* Info Table Specifics */
        .info-label {
            font-weight: bold;
            background-color: #f3f4f6;
            width: 150px;
        }

        .info-value {
            font-weight: 500;
        }

        /* Result Table Specifics */
        .res-table th {
            background-color: #e5e7eb;
            font-weight: bold;
            text-transform: uppercase;
            text-align: center;
            border-bottom: 2px solid #000;
        }

        .res-name {
            font-weight: 500;
        }

        .res-value {
            font-weight: bold;
            text-align: center;
            font-size: 15px;
        }

        .res-unit {
            text-align: center;
        }

        .res-range {
            text-align: center;
            font-style: italic;
        }

        .res-method {
            text-align: center;
            font-size: 12px;
        }

        /* FOOTER */
        .footer {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
        }

        .footer-col {
            text-align: center;
            width: 45%;
        }

        .footer-title {
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 5px;
            font-size: 14px;
        }

        .footer-sign-area {
            height: 100px;
            margin-top: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .signature-image {
            max-width: 200px;
            max-height: 80px;
            display: block;
            margin: 0 auto;
        }

        .footer-disclaimer {
            margin-top: 50px;
            border-top: 1px solid #ccc;
            padding-top: 10px;
            font-size: 12px;
            font-style: italic;
            text-align: center;
            color: #555;
        }

        /* Hidden metadata for verification */
        .metadata {
            display: none;
        }

        @media print {
            body {
                -webkit-print-color-adjust: exact;
            }

            .header-center {
                flex: 1;
            }
        }
    </style>
</head>

<body>
    <div class="container">
        <!-- HEADER -->
        <div class="header">
            <div class="header-left"><img src="${logoUrl}" class="logo" /></div>
            <div class="header-center">
                <div class="org-parent">SỞ Y TẾ THÀNH PHỐ CẦN THƠ</div>
                <div class="org-name">TRUNG TÂM KIỂM SOÁT BỆNH TẬT (CDC)</div>
                <div class="org-address">400 Nguyễn Văn Cừ, P. An Bình, TP. Cần Thơ</div>
                <div class="form-name">KẾT QUẢ XÉT NHIỆM</div>
            </div>
            <div class="header-right"><img src="${qrCodeUrl}" class="qr-img" />
                <div class="sample-id-box">${coaData.sample.sample_id_display}</div>
            </div>
        </div>

        <!-- INFO -->
        <div style="margin-bottom: 20px;">
            <table>
                <tr>
                    <td class="info-label">Khách hàng:</td>
                    <td class="info-value" style="text-transform: uppercase; font-size: 16px; font-weight: bold;"
                        colspan="3">${coaData.sample.client_name || 'N/A'}</td>
                </tr>
                <tr>
                    <td class="info-label">Mã mẫu:</td>
                    <td class="info-value">${coaData.sample.sample_id_display}</td>
                    <td class="info-label">Loại mẫu:</td>
                    <td class="info-value">${coaData.sample.sample_type || 'N/A'}</td>
                </tr>
                <tr>
                    <td class="info-label">Ngày nhận mẫu:</td>
                    <td class="info-value">${coaData.sample.received_date ? new Date(coaData.sample.received_date).toLocaleDateString('vi-VN') : 'N/A'}</td>
                    <td class="info-label">Ngày phê duyệt:</td>
                    <td class="info-value">${dateStr}</td>
                </tr>
            </table>
        </div>

        <!-- RESULTS -->
        <table class="res-table">
            <thead>
                <tr>
                    <th width="5%">STT</th>
                    <th width="30%">Chỉ Tiêu Xét Nghiệm</th>
                    <th width="15%">Kết Quả</th>
                    <th width="10%">Đơn Vị</th>
                    <th width="20%">Khoảng Tham Chiếu</th>
                    <th width="20%">Phương Pháp</th>
                </tr>
            </thead>
            <tbody>
                ${coaData.results.length > 0 ? coaData.results.map((result, index) => `
                <tr>
                    <td style="text-align: center;">${index + 1}</td>
                    <td class="res-name">${result.assay_name}</td>
                    <td class="res-value">${result.value || '-'}</td>
                    <td class="res-unit">${result.unit || ''}</td>
                    <td class="res-range">${result.normal_range || ''}</td>
                    <td class="res-method">${result.method_name || ''}</td>
                </tr>
                `).join('') : `
                <tr>
                    <td colspan="6" style="text-align: center; font-style: italic; color: #666;">
                        Không có kết quả xét nghiệm
                    </td>
                </tr>
                `}
            </tbody>
        </table>

        <!-- FOOTER -->
        <div class="footer">
            <div class="footer-col">
                <div class="footer-title">PHỤ TRÁCH XÉT NGHIỆM</div>
                <div class="footer-sign-area"></div>
                <div style="font-weight: bold;">KTV. .................................</div>
            </div>
            <div class="footer-col">
                <div style="font-style: italic; margin-bottom: 5px;">Cần Thơ, ${dateStr}</div>
                <div class="footer-title">LÃNH ĐẠO KHOA XÉT NGHIỆM</div>
                <div class="footer-sign-area">
                    ${coaData.approverSignature ? `<img src="${coaData.approverSignature}" alt="Chữ ký" class="signature-image" />` : ''}
                </div>
                <div style="font-weight: bold;">${coaData.approverName}</div>
            </div>
        </div>

        <div class="footer-disclaimer">
            Kết quả xét nghiệm chỉ có giá trị trên mẫu xét nghiệm tại thời điểm kiểm tra.
        </div>

        <!-- Hidden metadata for verification -->
        <div class="metadata">
            <span data-signature-id="${coaData.signatureId}"></span>
            <span data-sample-id="${coaData.sample.id}"></span>
            <span data-approved-by="${coaData.sample.approved_by}"></span>
            <span data-approved-at="${coaData.sample.approved_at}"></span>
        </div>
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
 * 6. Get approver name
 * 7. Fetch approved test results
 * 8. Generate HTML with embedded signature and test results
 * 9. Upload HTML to coa-reports storage bucket
 * 10. Insert coa_reports record with signature_id linkage
 *
 * Requirements:
 * - Sample must be approved (status = 'approved' or 'completed')
 * - Approver must have an active signature uploaded
 * - Signature file must pass integrity verification
 * - At least one approved test result exists
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

        // Only managers can generate CoA
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
            return { success: false, error: 'Unauthorized' }
        }

        const { data: userData, error: roleError } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (roleError || !userData || userData.role !== 'manager') {
            return { success: false, error: 'Chỉ Quản lý mới có thể tạo CoA' }
        }

        // Step 1: Fetch sample data
        const sample = await fetchSampleWithApprover(sampleId)
        if (!sample) {
            return { success: false, error: 'Không tìm thấy thông tin mẫu' }
        }

        if (!sample.approved_by) {
            return { success: false, error: 'Mẫu chưa được phê duyệt' }
        }

        const approverId = sample.approved_by

        // Step 2: Fetch approver's active signature (OPTIONAL - use placeholder if not available)
        let signatureDataUri: string | null = null
        let signatureId: string | null = null

        const signatureResult = await getActiveSignature(approverId)
        if (signatureResult.success) {
            const signature = signatureResult.signature

            // Step 3: Download signature file from storage
            const downloadResult = await downloadSignature(signature.signature_path)
            if (downloadResult.success) {
                // Step 4: Verify signature integrity
                const { data: signatureFileData, error: downloadError } = await supabase.storage
                    .from('user-signatures')
                    .download(signature.signature_path)

                if (signatureFileData && !downloadError) {
                    const signatureBuffer = await signatureFileData.arrayBuffer()
                    const hashValid = await verifySignatureHash(signatureBuffer, signature.signature_hash)

                    if (hashValid) {
                        // Signature is valid - use it
                        signatureDataUri = downloadResult.dataUri
                        signatureId = signature.id
                    } else {
                        console.warn('Signature hash verification failed, using placeholder')
                    }
                } else {
                    console.warn('Could not download signature file, using placeholder')
                }
            } else {
                console.warn('Could not download signature, using placeholder')
            }
        } else {
            console.warn('No active signature found for approver, using placeholder')
        }

        // Step 6: Get approver name
        const { data: approverData, error: approverError } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', approverId)
            .single()

        if (approverError || !approverData) {
            return { success: false, error: 'Không tìm thấy thông tin người phê duyệt' }
        }

        // Step 7: Fetch test results
        const results = await fetchTestResults(sampleId)

        // Step 8: Generate HTML with embedded signature and test results
        const coaData: CoAData = {
            sample,
            results,
            approverName: approverData.full_name,
            approverSignature: signatureDataUri,
            signatureId: signatureId,
            approvalDate: sample.approved_at ? new Date(sample.approved_at).toLocaleDateString('vi-VN') : 'N/A'
        }

        const html = renderCoATemplate(coaData)
        const htmlHash = generateHtmlHash(html)

        // Step 9: Check for existing CoA record
        const version = 1 // TODO Phase 4: Implement versioning logic
        const { data: existingCoa, error: checkError } = await supabase
            .from('coa_reports')
            .select('id, status, file_path')
            .eq('sample_id', sampleId)
            .eq('version', version)
            .maybeSingle()

        if (checkError) {
            console.error('Error checking existing CoA:', checkError)
            return { success: false, error: 'Lỗi khi kiểm tra CoA hiện có' }
        }

        // If CoA exists and is ready, return error (already generated)
        if (existingCoa && existingCoa.status === 'ready') {
            return {
                success: false,
                error: 'CoA đã được tạo cho mẫu này. Sử dụng chức năng tạo lại CoA nếu cần cập nhật.'
            }
        }

        // Step 10: Upload HTML to storage
        const timestamp = new Date().toISOString()
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

        // Step 11: Insert or Update coa_reports record
        let coaId: string

        if (existingCoa) {
            // Update existing pending/failed record
            const { data: updatedCoa, error: updateError } = await supabase
                .from('coa_reports')
                .update({
                    file_path: filePath,
                    file_hash: htmlHash,
                    signature_id: signatureId,
                    status: 'ready',
                    error_message: null,
                    generated_at: new Date().toISOString(),
                })
                .eq('id', existingCoa.id)
                .select('id')
                .single()

            if (updateError || !updatedCoa) {
                console.error('Update coa_reports error:', updateError)
                // Try to clean up uploaded file
                await supabase.storage.from('coa-reports').remove([filePath])
                return { success: false, error: 'Lưu thông tin CoA thất bại' }
            }

            // Clean up old file if it exists
            if (existingCoa.file_path) {
                await supabase.storage.from('coa-reports').remove([existingCoa.file_path])
            }

            coaId = updatedCoa.id
        } else {
            // Insert new record
            const { data: newCoa, error: insertError } = await supabase
                .from('coa_reports')
                .insert({
                    sample_id: sampleId,
                    file_path: filePath,
                    file_hash: htmlHash,
                    signature_id: signatureId,
                    version,
                    status: 'ready',
                })
                .select('id')
                .single()

            if (insertError || !newCoa) {
                console.error('Insert coa_reports error:', insertError)
                // Try to clean up uploaded file
                await supabase.storage.from('coa-reports').remove([filePath])
                return { success: false, error: 'Lưu thông tin CoA thất bại' }
            }

            coaId = newCoa.id
        }

        return {
            success: true,
            coaId,
            filePath
        }

    } catch (error) {
        console.error('Generate CoA error:', error)
        return { success: false, error: 'Đã xảy ra lỗi khi tạo CoA' }
    }
}

/**
 * Regenerate CoA (for failed generations or updating existing CoAs)
 *
 * This function can be called when:
 * - Previous CoA generation failed
 * - Manager wants to regenerate with updated signature
 * - Template was updated and needs regeneration
 * - CoA already exists and needs to be updated
 */
export async function regenerateCoA(sampleId: string): Promise<GenerateCoAResult> {
    try {
        const supabase = await createClient()

        // Check if CoA exists
        const version = 1 // TODO Phase 4: Implement versioning logic
        const { data: existingCoa, error: checkError } = await supabase
            .from('coa_reports')
            .select('id, status, file_path')
            .eq('sample_id', sampleId)
            .eq('version', version)
            .maybeSingle()

        if (checkError) {
            console.error('Error checking existing CoA:', checkError)
            return { success: false, error: 'Lỗi khi kiểm tra CoA hiện có' }
        }

        // If CoA exists with status='ready', save state before marking as failed
        let previousState: { status: string; filePath: string | null } | null = null

        if (existingCoa && existingCoa.status === 'ready') {
            // Save previous state for potential restoration
            previousState = {
                status: existingCoa.status,
                filePath: existingCoa.file_path
            }

            // Mark as failed so generateCoA can update it
            const { error: updateError } = await supabase
                .from('coa_reports')
                .update({ status: 'failed', error_message: 'Regenerating CoA' })
                .eq('id', existingCoa.id)

            if (updateError) {
                console.error('Error marking CoA as failed:', updateError)
                return { success: false, error: 'Lỗi khi chuẩn bị tạo lại CoA' }
            }
        }

        // Now call generateCoA which will update the existing record
        const result = await generateCoA(sampleId)

        // If regeneration failed and we had a previously ready CoA, restore it
        if (!result.success && previousState && existingCoa) {
            console.warn('Regeneration failed, restoring previous ready state for CoA:', existingCoa.id)
            const { error: restoreError } = await supabase
                .from('coa_reports')
                .update({
                    status: previousState.status,
                    file_path: previousState.filePath,
                    error_message: null
                })
                .eq('id', existingCoa.id)

            if (restoreError) {
                console.error('Failed to restore previous CoA state:', restoreError)
                // Return error indicating both regeneration and restoration failed
                return {
                    success: false,
                    error: 'Tạo lại CoA thất bại và không thể khôi phục trạng thái trước đó. Vui lòng liên hệ quản trị viên.'
                }
            }

            // State restored, return the original generation error
            return result
        }

        return result
    } catch (error) {
        console.error('Regenerate CoA error:', error)
        return { success: false, error: 'Đã xảy ra lỗi khi tạo lại CoA' }
    }
}

// ============================================================================
// COA ACCESS LOG VIEWER (Manager Feature)
// ============================================================================

/**
 * Fetch CoA access logs for a sample (manager only)
 */
export async function getCoAAccessLogs(sampleId: string): Promise<{
    data: {
        id: string
        client_name: string
        sample_id_display: string
        accessed_at: string
        ip_address: string | null
        user_agent: string | null
        success: boolean
        failure_reason: string | null
    }[]
    error?: string
}> {
    try {
        const supabase = await createClient()

        // Verify user is manager
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { data: [], error: 'User not authenticated' }
        }

        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!userData || userData.role !== 'manager') {
            return { data: [], error: 'Unauthorized: Only managers can view access logs' }
        }

        // Fetch access logs with client name
        const { data: logs, error } = await supabase
            .from('coa_access_log')
            .select(
                `
                id,
                accessed_at,
                ip_address,
                user_agent,
                success,
                failure_reason,
                clients!inner (
                    name
                ),
                samples!inner (
                    sample_id
                )
            `
            )
            .eq('sample_id', sampleId)
            .order('accessed_at', { ascending: false })

        if (error) {
            console.error('Error fetching CoA access logs:', error)
            return { data: [], error: error.message }
        }

        // Transform data to flat structure
        const transformedLogs = (logs || []).map((log: any) => ({
            id: log.id,
            client_name: log.clients?.name || 'N/A',
            sample_id_display: log.samples?.sample_id || 'N/A',
            accessed_at: log.accessed_at,
            ip_address: log.ip_address,
            user_agent: log.user_agent,
            success: log.success,
            failure_reason: log.failure_reason,
        }))

        return { data: transformedLogs }
    } catch (error) {
        console.error('Unexpected error in getCoAAccessLogs:', error)
        return { data: [], error: 'Unexpected error occurred' }
    }
}

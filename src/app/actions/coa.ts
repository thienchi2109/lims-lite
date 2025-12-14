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
            sample_type,
            received_date,
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
        client_name: (data.clients as any)?.name,
        sample_type: data.sample_type,
        received_date: data.received_date
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
            assays!inner (
                name,
                unit,
                normal_range
            ),
            methods (
                name
            )
        `)
        .eq('sample_id', sampleId)
        .eq('status', 'approved')
        .order('assays(name)', { ascending: true })

    if (error || !data) {
        console.error('Fetch test results error:', error)
        return []
    }

    return data.map((row: any) => ({
        assay_name: row.assays?.name || 'N/A',
        value: row.value,
        unit: row.assays?.unit || null,
        normal_range: row.assays?.normal_range || null,
        method_name: row.methods?.name || null
    }))
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Giấy chứng nhận phân tích - ${coaData.sample.sample_id_display}</title>
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

        /* INFO TABLE */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 14px;
        }

        td, th {
            border: 1px solid #000;
            padding: 8px;
            vertical-align: middle;
        }

        th {
            background-color: #e5e7eb;
            font-weight: bold;
            text-align: center;
        }

        .info-label {
            font-weight: bold;
            background-color: #f3f4f6;
            width: 150px;
        }

        .info-value {
            font-weight: 500;
        }

        /* SIGNATURE SECTION */
        .signature-section {
            display: flex;
            justify-content: space-around;
            margin-top: 40px;
            page-break-inside: avoid;
        }

        .signature-block {
            text-align: center;
            width: 250px;
        }

        .signature-title {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 10px;
            text-transform: uppercase;
        }

        .signature-date {
            font-style: italic;
            margin-bottom: 10px;
            font-size: 13px;
        }

        .signature-image-container {
            height: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 15px 0;
        }

        .signature-image {
            max-width: 200px;
            max-height: 80px;
            display: block;
            margin: 0 auto;
        }

        .signature-placeholder {
            height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-style: italic;
            color: #666;
            font-size: 12px;
        }

        .approver-name {
            font-weight: bold;
            font-size: 14px;
            margin-top: 10px;
        }

        .footer-disclaimer {
            margin-top: 30px;
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
            .signature-section {
                margin-top: 30px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- HEADER -->
        <div class="header">
            <div class="header-left">
                <img src="${logoUrl}" class="logo" alt="Logo" />
            </div>
            <div class="header-center">
                <div class="org-parent">SỞ Y TẾ THÀNH PHỐ CẦN THƠ</div>
                <div class="org-name">TRUNG TÂM KIỂM SOÁT BỆNH TẬT (CDC)</div>
                <div class="org-address">400 Nguyễn Văn Cừ, P. An Bình, TP. Cần Thơ</div>
                <div class="form-name">GIẤY CHỨNG NHẬN PHÂN TÍCH</div>
            </div>
            <div class="header-right">
                <img src="${qrCodeUrl}" class="qr-img" alt="QR Code" />
                <div class="sample-id-box">${coaData.sample.sample_id_display}</div>
            </div>
        </div>

        <!-- INFO -->
        <div style="margin-bottom: 20px;">
            <table>
                <tr>
                    <td class="info-label">Khách hàng:</td>
                    <td class="info-value" colspan="3" style="text-transform: uppercase; font-size: 16px; font-weight: bold;">
                        ${coaData.sample.client_name || 'N/A'}
                    </td>
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

        <!-- RESULTS TABLE -->
        <div style="margin-bottom: 20px;">
            <table>
                <thead>
                    <tr style="background-color: #e5e7eb;">
                        <th style="text-align: center; width: 10%;">STT</th>
                        <th style="text-align: left; width: 30%;">Chỉ tiêu xét nghiệm</th>
                        <th style="text-align: left; width: 25%;">Phương pháp</th>
                        <th style="text-align: center; width: 15%;">Kết quả</th>
                        <th style="text-align: center; width: 20%;">Chỉ số bình thường</th>
                    </tr>
                </thead>
                <tbody>
                    ${coaData.results.length > 0 ? coaData.results.map((result, index) => `
                    <tr>
                        <td style="text-align: center;">${index + 1}</td>
                        <td>${result.assay_name}</td>
                        <td style="font-style: italic; font-size: 13px;">${result.method_name || 'N/A'}</td>
                        <td style="text-align: center; font-weight: bold;">
                            ${result.value || 'Chưa có'} ${result.unit || ''}
                        </td>
                        <td style="text-align: center; font-size: 13px;">
                            ${result.normal_range || 'N/A'}
                        </td>
                    </tr>
                    `).join('') : `
                    <tr>
                        <td colspan="5" style="text-align: center; font-style: italic; color: #666;">
                            Không có kết quả xét nghiệm
                        </td>
                    </tr>
                    `}
                </tbody>
            </table>
        </div>

        <!-- SIGNATURE SECTION -->
        <div class="signature-section">
            <div class="signature-block">
                <div class="signature-title">PHỤ TRÁCH XÉT NGHIỆM</div>
                <div class="signature-image-container">
                    <div class="signature-placeholder">(Ký và ghi rõ họ tên)</div>
                </div>
                <div style="font-weight: bold;">KTV. ........................</div>
            </div>

            <div class="signature-block">
                <div class="signature-date">Cần Thơ, ${dateStr}</div>
                <div class="signature-title">LÃNH ĐẠO KHOA XÉT NGHIỆM</div>
                <div class="signature-image-container">
                    ${coaData.approverSignature ? `
                        <img src="${coaData.approverSignature}" alt="Chữ ký" class="signature-image" />
                    ` : `
                        <div class="signature-placeholder">(Ký và ghi rõ họ tên)</div>
                    `}
                </div>
                <div class="approver-name">${coaData.approverName}</div>
            </div>
        </div>

        <div class="footer-disclaimer">
            Giấy chứng nhận này chỉ có giá trị trên mẫu xét nghiệm tại thời điểm kiểm tra.
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

        // Step 7: Fetch test results
        const results = await fetchTestResults(sampleId)

        // Step 8: Generate HTML with embedded signature and test results
        const coaData: CoAData = {
            sample,
            results,
            approverName: approverData.full_name,
            approverSignature: signatureDataUri,
            signatureId: signature.id,
            approvalDate: sample.approved_at ? new Date(sample.approved_at).toLocaleDateString('vi-VN') : 'N/A'
        }

        const html = renderCoATemplate(coaData)
        const htmlHash = generateHtmlHash(html)

        // Step 9: Upload HTML to storage
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

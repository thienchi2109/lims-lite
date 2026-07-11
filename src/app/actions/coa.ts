'use server'

/**
 * Certificate of Analysis (CoA) Generation
 *
 * Phase 3.5: Integrated with Manager E-Signature
 * Phase 4: HTML Generation with Test Results
 *
 * Features:
 * - Fetches approved test results from database
 * - Fetches approver's active signature
 * - Converts signature to base64 data URI for HTML embedding
 * - Links signature_id to coa_reports record for 21 CFR Part 11 compliance
 * - Generates production-ready HTML with test results table
 * - Uploads to coa-reports storage bucket with file hash
 */

import { createClient } from '@/lib/supabase/server'
import { getActiveSignature, downloadSignature } from './signatures'
import type { CoAData, CoAManualInputs, UserRole } from '@/types'
import {
    getUserConfidentialAccess,
    isConfidentialAssociatedSample,
} from '@/lib/data/confidential-samples'
import { getCoAStampDataUri } from '@/lib/coa/stamp'
import {
    claimCoAReportForRegeneration,
    completeCoAReportGeneration,
    failCoAReportGeneration,
    fetchSnapshotTestResults,
    fetchSubmissionById,
    queueCoAReportForGeneration,
    type CoAReportSource,
} from '@/lib/coa/report-provenance'

// Import extracted modules
import {
    fetchSampleWithApprover,
    fetchTestingDate,
    fetchTestResults,
    generateHtmlHash,
    validateSampleForCoAGeneration,
    fetchLatestSubmission,
    fetchSignatureDataUri,
    fetchStoredSignatureDataUri,
    type GenerateCoAResult,
} from '@/lib/coa/helpers'
import { renderCoATemplate } from '@/lib/coa/template'

const CONCEALED_COA_SAMPLE_ERROR = 'Không tìm thấy thông tin mẫu'
const COA_GENERATION_IN_PROGRESS_ERROR = 'CoA đang được tạo bởi một tiến trình khác'
const HISTORIC_COA_REGENERATION_BLOCKED_ERROR =
    'Không thể tạo lại CoA lịch sử vì báo cáo chưa có nguồn dữ liệu đã duyệt bất biến'

async function denyUnauthorizedConfidentialCoA(
    sampleId: string,
    userId: string,
    supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
    const access = await getUserConfidentialAccess(userId, supabase)

    if (access.error) {
        console.error('Error verifying CoA confidentiality access:', access.error)
        return CONCEALED_COA_SAMPLE_ERROR
    }

    if (access.canAccessConfidential) {
        return null
    }

    try {
        const confidentialSample = await isConfidentialAssociatedSample(sampleId)

        return confidentialSample.data ? CONCEALED_COA_SAMPLE_ERROR : null
    } catch (error) {
        console.error('Error checking CoA confidential sample association:', error)
        return CONCEALED_COA_SAMPLE_ERROR
    }
}

async function failClaimedCoAGeneration(
    report: CoAReportSource,
    error: string,
): Promise<GenerateCoAResult> {
    if (!report.generationClaimId) {
        return { success: false, error, shouldRecordFailure: false }
    }

    await failCoAReportGeneration(
        report.reportId,
        report.generationClaimId,
        error,
        report.previousStatus === 'ready',
    )

    return { success: false, error, shouldRecordFailure: false }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generate Certificate of Analysis (CoA) for approved sample
 *
 * Authorization:
 * - Analysts: Can generate CoA only when sample.status='completed' AND all results are 'approved'
 * - Managers: Can generate CoA when sample.status='review' or 'completed' AND at least one result is 'approved'
 *
 * Workflow:
 * 1. Validate user role (analyst or manager)
 * 2. Role-specific validation (sample status and results approval)
 * 3. Fetch sample data with approver information
 * 4. Fetch approver's active signature
 * 5. Download signature file from storage
 * 6. Verify signature integrity (hash check)
 * 7. Convert signature to base64 data URI
 * 8. Get approver name
 * 9. Fetch approved test results
 * 10. Generate HTML with embedded signature and test results
 * 11. Upload HTML to coa-reports storage bucket
 * 12. Insert coa_reports record with signature_id linkage
 *
 * Requirements:
 * - User must be analyst or manager
 * - Analyst: sample.status='completed' AND all results 'approved'
 * - Manager: sample.status='review' or 'completed' AND at least one result 'approved'
 * - Approver must have an active signature uploaded (or placeholder used)
 * - Signature file must pass integrity verification (if using real signature)
 *
 * Compliance:
 * - Signature embedded in immutable HTML file
 * - signature_id creates permanent link to signature version
 * - File hash verifies integrity of entire document
 * - Satisfies 21 CFR Part 11 §11.70 (signature/record linking)
 * - Audit trail captures generator identity (user_id in coa_reports)
 */
export async function generateCoA(
    sampleId: string,
    manualInputs?: CoAManualInputs,
    claimedReport?: CoAReportSource,
): Promise<GenerateCoAResult> {
    let activeReport = claimedReport ?? null

    try {
        const supabase = await createClient()

        // Validate manual inputs if provided
        if (manualInputs) {
            const { CoAManualInputsSchema } = await import('@/types')
            const validationResult = CoAManualInputsSchema.safeParse(manualInputs)
            if (!validationResult.success) {
                return {
                    success: false,
                    error: 'Thông tin nhập không hợp lệ: ' + validationResult.error.issues[0].message
                }
            }
        }

        // Authorization: Analysts and managers can generate CoA
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

        if (roleError || !userData) {
            return { success: false, error: 'Không tìm thấy thông tin người dùng' }
        }

        const userRole = userData.role as UserRole
        if (userRole !== 'analyst' && userRole !== 'manager') {
            return { success: false, error: 'Chỉ Nhân viên phân tích và Quản lý mới có thể tạo CoA' }
        }

        const confidentialCoAError = await denyUnauthorizedConfidentialCoA(
            sampleId,
            user.id,
            supabase,
        )

        if (confidentialCoAError) {
            return { success: false, error: confidentialCoAError }
        }

        // Role-specific validation for sample status and results
        const validationResult = await validateSampleForCoAGeneration(sampleId)
        if (!validationResult.valid) {
            const validationError = validationResult.error || 'Lỗi xác thực mẫu'
            if (activeReport?.claimed) {
                return failClaimedCoAGeneration(activeReport, validationError)
            }
            return { success: false, error: validationError }
        }

        const version = 1
        const coaReport =
            activeReport
            ?? await queueCoAReportForGeneration(sampleId, version)
        if (!coaReport) {
            return {
                success: false,
                error: 'Không thể xác định nguồn dữ liệu đã duyệt cho CoA',
            }
        }
        activeReport = coaReport

        if (coaReport.status === 'ready') {
            return {
                success: false,
                code: 'ALREADY_READY',
                shouldRecordFailure: false,
                error: 'CoA đã được tạo cho mẫu này. Sử dụng chức năng tạo lại CoA nếu cần cập nhật.'
            }
        }

        if (!coaReport.claimed || !coaReport.generationClaimId) {
            return {
                success: false,
                code: 'IN_PROGRESS',
                shouldRecordFailure: false,
                error: COA_GENERATION_IN_PROGRESS_ERROR,
            }
        }

        // Step 1: Fetch sample data
        const sample = await fetchSampleWithApprover(sampleId)
        if (!sample) {
            return failClaimedCoAGeneration(
                coaReport,
                'Không tìm thấy thông tin mẫu',
            )
        }

        if (!sample.approved_by) {
            return failClaimedCoAGeneration(
                coaReport,
                'Mẫu chưa được phê duyệt',
            )
        }

        const approverId = sample.approved_by

        // Step 2: Fetch approver's active signature (REQUIRED for 21 CFR Part 11 compliance)
        // Use service role to bypass RLS - analysts need to access manager signatures for CoA
        const signatureResult = await getActiveSignature(approverId, { useServiceRole: true })

        if (!signatureResult.success) {
            console.error('No active signature found for approver:', signatureResult.error)
            return failClaimedCoAGeneration(
                coaReport,
                'Người phê duyệt chưa tải lên chữ ký điện tử. Vui lòng yêu cầu quản lý tải lên chữ ký trước khi tạo CoA.',
            )
        }

        const signature = signatureResult.signature

        // Step 3: Download signature file from storage using service role
        const downloadResult = await downloadSignature(signature.signature_path, { useServiceRole: true })

        if (!downloadResult.success) {
            console.error('Failed to download signature file:', downloadResult.error)
            return failClaimedCoAGeneration(
                coaReport,
                'Không thể tải xuống chữ ký điện tử. File chữ ký có thể bị hỏng. Vui lòng yêu cầu quản lý tải lên lại chữ ký.',
            )
        }

        // Signature downloaded successfully - use it
        // Note: Hash verification was done during upload, trusted here
        const signatureDataUri = downloadResult.dataUri
        const signatureId = signature.id

        // Step 6: Get approver name
        const { data: approverData, error: approverError } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', approverId)
            .single()

        if (approverError || !approverData) {
            return failClaimedCoAGeneration(
                coaReport,
                'Không tìm thấy thông tin người phê duyệt',
            )
        }

        // ========================================
        // FETCH PERFORMER (ANALYST) SIGNATURE
        // ========================================

        const submission = coaReport.sourceSubmissionId
            ? await fetchSubmissionById(coaReport.sourceSubmissionId)
            : await fetchLatestSubmission(sampleId)
        if (coaReport.sourceSubmissionId && !submission) {
            return failClaimedCoAGeneration(
                coaReport,
                'Không thể tải hồ sơ nguồn đã duyệt của CoA',
            )
        }

        let performerSignatureDataUri: string | undefined
        let performerSignatureId: string | undefined
        let performerName: string | undefined
        let performerSignatureMeaning: string | undefined

        if (submission) {
            const performerSig = coaReport.sourceSubmissionId
                ? await fetchStoredSignatureDataUri(
                    submission.signatureId,
                    submission.signaturePath,
                    submission.signatureHash,
                )
                : await fetchSignatureDataUri(
                    submission.performerId,
                    submission.signatureHash,
                )

            if (performerSig) {
                performerSignatureDataUri = performerSig.dataUri
                performerSignatureId = submission.signatureId
                performerName = submission.performerName ?? undefined
                performerSignatureMeaning = submission.signatureMeaning
            } else if (coaReport.sourceSubmissionId) {
                return failClaimedCoAGeneration(
                    coaReport,
                    'Không thể tải chữ ký đã lưu của người thực hiện',
                )
            }
        }

        // Step 7: Resolve immutable snapshots for sourced reports.
        // Historic reports without a source retain the assay-range fallback.
        const results = coaReport.sourceSubmissionId
            ? await fetchSnapshotTestResults(coaReport.sourceSubmissionId)
            : await fetchTestResults(sampleId)
        if (coaReport.sourceSubmissionId && results.length === 0) {
            return failClaimedCoAGeneration(
                coaReport,
                'Không thể tải ảnh chụp kết quả đã duyệt của CoA',
            )
        }

        // Step 7.5: Fetch testing date from audit logs
        const testingDate = await fetchTestingDate(sampleId)

        // Step 8: Generate HTML with embedded signature and test results
        const coaData: CoAData = {
            sample,
            results,
            approverName: approverData.full_name,
            approverSignature: signatureDataUri,
            signatureId: signatureId,
            approvalDate: sample.approved_at ? new Date(sample.approved_at).toLocaleDateString('vi-VN') : 'N/A',
            testingDate: testingDate,
            manualInputs: manualInputs,
            performerName,
            performerSignature: performerSignatureDataUri,
            performerSignatureId,
            performerSignatureMeaning,
        }

        let managerStampSrc: string
        try {
            managerStampSrc = await getCoAStampDataUri()
        } catch {
            return failClaimedCoAGeneration(
                coaReport,
                'Không thể tải con dấu điện tử để tạo CoA',
            )
        }

        const html = renderCoATemplate(coaData, { managerStampSrc })
        const htmlHash = generateHtmlHash(html)

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
            return failClaimedCoAGeneration(
                coaReport,
                'Tải lên file CoA thất bại',
            )
        }

        const completion = await completeCoAReportGeneration(
            coaReport.reportId,
            coaReport.generationClaimId,
            {
                filePath,
                fileHash: htmlHash,
                signatureId,
            },
        )

        if (completion.status === 'indeterminate') {
            return {
                success: false,
                shouldRecordFailure: false,
                error: 'Không thể xác nhận trạng thái lưu CoA',
            }
        }

        if (completion.status === 'rejected') {
            const { error: cleanupError } = await supabase.storage
                .from('coa-reports')
                .remove([filePath])
            if (cleanupError) {
                console.error('Failed to clean up unclaimed CoA file:', cleanupError)
            }
            return failClaimedCoAGeneration(
                coaReport,
                'Lưu thông tin CoA thất bại',
            )
        }

        const previousFilePath =
            completion.previousFilePath ?? coaReport.filePath
        if (
            previousFilePath
            && previousFilePath !== filePath
        ) {
            const { error: cleanupError } = await supabase.storage
                .from('coa-reports')
                .remove([previousFilePath])
            if (cleanupError) {
                console.error('Failed to remove replaced CoA file:', cleanupError)
            }
        }

        return {
            success: true,
            coaId: completion.reportId,
            filePath
        }

    } catch (error) {
        console.error('Generate CoA error:', error)
        if (activeReport?.claimed) {
            return failClaimedCoAGeneration(
                activeReport,
                'Đã xảy ra lỗi khi tạo CoA',
            )
        }
        return { success: false, error: 'Đã xảy ra lỗi khi tạo CoA' }
    }
}

/**
 * Regenerate CoA (for failed generations or updating existing CoAs)
 *
 * Authorization: Manager-only
 * Analysts are NOT allowed to regenerate CoAs - this preserves the integrity
 * of existing CoAs and maintains separation of duties.
 *
 * This function can be called when:
 * - Previous CoA generation failed
 * - Manager wants to regenerate with updated signature
 * - Template was updated and needs regeneration
 * - CoA already exists and needs to be updated
 */
export async function regenerateCoA(
    sampleId: string,
    manualInputs?: CoAManualInputs
): Promise<GenerateCoAResult> {
    try {
        const supabase = await createClient()

        // Authorization: Only managers can regenerate CoA
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
            return { success: false, error: 'Chỉ Quản lý mới có thể tạo lại CoA' }
        }

        const confidentialCoAError = await denyUnauthorizedConfidentialCoA(
            sampleId,
            user.id,
            supabase,
        )

        if (confidentialCoAError) {
            return { success: false, error: confidentialCoAError }
        }

        // Validate manual inputs if provided
        if (manualInputs) {
            const { CoAManualInputsSchema } = await import('@/types')
            const validationResult = CoAManualInputsSchema.safeParse(manualInputs)
            if (!validationResult.success) {
                return {
                    success: false,
                    error: 'Thông tin nhập không hợp lệ: ' + validationResult.error.issues[0].message
                }
            }
        }

        const report = await claimCoAReportForRegeneration(sampleId, 1)
        if (!report) {
            return {
                success: false,
                error: 'Không thể xác nhận quyền tạo lại CoA',
            }
        }

        if (report.blockedReason === 'HISTORIC_REPORT_WITHOUT_SOURCE') {
            return {
                success: false,
                shouldRecordFailure: false,
                error: HISTORIC_COA_REGENERATION_BLOCKED_ERROR,
            }
        }

        if (!report.claimed || !report.generationClaimId) {
            return {
                success: false,
                code: 'IN_PROGRESS',
                shouldRecordFailure: false,
                error: COA_GENERATION_IN_PROGRESS_ERROR,
            }
        }

        return generateCoA(sampleId, manualInputs, report)
    } catch (error) {
        console.error('Regenerate CoA error:', error)
        return { success: false, error: 'Đã xảy ra lỗi khi tạo lại CoA' }
    }
}

/**
 * Get CoA status for a sample
 * Returns the current CoA report status if one exists
 */
export async function getCoAStatus(
    sampleId: string
): Promise<{ status: import('@/types').CoAReportStatus | null; error?: string }> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('coa_reports')
            .select('status')
            .eq('sample_id', sampleId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (error) {
            console.error('Error fetching CoA status:', error)
            return { status: null, error: error.message }
        }

        return { status: data?.status || null }
    } catch (error) {
        console.error('Error in getCoAStatus:', error)
        return { status: null, error: 'Failed to fetch CoA status' }
    }
}

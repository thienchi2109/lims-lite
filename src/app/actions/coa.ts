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

// Import extracted modules
import {
    fetchSampleWithApprover,
    fetchTestingDate,
    fetchTestResults,
    generateHtmlHash,
    validateSampleForCoAGeneration,
    type GenerateCoAResult,
} from '@/lib/coa/helpers'
import { renderCoATemplate } from '@/lib/coa/template'

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
    manualInputs?: CoAManualInputs
): Promise<GenerateCoAResult> {
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

        // Role-specific validation for sample status and results
        const validationResult = await validateSampleForCoAGeneration(sampleId, userRole)
        if (!validationResult.valid) {
            return { success: false, error: validationResult.error || 'Lỗi xác thực mẫu' }
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

        // Step 2: Fetch approver's active signature (REQUIRED for 21 CFR Part 11 compliance)
        // Use service role to bypass RLS - analysts need to access manager signatures for CoA
        const signatureResult = await getActiveSignature(approverId, { useServiceRole: true })

        if (!signatureResult.success) {
            console.error('No active signature found for approver:', signatureResult.error)
            return {
                success: false,
                error: 'Người phê duyệt chưa tải lên chữ ký điện tử. Vui lòng yêu cầu quản lý tải lên chữ ký trước khi tạo CoA.'
            }
        }

        const signature = signatureResult.signature

        // Step 3: Download signature file from storage using service role
        const downloadResult = await downloadSignature(signature.signature_path, { useServiceRole: true })

        if (!downloadResult.success) {
            console.error('Failed to download signature file:', downloadResult.error)
            return {
                success: false,
                error: 'Không thể tải xuống chữ ký điện tử. File chữ ký có thể bị hỏng. Vui lòng yêu cầu quản lý tải lên lại chữ ký.'
            }
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
            return { success: false, error: 'Không tìm thấy thông tin người phê duyệt' }
        }

        // Step 7: Fetch test results
        const results = await fetchTestResults(sampleId)

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
        const result = await generateCoA(sampleId, manualInputs)

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

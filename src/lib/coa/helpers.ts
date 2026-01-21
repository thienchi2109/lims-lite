/**
 * CoA Helper Functions
 *
 * Data fetching and utility functions for Certificate of Analysis generation.
 * Extracted from src/app/actions/coa.ts for better maintainability.
 */

import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import type { SampleData, UserRole, LatestSubmission, Gender } from '@/types'
import { getActiveSignature, downloadSignature } from '@/app/actions/signatures'

// ============================================================================
// TYPES
// ============================================================================

export interface TestResult {
    assay_name: string
    value: string | null
    unit: string | null
    normal_range: string | null
    method_name: string | null
    lab_specialty_name: string | null
}

export type GenerateCoAResult =
    | { success: true; coaId: string; filePath: string }
    | { success: false; error: string }

export type ValidationResult = {
    valid: boolean
    error?: string
}

/**
 * Query result type for Supabase join
 * Properly typed to avoid `any` casts
 * Note: Supabase returns arrays for joined relations even with maybeSingle()
 */
interface SubmissionQueryResult {
    id: string
    user_id: string
    signature_id: string
    submitted_at: string
    submission_number: number
    signature_meaning: string
    user: { full_name: string }[] | null
    signature: { signature_hash: string }[] | null
}

/**
 * Result type for signature data URI fetch
 */
interface SignatureDataResult {
    dataUri: string
    signatureId: string
    signatureHash: string
}

/**
 * Client data from Supabase join query
 * Used for type-safe access instead of `as any`
 */
interface ClientQueryData {
    name: string | null
    date_of_birth: string | null
    gender: Gender | null
    address: string | null
    health_insurance_num: string | null
}

/**
 * Sample query result with client join
 */
interface SampleWithClientQueryResult {
    id: string
    sample_id: string
    type: string
    received_at: string
    status: string
    clients: ClientQueryData | ClientQueryData[] | null
}

/**
 * Result row from test results query with assay definitions join
 * Note: Supabase returns arrays for joined relations
 */
interface TestResultQueryRow {
    value: string | null
    assay_definitions: {
        name: string | null
        units: string | null
        validation_rules: Record<string, unknown> | null
        lab_specialties: {
            name: string | null
            display_order: number | null
        }[] | null
    }[] | null
    methods: {
        name: string | null
    }[] | null
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate sample is eligible for CoA generation based on user role
 *
 * Role-specific validation rules:
 * - Analyst: sample.status must be 'completed' AND all results must be 'approved'
 * - Manager: sample.status can be 'review' or 'completed', needs at least one 'approved' result
 *
 * @param sampleId - The sample ID to validate
 * @param userRole - The role of the user attempting generation
 * @returns ValidationResult with valid flag and Vietnamese error message if invalid
 */
export async function validateSampleForCoAGeneration(
    sampleId: string,
    userRole: UserRole
): Promise<ValidationResult> {
    const supabase = await createClient()

    // 1. Fetch sample with status
    const { data: sample, error: sampleError } = await supabase
        .from('samples')
        .select('id, status')
        .eq('id', sampleId)
        .is('deleted_at', null)
        .single()

    if (sampleError || !sample) {
        return { valid: false, error: 'Không tìm thấy thông tin mẫu' }
    }

    // 2. Role-specific status validation
    if (userRole === 'analyst') {
        // Analysts can only generate CoA for completed samples
        if (sample.status !== 'completed') {
            return {
                valid: false,
                error: 'Chỉ có thể tạo CoA cho mẫu đã hoàn thành (completed)'
            }
        }
    } else {
        // Managers can generate for review or completed samples
        if (sample.status !== 'review' && sample.status !== 'completed') {
            return {
                valid: false,
                error: 'Chỉ có thể tạo CoA cho mẫu ở trạng thái xem xét hoặc hoàn thành'
            }
        }
    }

    // 3. Fetch all results for sample
    const { data: results, error: resultsError } = await supabase
        .from('results')
        .select('id, status')
        .eq('sample_id', sampleId)

    if (resultsError) {
        return { valid: false, error: 'Lỗi khi kiểm tra kết quả xét nghiệm' }
    }

    if (!results || results.length === 0) {
        return { valid: false, error: 'Không có kết quả xét nghiệm cho mẫu này' }
    }

    // 4. Role-specific results approval validation
    const approvedResults = results.filter(r => r.status === 'approved')
    const unapprovedCount = results.length - approvedResults.length

    if (userRole === 'analyst') {
        // Analysts require ALL results to be approved
        if (unapprovedCount > 0) {
            return {
                valid: false,
                error: `Không thể tạo CoA: ${unapprovedCount} kết quả chưa được phê duyệt`
            }
        }
    } else {
        // Managers require at least one approved result
        if (approvedResults.length === 0) {
            return {
                valid: false,
                error: 'Cần ít nhất một kết quả đã được phê duyệt để tạo CoA'
            }
        }
    }

    return { valid: true }
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

/**
 * Fetch the latest (non-superseded) submission for a sample
 * Used for CoA generation to get performer signature
 */
export async function fetchLatestSubmission(
    sampleId: string
): Promise<LatestSubmission | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('sample_submissions')
        .select(`
            id,
            user_id,
            signature_id,
            submitted_at,
            submission_number,
            signature_meaning,
            user:users!sample_submissions_user_id_fkey(full_name),
            signature:user_signatures!sample_submissions_signature_id_fkey(signature_hash)
        `)
        .eq('sample_id', sampleId)
        .is('superseded_by', null)
        .order('submission_number', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error || !data) return null

    // Type-safe access - Supabase returns arrays for joined relations
    const result = data as SubmissionQueryResult

    return {
        submissionId: result.id,
        performerId: result.user_id,
        performerName: result.user?.[0]?.full_name ?? null,
        signatureId: result.signature_id,
        signatureHash: result.signature?.[0]?.signature_hash ?? '',
        submittedAt: result.submitted_at,
        submissionNumber: result.submission_number,
        signatureMeaning: result.signature_meaning,
    }
}

/**
 * Fetch sample data with approver information
 */
export async function fetchSampleWithApprover(sampleId: string): Promise<SampleData | null> {
    const supabase = await createClient()

    // Fetch sample with client info including demographic fields
    const { data: sample, error: sampleError } = await supabase
        .from('samples')
        .select(`
            id,
            sample_id,
            type,
            received_at,
            status,
            clients!inner (
                name,
                date_of_birth,
                gender,
                address,
                health_insurance_num
            )
        `)
        .eq('id', sampleId)
        .is('deleted_at', null)
        .single()

    if (sampleError || !sample) {
        console.error('Fetch sample error:', sampleError)
        return null
    }

    // Type-safe access: Supabase may return single object or array for joins
    const typedSample = sample as SampleWithClientQueryResult
    const client: ClientQueryData | null = Array.isArray(typedSample.clients)
        ? typedSample.clients[0] ?? null
        : typedSample.clients

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
        id: typedSample.id,
        sample_id_display: typedSample.sample_id,
        approved_by: approvedResult.approved_by,
        approved_at: approvedResult.approved_at,
        client_name: client?.name ?? undefined,
        sample_type: typedSample.type,
        received_date: typedSample.received_at,
        // Client demographic fields for CoA template
        client_dob: client?.date_of_birth ?? undefined,
        client_gender: client?.gender ?? undefined,
        client_address: client?.address ?? undefined,
        client_health_insurance_num: client?.health_insurance_num ?? undefined,
    }
}

/**
 * Fetch testing date from audit logs
 * Returns the date when sample first moved to 'in_progress' status
 * Falls back to received_at if no audit log exists
 */
export async function fetchTestingDate(sampleId: string): Promise<string | null> {
    const supabase = await createClient()

    // Query audit_logs for first transition to in_progress
    const { data: auditLog, error } = await supabase
        .from('audit_logs')
        .select('changed_at')
        .eq('table_name', 'samples')
        .eq('record_id', sampleId)
        .eq('operation', 'UPDATE')
        .filter('new_values->>status', 'eq', 'in_progress')
        .order('changed_at', { ascending: true })
        .limit(1)
        .maybeSingle()

    if (error) {
        console.error('Fetch testing date error:', error)
        return null
    }

    if (auditLog) {
        return auditLog.changed_at
    }

    // Fallback: use received_at from samples table
    const { data: sample, error: sampleError } = await supabase
        .from('samples')
        .select('received_at')
        .eq('id', sampleId)
        .single()

    if (sampleError || !sample) {
        console.error('Fetch sample for testing date fallback error:', sampleError)
        return null
    }

    return sample.received_at
}

/**
 * Fetch approved test results for CoA
 */
export async function fetchTestResults(sampleId: string): Promise<TestResult[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('results')
        .select(`
            value,
            assay_definitions!inner (
                name,
                units,
                validation_rules,
                lab_specialties (
                    name,
                    display_order
                )
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

    // Type-safe cast with defined interface
    const typedData = data as TestResultQueryRow[]

    // Sort by lab specialty order, then assay name
    const sorted = typedData.sort((a, b) => {
        const assayA = a.assay_definitions?.[0]
        const assayB = b.assay_definitions?.[0]
        const orderA = assayA?.lab_specialties?.[0]?.display_order ?? 9999
        const orderB = assayB?.lab_specialties?.[0]?.display_order ?? 9999

        if (orderA !== orderB) return orderA - orderB

        const nameA = assayA?.name ?? ''
        const nameB = assayB?.name ?? ''
        return nameA.localeCompare(nameB)
    })

    return sorted.map((row) => {
        const assay = row.assay_definitions?.[0]
        // Extract normal_range from validation_rules if it exists
        const validationRules = assay?.validation_rules ?? {}
        const normalRange = (validationRules as Record<string, string>).normal_range ?? null

        return {
            assay_name: assay?.name ?? 'N/A',
            value: row.value,
            unit: assay?.units ?? null,
            normal_range: normalRange,
            method_name: row.methods?.[0]?.name ?? null,
            lab_specialty_name: assay?.lab_specialties?.[0]?.name ?? null
        }
    })
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Fetch and download a user's signature as base64 data URI
 * Consolidates duplicate signature download logic
 *
 * @param userId - User whose signature to fetch
 * @param expectedHash - Optional hash for integrity verification
 */
export async function fetchSignatureDataUri(
    userId: string,
    expectedHash?: string
): Promise<SignatureDataResult | null> {
    const sigResult = await getActiveSignature(userId, { useServiceRole: true })
    if (!sigResult.success || !sigResult.signature) return null

    const signature = sigResult.signature

    // Hash verification (if expected hash provided)
    if (expectedHash && signature.signature_hash !== expectedHash) {
        console.error('Signature hash mismatch - possible tampering detected', {
            userId,
            expected: expectedHash,
            actual: signature.signature_hash,
        })
        return null
    }

    const downloadResult = await downloadSignature(signature.signature_path, { useServiceRole: true })
    if (!downloadResult.success || !downloadResult.dataUri) return null

    return {
        dataUri: downloadResult.dataUri,
        signatureId: signature.id,
        signatureHash: signature.signature_hash,
    }
}

/**
 * Verify signature hash integrity
 */
export async function verifySignatureHash(
    signatureBuffer: ArrayBuffer,
    expectedHash: string
): Promise<boolean> {
    const hash = createHash('sha256')
    hash.update(Buffer.from(signatureBuffer))
    const computedHash = hash.digest('hex')
    return computedHash === expectedHash
}

/**
 * Generate file hash for integrity verification
 */
export function generateHtmlHash(html: string): string {
    const hash = createHash('sha256')
    hash.update(html, 'utf8')
    return hash.digest('hex')
}

/**
 * CoA Helper Functions
 *
 * Data fetching and utility functions for Certificate of Analysis generation.
 * Extracted from src/app/actions/coa.ts for better maintainability.
 */

import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import type { SampleData } from '@/types'

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

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

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
        received_date: sample.received_at,
        // Client demographic fields for CoA template
        client_dob: (sample.clients as any)?.date_of_birth || null,
        client_gender: (sample.clients as any)?.gender || null,
        client_address: (sample.clients as any)?.address || null,
        client_health_insurance_num: (sample.clients as any)?.health_insurance_num || null,
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

    // Sort by lab specialty order, then assay name
    const sorted = data.sort((a: any, b: any) => {
        const orderA = a.assay_definitions?.lab_specialties?.display_order ?? 9999
        const orderB = b.assay_definitions?.lab_specialties?.display_order ?? 9999

        if (orderA !== orderB) return orderA - orderB

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
            method_name: row.methods?.name || null,
            lab_specialty_name: row.assay_definitions?.lab_specialties?.name || null
        }
    })
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

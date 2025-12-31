'use server'

/**
 * QC Violations & Approval Integration
 * Functions: resolveViolation, checkQCSessionStatus, getPendingViolations
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireRole, isAuthError } from '@/lib/auth-helpers'
import { ResolveViolationSchema, type ResolveViolation, type QCStatus } from '@/types/qc'

// ============================================================================
// VIOLATION RESOLUTION
// ============================================================================

/**
 * Resolves a QC violation with corrective action
 * Manager only - required before patient results can be approved
 */
export async function resolveViolation(data: ResolveViolation) {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return auth

        const supabase = await createClient()
        const validated = ResolveViolationSchema.parse(data)

        // Update the violation
        const { data: violation, error } = await supabase
            .from('qc_violations')
            .update({
                corrective_action: validated.corrective_action,
                resolved_at: new Date().toISOString(),
                resolved_by: auth.id,
            })
            .eq('id', validated.violation_id)
            .is('resolved_at', null)
            .select('session_id')
            .single()

        if (error) {
            console.error('Error resolving violation:', error)
            return { error: error.message }
        }

        // Check if all violations in session are resolved
        const { count } = await supabase
            .from('qc_violations')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', violation.session_id)
            .is('resolved_at', null)

        // If all resolved, update session status
        if (count === 0) {
            await supabase
                .from('qc_sessions')
                .update({ qc_status: 'resolved' as QCStatus })
                .eq('id', violation.session_id)
        }

        revalidatePath('/manager/quality-control')
        revalidatePath('/manager/approvals')
        return { success: true }
    } catch (error) {
        console.error('Error in resolveViolation:', error)
        return { error: error instanceof Error ? error.message : 'Không thể xử lý vi phạm' }
    }
}

/**
 * Gets pending (unresolved) violations
 * Manager only
 */
export async function getPendingViolations() {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return auth

        const supabase = await createClient()

        const { data, error } = await supabase
            .from('qc_violations')
            .select(`
                *,
                result:qc_results(value, z_score, measured_at),
                session:qc_sessions(
                    assay:assay_definitions(name)
                )
            `)
            .is('resolved_at', null)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching pending violations:', error)
            return { error: error.message }
        }

        return { data }
    } catch (error) {
        console.error('Error in getPendingViolations:', error)
        return { error: error instanceof Error ? error.message : 'Không thể tải vi phạm' }
    }
}

// ============================================================================
// APPROVAL INTEGRATION
// ============================================================================

/**
 * Checks if patient results can be approved based on QC session status
 * Used before approving results to enforce QC blocking
 *
 * @param resultIds - Array of result IDs to check
 * @returns Object with can_approve boolean and blocking details
 */
export async function checkQCSessionStatus(resultIds: string[]) {
    try {
        const supabase = await createClient()

        // Get results with their QC session info
        const { data: results, error } = await supabase
            .from('results')
            .select(`
                id,
                qc_session_id,
                qc_session:qc_sessions(id, qc_status, assay:assay_definitions(name))
            `)
            .in('id', resultIds)

        if (error) {
            console.error('Error checking QC status:', error)
            return { error: error.message }
        }

        // Check for blocked sessions
        type SessionInfo = { qc_status: QCStatus; assay: { name: string } } | null
        const blockedResults = results?.filter(r => {
            // NULL qc_session_id = pre-QC era, allow approval
            if (!r.qc_session_id) return false
            // Check if session is blocked (qc_session is object from join)
            const session = r.qc_session as unknown as SessionInfo
            return session?.qc_status === 'blocked'
        }) || []

        if (blockedResults.length > 0) {
            const blockedAssays = blockedResults
                .map(r => {
                    const session = r.qc_session as unknown as SessionInfo
                    return session?.assay?.name
                })
                .filter(Boolean)
                .join(', ')

            return {
                can_approve: false,
                blocked_reason: `QC bị chặn cho: ${blockedAssays}. Giải quyết vi phạm trước khi phê duyệt.`,
                blocked_count: blockedResults.length,
            }
        }

        return {
            can_approve: true,
            blocked_reason: null,
            blocked_count: 0,
        }
    } catch (error) {
        console.error('Error in checkQCSessionStatus:', error)
        return { error: error instanceof Error ? error.message : 'Không thể kiểm tra trạng thái QC' }
    }
}

/**
 * Gets QC sessions list with filtering
 */
export async function getQCSessions(params?: {
    assayId?: string
    status?: QCStatus
    limit?: number
}) {
    try {
        const supabase = await createClient()
        const { assayId, status, limit = 50 } = params || {}

        let query = supabase
            .from('qc_sessions')
            .select(`
                *,
                assay:assay_definitions(id, name),
                started_by_user:users!qc_sessions_started_by_fkey(full_name),
                ended_by_user:users!qc_sessions_ended_by_fkey(full_name)
            `)
            .order('started_at', { ascending: false })
            .limit(limit)

        if (assayId) query = query.eq('assay_id', assayId)
        if (status) query = query.eq('qc_status', status)

        const { data, error } = await query

        if (error) {
            console.error('Error fetching QC sessions:', error)
            return { error: error.message }
        }

        return { data }
    } catch (error) {
        console.error('Error in getQCSessions:', error)
        return { error: error instanceof Error ? error.message : 'Không thể tải phiên QC' }
    }
}

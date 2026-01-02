'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// ============================================================================
// TYPES
// ============================================================================

export type AssayQCStatusValue = 'pass' | 'warning' | 'blocked' | 'pending' | 'no_session'

export interface AssayQCStatus {
    assay_id: string
    status: AssayQCStatusValue
    last_qc_at: string | null
    session_id: string | null
    message: string
}

// ============================================================================
// VALIDATION
// ============================================================================

const getQCStatusSchema = z.object({
    assayIds: z.array(z.string().uuid()).min(1).max(100),
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface QCSessionRow {
    id: string
    assay_id: string
    qc_status: string
    started_at: string
    ended_at: string | null
}

function determineQCStatus(session: QCSessionRow | null): AssayQCStatusValue {
    if (!session) return 'no_session'
    if (session.ended_at) return 'no_session'

    switch (session.qc_status) {
        case 'pass':
        case 'resolved':
            return 'pass'
        case 'warning':
            return 'warning'
        case 'blocked':
            return 'blocked'
        case 'pending':
            return 'pending'
        default:
            return 'no_session'
    }
}

function getStatusMessage(status: AssayQCStatusValue): string {
    switch (status) {
        case 'pass':
            return 'QC đạt'
        case 'warning':
            return 'QC có cảnh báo'
        case 'blocked':
            return 'QC thất bại - cần hành động'
        case 'pending':
            return 'Chưa nhập QC'
        case 'no_session':
            return 'Chưa có phiên QC'
    }
}

// ============================================================================
// SERVER ACTION
// ============================================================================

/**
 * Get QC status for multiple assays.
 * Returns the active QC session status for each assay.
 *
 * @param assayIds - Array of assay UUIDs to check QC status for
 * @returns Map of assay_id -> QC status info
 */
export async function getQCStatusForAssays(
    assayIds: string[]
): Promise<Record<string, AssayQCStatus> | { error: string }> {
    try {
        const validated = getQCStatusSchema.parse({ assayIds })
        const supabase = await createClient()

        // Get active (non-ended) QC sessions for the given assays
        const { data: sessions, error } = await supabase
            .from('qc_sessions')
            .select('id, assay_id, qc_status, started_at, ended_at')
            .in('assay_id', validated.assayIds)
            .is('ended_at', null)
            .order('started_at', { ascending: false })

        if (error) {
            console.error('Error fetching QC sessions:', error)
            return { error: error.message }
        }

        // Build result map - use first (most recent) session per assay
        const result: Record<string, AssayQCStatus> = {}
        const seenAssays = new Set<string>()

        for (const session of sessions || []) {
            if (!seenAssays.has(session.assay_id)) {
                seenAssays.add(session.assay_id)
                const status = determineQCStatus(session)
                result[session.assay_id] = {
                    assay_id: session.assay_id,
                    status,
                    last_qc_at: session.started_at,
                    session_id: session.id,
                    message: getStatusMessage(status),
                }
            }
        }

        // Add no_session status for assays without active sessions
        for (const assayId of validated.assayIds) {
            if (!result[assayId]) {
                result[assayId] = {
                    assay_id: assayId,
                    status: 'no_session',
                    last_qc_at: null,
                    session_id: null,
                    message: getStatusMessage('no_session'),
                }
            }
        }

        return result
    } catch (err) {
        if (err instanceof z.ZodError) {
            return { error: 'Invalid assay IDs provided' }
        }
        console.error('Error in getQCStatusForAssays:', err)
        return { error: 'An unexpected error occurred' }
    }
}

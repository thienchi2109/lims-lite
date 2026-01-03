'use server'

/**
 * QC Bulk Operations - Start/end multiple sessions at once
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireRole, isAuthError } from '@/lib/auth-helpers'
import { z } from 'zod'
import type { QCStatus, QCSessionMode } from '@/types/qc'

// ============================================================================
// SCHEMAS
// ============================================================================

const BulkStartSessionsSchema = z.object({
    assay_ids: z.array(z.string().uuid()).min(1, 'Chọn ít nhất một xét nghiệm'),
    session_mode: z.enum(['daily', 'batch', 'shift']),
    notes: z.string().optional(),
})

const BulkEndSessionsSchema = z.object({
    session_ids: z.array(z.string().uuid()).min(1, 'Chọn ít nhất một phiên'),
    notes: z.string().optional(),
})

// ============================================================================
// BULK START SESSIONS
// ============================================================================

export interface BulkStartResult {
    success: { assay_id: string; session_id: string; assay_name?: string }[]
    failed: { assay_id: string; error: string; assay_name?: string }[]
}

/**
 * Starts QC sessions for multiple assays at once
 * Manager only
 */
export async function bulkStartQCSessions(data: {
    assay_ids: string[]
    session_mode: QCSessionMode
    notes?: string
}): Promise<{ data?: BulkStartResult; error?: string }> {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return auth

        const validated = BulkStartSessionsSchema.parse(data)
        const supabase = await createClient()

        // Get assay names for better feedback
        const { data: assays } = await supabase
            .from('assay_definitions')
            .select('id, name')
            .in('id', validated.assay_ids)

        const assayMap = new Map(assays?.map(a => [a.id, a.name]) || [])

        // Check which assays already have active sessions
        const { data: existingSessions } = await supabase
            .from('qc_sessions')
            .select('assay_id')
            .in('assay_id', validated.assay_ids)
            .is('ended_at', null)

        const activeAssayIds = new Set(existingSessions?.map(s => s.assay_id) || [])

        const result: BulkStartResult = { success: [], failed: [] }

        // Process each assay
        for (const assayId of validated.assay_ids) {
            const assayName = assayMap.get(assayId)

            if (activeAssayIds.has(assayId)) {
                result.failed.push({
                    assay_id: assayId,
                    assay_name: assayName,
                    error: 'Đã có phiên đang hoạt động',
                })
                continue
            }

            const { data: session, error } = await supabase
                .from('qc_sessions')
                .insert({
                    assay_id: assayId,
                    session_mode: validated.session_mode,
                    qc_status: 'pending' as QCStatus,
                    started_by: auth.id,
                    notes: validated.notes || null,
                })
                .select('id')
                .single()

            if (error) {
                result.failed.push({
                    assay_id: assayId,
                    assay_name: assayName,
                    error: error.message,
                })
            } else {
                result.success.push({
                    assay_id: assayId,
                    session_id: session.id,
                    assay_name: assayName,
                })
            }
        }

        revalidatePath('/analyst/qc-entry')
        revalidatePath('/manager/quality-control')

        return { data: result }
    } catch (error) {
        console.error('Error in bulkStartQCSessions:', error)
        return { error: error instanceof Error ? error.message : 'Không thể bắt đầu các phiên QC' }
    }
}

// ============================================================================
// BULK END SESSIONS
// ============================================================================

export interface BulkEndResult {
    success: { session_id: string }[]
    failed: { session_id: string; error: string }[]
}

/**
 * Ends multiple QC sessions at once
 * Manager only
 */
export async function bulkEndQCSessions(data: {
    session_ids: string[]
    notes?: string
}): Promise<{ data?: BulkEndResult; error?: string }> {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return auth

        const validated = BulkEndSessionsSchema.parse(data)
        const supabase = await createClient()

        const result: BulkEndResult = { success: [], failed: [] }
        const endedAt = new Date().toISOString()

        // Process each session
        for (const sessionId of validated.session_ids) {
            const { error } = await supabase
                .from('qc_sessions')
                .update({
                    ended_at: endedAt,
                    ended_by: auth.id,
                    notes: validated.notes || null,
                })
                .eq('id', sessionId)
                .is('ended_at', null) // Only end if still active

            if (error) {
                result.failed.push({
                    session_id: sessionId,
                    error: error.message,
                })
            } else {
                result.success.push({ session_id: sessionId })
            }
        }

        revalidatePath('/analyst/qc-entry')
        revalidatePath('/manager/quality-control')

        return { data: result }
    } catch (error) {
        console.error('Error in bulkEndQCSessions:', error)
        return { error: error instanceof Error ? error.message : 'Không thể kết thúc các phiên QC' }
    }
}

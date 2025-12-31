'use server'

/**
 * QC Sessions & Results - Daily QC operations
 * Functions: startQCSession, endQCSession, enterQCResult, getActiveSession
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireAuth, requireRole, isAuthError } from '@/lib/auth-helpers'
import {
    CreateQCSessionSchema,
    CreateQCResultSchema,
    type CreateQCSession,
    type CreateQCResult,
    type QCStatus,
} from '@/types/qc'
import { evaluateWestgardRules } from '@/lib/qc/westgard-rules'

// ============================================================================
// QC SESSIONS
// ============================================================================

/**
 * Starts a new QC session for an assay
 * Manager only
 */
export async function startQCSession(data: CreateQCSession) {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return auth

        const supabase = await createClient()
        const validated = CreateQCSessionSchema.parse(data)

        // Check if there's already an active session
        const { data: existing } = await supabase
            .from('qc_sessions')
            .select('id')
            .eq('assay_id', validated.assay_id)
            .is('ended_at', null)
            .single()

        if (existing) {
            return { error: 'Đã có phiên QC đang hoạt động cho xét nghiệm này' }
        }

        const { data: session, error } = await supabase
            .from('qc_sessions')
            .insert({
                assay_id: validated.assay_id,
                session_mode: validated.session_mode,
                qc_status: 'pending' as QCStatus,
                started_by: auth.id,
                notes: validated.notes || null,
            })
            .select()
            .single()

        if (error) {
            console.error('Error starting QC session:', error)
            return { error: error.message }
        }

        revalidatePath('/analyst/qc-entry')
        revalidatePath('/manager/quality-control')
        return { data: session }
    } catch (error) {
        console.error('Error in startQCSession:', error)
        return { error: error instanceof Error ? error.message : 'Không thể bắt đầu phiên QC' }
    }
}

/**
 * Ends an active QC session
 * Manager only
 */
export async function endQCSession(sessionId: string, notes?: string) {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return auth

        const supabase = await createClient()

        const { data: session, error } = await supabase
            .from('qc_sessions')
            .update({
                ended_at: new Date().toISOString(),
                ended_by: auth.id,
                notes: notes || null,
            })
            .eq('id', sessionId)
            .is('ended_at', null)
            .select()
            .single()

        if (error) {
            console.error('Error ending QC session:', error)
            return { error: error.message }
        }

        revalidatePath('/analyst/qc-entry')
        revalidatePath('/manager/quality-control')
        return { data: session }
    } catch (error) {
        console.error('Error in endQCSession:', error)
        return { error: error instanceof Error ? error.message : 'Không thể kết thúc phiên QC' }
    }
}

/**
 * Gets active QC session for an assay
 */
export async function getActiveSession(assayId: string) {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('qc_sessions')
            .select(`
                *,
                assay:assay_definitions(id, name),
                started_by_user:users!qc_sessions_started_by_fkey(full_name)
            `)
            .eq('assay_id', assayId)
            .is('ended_at', null)
            .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
            console.error('Error fetching active session:', error)
            return { error: error.message }
        }

        return { data: data || null }
    } catch (error) {
        console.error('Error in getActiveSession:', error)
        return { error: error instanceof Error ? error.message : 'Không thể tải phiên QC' }
    }
}

// ============================================================================
// QC RESULTS
// ============================================================================

/**
 * Enters a QC result with automatic rule evaluation
 * Analyst or Manager
 */
export async function enterQCResult(data: CreateQCResult) {
    try {
        const auth = await requireAuth()
        if (isAuthError(auth)) return auth

        const supabase = await createClient()
        const validated = CreateQCResultSchema.parse(data)

        // Get the definition for rule evaluation
        const { data: definition, error: defError } = await supabase
            .from('qc_definitions')
            .select('id, mean, sd, assay_id')
            .eq('id', validated.definition_id)
            .single()

        if (defError || !definition) {
            return { error: 'Không tìm thấy định nghĩa QC' }
        }

        // Get history for trend rules
        const { data: history } = await supabase
            .from('qc_results')
            .select('z_score')
            .eq('definition_id', validated.definition_id)
            .order('measured_at', { ascending: false })
            .limit(10)

        const historyZScores = (history || [])
            .map(h => h.z_score)
            .filter((z): z is number => z !== null)

        // Evaluate Westgard rules
        const evaluation = evaluateWestgardRules({
            value: validated.value,
            mean: definition.mean,
            sd: definition.sd,
            history: historyZScores,
        })

        // Insert the result (z_score calculated by trigger)
        const { data: result, error: insertError } = await supabase
            .from('qc_results')
            .insert({
                session_id: validated.session_id,
                definition_id: validated.definition_id,
                value: validated.value,
                status: evaluation.status,
                measured_at: validated.measured_at || new Date().toISOString(),
                entered_by: auth.id,
                notes: validated.notes || null,
            })
            .select()
            .single()

        if (insertError) {
            console.error('Error inserting QC result:', insertError)
            return { error: insertError.message }
        }

        // If rejection rule triggered, create violation and update session
        if (evaluation.status === 'reject') {
            const rejectionRules = evaluation.triggeredRules.filter(r => !r.isWarning)

            for (const rule of rejectionRules) {
                await supabase.from('qc_violations').insert({
                    result_id: result.id,
                    session_id: validated.session_id,
                    rule_violated: rule.rule,
                    z_score_at_violation: evaluation.zScore,
                })
            }

            // Update session status to blocked
            await supabase
                .from('qc_sessions')
                .update({ qc_status: 'blocked' as QCStatus })
                .eq('id', validated.session_id)
        } else if (evaluation.status === 'warning') {
            // Update to warning if not already blocked
            await supabase
                .from('qc_sessions')
                .update({ qc_status: 'warning' as QCStatus })
                .eq('id', validated.session_id)
                .neq('qc_status', 'blocked')
        } else {
            // Update to pass if currently pending
            await supabase
                .from('qc_sessions')
                .update({ qc_status: 'pass' as QCStatus })
                .eq('id', validated.session_id)
                .eq('qc_status', 'pending')
        }

        revalidatePath('/analyst/qc-entry')
        revalidatePath('/manager/quality-control')

        return {
            data: result,
            evaluation,
        }
    } catch (error) {
        console.error('Error in enterQCResult:', error)
        return { error: error instanceof Error ? error.message : 'Không thể nhập kết quả QC' }
    }
}

/**
 * Gets QC history for Levey-Jennings chart
 */
export async function getQCHistory(definitionId: string, days: number = 30) {
    try {
        const supabase = await createClient()
        const fromDate = new Date()
        fromDate.setDate(fromDate.getDate() - days)

        const { data, error } = await supabase
            .from('qc_results')
            .select(`
                id, value, z_score, status, measured_at,
                definition:qc_definitions(mean, sd, material:qc_materials(level))
            `)
            .eq('definition_id', definitionId)
            .gte('measured_at', fromDate.toISOString())
            .order('measured_at', { ascending: true })

        if (error) {
            console.error('Error fetching QC history:', error)
            return { error: error.message }
        }

        return { data }
    } catch (error) {
        console.error('Error in getQCHistory:', error)
        return { error: error instanceof Error ? error.message : 'Không thể tải lịch sử QC' }
    }
}

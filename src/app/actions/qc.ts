'use server'

/**
 * QC Operations - Quality Control result entry and validation
 * Functions: saveQCResult
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireAuth, isAuthError } from '@/lib/auth-helpers'
import { z } from 'zod'

// ============================================================================
// SCHEMAS
// ============================================================================

const SaveQCResultSchema = z.object({
    definitionId: z.string().uuid('ID định nghĩa QC không hợp lệ'),
    value: z.number({ message: 'Giá trị đo là bắt buộc' }),
    notes: z.string().optional(),
})

type SaveQCResultInput = z.infer<typeof SaveQCResultSchema>

// ============================================================================
// WESTGARD RULE EVALUATION
// ============================================================================

/**
 * Evaluate Westgard rules and determine QC result status
 * Based on Z-score and historical data
 */
async function evaluateWestgardRules(
    definitionId: string,
    value: number,
    mean: number,
    sd: number,
    supabase: Awaited<ReturnType<typeof createClient>>
): Promise<'pass' | 'warning' | 'reject'> {
    // Calculate Z-score
    const zScore = (value - mean) / sd

    // Rule 1-3s: Single measurement outside ±3 SD → REJECT
    if (Math.abs(zScore) > 3) {
        return 'reject'
    }

    // Rule 1-2s: Single measurement outside ±2 SD → WARNING (but allow to continue)
    if (Math.abs(zScore) > 2) {
        return 'warning'
    }

    // Get last 9 results for multi-rule evaluation (need 10 total including current)
    const { data: recentResults } = await supabase
        .from('qc_results')
        .select('z_score, value')
        .eq('definition_id', definitionId)
        .order('measured_at', { ascending: false })
        .limit(9)

    if (!recentResults || recentResults.length < 9) {
        // Not enough data for multi-rule checks, only use 1-2s and 1-3s
        return 'pass'
    }

    // Prepend current Z-score to historical data
    const allZScores = [zScore, ...recentResults.map((r) => r.z_score).filter((z): z is number => z !== null)]

    // Rule 2-2s: Two consecutive measurements outside same ±2 SD → REJECT
    if (allZScores.length >= 2) {
        if ((allZScores[0] > 2 && allZScores[1] > 2) || (allZScores[0] < -2 && allZScores[1] < -2)) {
            return 'reject'
        }
    }

    // Rule R-4s: Range between two consecutive measurements exceeds 4 SD → REJECT
    if (allZScores.length >= 2) {
        const range = Math.abs(allZScores[0] - allZScores[1])
        if (range > 4) {
            return 'reject'
        }
    }

    // Rule 4-1s: Four consecutive measurements on same side of mean outside ±1 SD → WARNING
    if (allZScores.length >= 4) {
        const lastFour = allZScores.slice(0, 4)
        const allPositive = lastFour.every((z) => z > 1)
        const allNegative = lastFour.every((z) => z < -1)
        if (allPositive || allNegative) {
            return 'warning'
        }
    }

    // Rule 10-x: Ten consecutive measurements on same side of mean → WARNING
    if (allZScores.length >= 10) {
        const lastTen = allZScores.slice(0, 10)
        const allPositive = lastTen.every((z) => z > 0)
        const allNegative = lastTen.every((z) => z < 0)
        if (allPositive || allNegative) {
            return 'warning'
        }
    }

    return 'pass'
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Save a QC result with automatic Westgard rule evaluation
 *
 * @param data - QC result input data
 * @returns Success or error response
 */
export async function saveQCResult(data: SaveQCResultInput) {
    try {
        // 1. Authenticate user (analysts and managers can enter QC results)
        const auth = await requireAuth()
        if (isAuthError(auth)) return auth

        // 2. Validate input
        const validatedData = SaveQCResultSchema.parse(data)

        const supabase = await createClient()

        // 3. Get QC definition (mean, SD) for Westgard evaluation
        const { data: definition, error: defError } = await supabase
            .from('qc_definitions')
            .select('id, mean, sd, assay_id, material_id')
            .eq('id', validatedData.definitionId)
            .eq('is_active', true)
            .single()

        if (defError || !definition) {
            console.error('Error fetching QC definition:', defError)
            return { error: 'Không tìm thấy định nghĩa QC hoặc định nghĩa đã bị vô hiệu hóa' }
        }

        // 4. Evaluate Westgard rules to determine status
        const status = await evaluateWestgardRules(
            validatedData.definitionId,
            validatedData.value,
            definition.mean,
            definition.sd,
            supabase
        )

        // 5. Get active QC session for this assay (if exists)
        const { data: sessionId } = await supabase.rpc('get_active_qc_session', {
            p_assay_id: definition.assay_id,
        })

        // 6. Insert QC result (z_score will be auto-calculated by trigger)
        const { data: result, error: insertError } = await supabase
            .from('qc_results')
            .insert({
                definition_id: validatedData.definitionId,
                session_id: sessionId || null,
                value: validatedData.value,
                status,
                measured_at: new Date().toISOString(),
                entered_by: auth.id,
                notes: validatedData.notes || null,
            })
            .select()
            .single()

        if (insertError) {
            console.error('Error inserting QC result:', insertError)
            return { error: insertError.message }
        }

        // 7. If status is reject/warning, update QC session status accordingly
        if (sessionId && status !== 'pass') {
            const sessionStatus = status === 'reject' ? 'blocked' : 'warning'
            await supabase
                .from('qc_sessions')
                .update({ qc_status: sessionStatus })
                .eq('id', sessionId)
        }

        // 8. Revalidate QC entry page to refresh data
        revalidatePath('/analyst/qc-entry')

        return { success: true, data: result }
    } catch (error) {
        console.error('Error in saveQCResult:', error)
        if (error instanceof z.ZodError) {
            return { error: error.issues.map((issue) => issue.message).join(', ') }
        }
        return { error: error instanceof Error ? error.message : 'Không thể lưu kết quả QC' }
    }
}

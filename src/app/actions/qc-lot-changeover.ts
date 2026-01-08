'use server'

/**
 * QC Lot Changeover - Protocol for changing control material lots
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireRole, isAuthError } from '@/lib/auth-helpers'
import {
    CompleteLotChangeoverSchema,
    type CompleteLotChangeover,
} from '@/types/qc'

/**
 * Gets data for lot changeover protocol
 * Returns current and new lot info with crossover data points
 * Manager only
 */
export async function getLotChangeoverData(materialId: string, newLotNumber?: string) {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return auth

        const supabase = await createClient()

        // Get current material info
        const { data: currentMaterial, error: materialError } = await supabase
            .from('qc_materials')
            .select('*')
            .eq('id', materialId)
            .single()

        if (materialError || !currentMaterial) {
            return { error: 'Không tìm thấy vật liệu QC' }
        }

        // Get active definitions using this material
        const { data: definitions } = await supabase
            .from('qc_definitions')
            .select(`
                *,
                assay:assay_definitions(id, name, units)
            `)
            .eq('material_id', materialId)
            .eq('is_active', true)

        // Get recent QC results for crossover comparison (last 20 points)
        const { data: recentResults } = await supabase
            .from('qc_results')
            .select(`
                id, value, z_score, measured_at,
                definition:qc_definitions!inner(id, mean, sd, material_id)
            `)
            .eq('definition.material_id', materialId)
            .order('measured_at', { ascending: false })
            .limit(20)

        // Calculate statistics from recent results
        const values = recentResults?.map(r => r.value) || []
        const stats = values.length > 0 ? {
            count: values.length,
            mean: values.reduce((a, b) => a + b, 0) / values.length,
            sd: Math.sqrt(
                values.reduce((sum, v) => sum + Math.pow(v - (values.reduce((a, b) => a + b, 0) / values.length), 2), 0)
                / (values.length - 1)
            ),
        } : null

        return {
            data: {
                currentMaterial,
                definitions: definitions || [],
                recentResults: recentResults || [],
                statistics: stats,
                crossoverRequirements: {
                    minDataPoints: 10,
                    recommendation: 'Chạy song song 2 lô trong 10 điểm dữ liệu. So sánh mean mới với mean cũ.'
                }
            }
        }
    } catch (error) {
        console.error('Error in getLotChangeoverData:', error)
        return { error: error instanceof Error ? error.message : 'Không thể tải dữ liệu chuyển lô' }
    }
}

/**
 * Completes a lot changeover - creates new material and transfers control limits
 * Manager only
 *
 * Process:
 * 1. Create new QC material with new lot number
 * 2. For each active definition using old material:
 *    - Deactivate old definition
 *    - Create new definition with new mean and transferred CV%
 * 3. Soft-delete old material (mark as replaced)
 */
export async function completeLotChangeover(data: CompleteLotChangeover) {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return auth

        const supabase = await createClient()
        const validated = CompleteLotChangeoverSchema.parse(data)

        // Calculate new SD from transferred CV%
        const newSD = (validated.transfer_cv_percent / 100) * validated.new_mean

        // 1. Create new QC material
        const { data: newMaterial, error: materialError } = await supabase
            .from('qc_materials')
            .insert({
                name: validated.new_material.name,
                manufacturer: validated.new_material.manufacturer,
                lot_number: validated.new_material.lot_number,
                expiry_date: validated.new_material.expiry_date,
                level: validated.new_material.level,
            })
            .select()
            .single()

        if (materialError || !newMaterial) {
            console.error('Error creating new material:', materialError)
            return { error: materialError?.message || 'Không thể tạo vật liệu mới' }
        }

        // 2. Get active definitions using old material
        const { data: oldDefinitions, error: defError } = await supabase
            .from('qc_definitions')
            .select('*')
            .eq('material_id', validated.old_material_id)
            .eq('is_active', true)

        if (defError) {
            console.error('Error fetching old definitions:', defError)
            return { error: defError.message }
        }

        // 3. For each old definition, deactivate and create new
        const newDefinitions = []
        for (const oldDef of oldDefinitions || []) {
            // Deactivate old definition
            await supabase
                .from('qc_definitions')
                .update({
                    is_active: false,
                    active_until: new Date().toISOString().split('T')[0],
                })
                .eq('id', oldDef.id)

            // Create new definition with transferred CV%
            const { data: newDef, error: newDefError } = await supabase
                .from('qc_definitions')
                .insert({
                    assay_id: oldDef.assay_id,
                    material_id: newMaterial.id,
                    mean: validated.new_mean,
                    sd: newSD,
                    cv_percent: validated.transfer_cv_percent,
                    target_sigma: oldDef.target_sigma,
                    active_from: new Date().toISOString().split('T')[0],
                    is_active: true,
                    established_by: auth.id,
                    established_at: new Date().toISOString(),
                    data_points_count: validated.crossover_data_points,
                    notes: validated.notes || `Chuyển lô từ ${validated.old_material_id}. CV% giữ nguyên.`,
                })
                .select()
                .single()

            if (newDefError) {
                console.error('Error creating new definition:', newDefError)
                // Continue with other definitions
            } else if (newDef) {
                newDefinitions.push(newDef)
            }
        }

        // 4. Soft-delete old material (optional - keep for audit trail)
        // We don't delete it, just mark it as no longer active via definitions

        revalidatePath('/manager/quality-control')
        return {
            data: {
                newMaterial,
                newDefinitions,
                transferredCount: newDefinitions.length,
            }
        }
    } catch (error) {
        console.error('Error in completeLotChangeover:', error)
        return { error: error instanceof Error ? error.message : 'Không thể hoàn thành chuyển lô' }
    }
}

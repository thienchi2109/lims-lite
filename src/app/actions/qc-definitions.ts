'use server'

/**
 * QC Definitions - CRUD operations for control limits
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireRole, isAuthError } from '@/lib/auth-helpers'
import {
    CreateQCDefinitionSchema,
    UpdateQCDefinitionSchema,
    type CreateQCDefinition,
    type UpdateQCDefinition,
} from '@/types/qc'

/**
 * Creates new control limits for an assay+material combination
 * Manager only - requires minimum 20 data points validation
 */
export async function createQCDefinition(data: CreateQCDefinition) {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return auth

        const supabase = await createClient()
        const validated = CreateQCDefinitionSchema.parse(data)

        // Deactivate any existing active definition for this assay+material
        await supabase
            .from('qc_definitions')
            .update({ is_active: false, active_until: new Date().toISOString().split('T')[0] })
            .eq('assay_id', validated.assay_id)
            .eq('material_id', validated.material_id)
            .eq('is_active', true)

        const { data: definition, error } = await supabase
            .from('qc_definitions')
            .insert({
                assay_id: validated.assay_id,
                material_id: validated.material_id,
                mean: validated.mean,
                sd: validated.sd,
                cv_percent: validated.cv_percent || null,
                target_sigma: validated.target_sigma || null,
                active_from: validated.active_from,
                is_active: true,
                established_by: auth.id,
                established_at: new Date().toISOString(),
                data_points_count: validated.data_points_count || null,
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating QC definition:', error)
            return { error: error.message }
        }

        revalidatePath('/manager/quality-control')
        return { data: definition }
    } catch (error) {
        console.error('Error in createQCDefinition:', error)
        return { error: error instanceof Error ? error.message : 'Không thể tạo giới hạn kiểm soát' }
    }
}

/**
 * Updates control limits
 * Manager only
 */
export async function updateQCDefinition(data: UpdateQCDefinition) {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return auth

        const supabase = await createClient()
        const validated = UpdateQCDefinitionSchema.parse(data)
        const { id, ...updateData } = validated

        const { data: definition, error } = await supabase
            .from('qc_definitions')
            .update(updateData)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            console.error('Error updating QC definition:', error)
            return { error: error.message }
        }

        revalidatePath('/manager/quality-control')
        return { data: definition }
    } catch (error) {
        console.error('Error in updateQCDefinition:', error)
        return { error: error instanceof Error ? error.message : 'Không thể cập nhật giới hạn kiểm soát' }
    }
}

/**
 * Gets QC definitions for an assay with material details
 */
export async function getQCDefinitions(assayId?: string) {
    try {
        const supabase = await createClient()

        let query = supabase
            .from('qc_definitions')
            .select(`
                *,
                assay:assay_definitions(id, name, units),
                material:qc_materials(id, name, lot_number, level)
            `)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })

        if (assayId) {
            query = query.eq('assay_id', assayId)
        }

        const { data, error } = await query

        if (error) {
            console.error('Error fetching QC definitions:', error)
            return { error: error.message }
        }

        return { data }
    } catch (error) {
        console.error('Error in getQCDefinitions:', error)
        return { error: error instanceof Error ? error.message : 'Không thể tải giới hạn kiểm soát' }
    }
}

'use server'

/**
 * QC Materials & Definitions - CRUD operations for QC setup
 * Functions: createQCMaterial, updateQCMaterial, createQCDefinition, updateQCDefinition
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireRole, isAuthError } from '@/lib/auth-helpers'
import {
    CreateQCMaterialSchema,
    UpdateQCMaterialSchema,
    CreateQCDefinitionSchema,
    UpdateQCDefinitionSchema,
    type CreateQCMaterial,
    type UpdateQCMaterial,
    type CreateQCDefinition,
    type UpdateQCDefinition,
} from '@/types/qc'

// ============================================================================
// QC MATERIALS
// ============================================================================

/**
 * Creates a new QC material (control material)
 * Manager only
 */
export async function createQCMaterial(data: CreateQCMaterial) {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return auth

        const supabase = await createClient()
        const validated = CreateQCMaterialSchema.parse(data)

        const { data: material, error } = await supabase
            .from('qc_materials')
            .insert({
                name: validated.name,
                manufacturer: validated.manufacturer,
                lot_number: validated.lot_number,
                expiry_date: validated.expiry_date,
                level: validated.level,
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating QC material:', error)
            return { error: error.message }
        }

        revalidatePath('/manager/quality-control')
        return { data: material }
    } catch (error) {
        console.error('Error in createQCMaterial:', error)
        return { error: error instanceof Error ? error.message : 'Không thể tạo vật liệu QC' }
    }
}

/**
 * Updates an existing QC material
 * Manager only
 */
export async function updateQCMaterial(data: UpdateQCMaterial) {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return auth

        const supabase = await createClient()
        const validated = UpdateQCMaterialSchema.parse(data)
        const { id, ...updateData } = validated

        const { data: material, error } = await supabase
            .from('qc_materials')
            .update(updateData)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            console.error('Error updating QC material:', error)
            return { error: error.message }
        }

        revalidatePath('/manager/quality-control')
        return { data: material }
    } catch (error) {
        console.error('Error in updateQCMaterial:', error)
        return { error: error instanceof Error ? error.message : 'Không thể cập nhật vật liệu QC' }
    }
}

/**
 * Soft deletes a QC material
 * Manager only
 */
export async function deleteQCMaterial(id: string) {
    try {
        const auth = await requireRole('manager')
        if (isAuthError(auth)) return auth

        const supabase = await createClient()

        const { error } = await supabase
            .from('qc_materials')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id)

        if (error) {
            console.error('Error deleting QC material:', error)
            return { error: error.message }
        }

        revalidatePath('/manager/quality-control')
        return { success: true }
    } catch (error) {
        console.error('Error in deleteQCMaterial:', error)
        return { error: error instanceof Error ? error.message : 'Không thể xóa vật liệu QC' }
    }
}

// ============================================================================
// QC DEFINITIONS (Control Limits)
// ============================================================================

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
 * Gets all QC materials (active only)
 */
export async function getQCMaterials() {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('qc_materials')
            .select('*')
            .is('deleted_at', null)
            .order('name')

        if (error) {
            console.error('Error fetching QC materials:', error)
            return { error: error.message }
        }

        return { data }
    } catch (error) {
        console.error('Error in getQCMaterials:', error)
        return { error: error instanceof Error ? error.message : 'Không thể tải vật liệu QC' }
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

// ============================================================================
// LOT CHANGEOVER
// ============================================================================

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

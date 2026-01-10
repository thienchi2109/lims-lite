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
import type { QCDefinitionsFilters, QCDefinitionsResult, QCDefinitionWithDetails } from '@/types/qc'

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
            .update({ is_active: false })
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
                active_date: validated.active_from,
                is_active: true,
                created_by: auth.id,
                data_points_count: validated.data_points_count || 20,
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

        // Map active_from to active_date if present
        const dbUpdateData: Record<string, unknown> = {}
        if (updateData.mean !== undefined) dbUpdateData.mean = updateData.mean
        if (updateData.sd !== undefined) dbUpdateData.sd = updateData.sd
        if (updateData.is_active !== undefined) dbUpdateData.is_active = updateData.is_active

        const { data: definition, error } = await supabase
            .from('qc_definitions')
            .update(dbUpdateData)
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
                id,
                mean,
                sd,
                is_active,
                active_date,
                data_points_count,
                assay_id,
                material_id,
                created_at,
                updated_at,
                assay:assay_definitions(id, name, units),
                material:qc_materials(id, name, lot_number, level)
            `)
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

/**
 * Gets QC definitions with pagination and optional filtering
 * Returns definitions with assay and material details
 */
export async function getQCDefinitionsPaginated(
    filters: QCDefinitionsFilters = {}
): Promise<QCDefinitionsResult | { error: string }> {
    try {
        const supabase = await createClient()

        const page = filters.page ?? 1
        const pageSize = filters.page_size ?? 20
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        // Build base query with count - only select columns that exist in DB
        let query = supabase
            .from('qc_definitions')
            .select(`
                id,
                mean,
                sd,
                is_active,
                active_date,
                data_points_count,
                assay_id,
                material_id,
                created_at,
                updated_at,
                assay:assay_definitions!inner(id, name, units),
                material:qc_materials!inner(id, name, lot_number, level)
            `, { count: 'exact' })

        // Apply status filter
        if (filters.status === 'active') {
            query = query.eq('is_active', true)
        } else if (filters.status === 'inactive') {
            query = query.eq('is_active', false)
        }

        // Order and paginate
        query = query.order('created_at', { ascending: false }).range(from, to)

        const { data, error, count } = await query

        if (error) {
            console.error('Error fetching paginated QC definitions:', error)
            return { error: error.message }
        }

        // Transform data to match QCDefinitionWithDetails
        const transformedData: QCDefinitionWithDetails[] = (data || []).map((def) => {
            const rawAssay = def.assay as unknown
            const rawMaterial = def.material as unknown
            const assay = Array.isArray(rawAssay) ? rawAssay[0] : rawAssay as { id: string; name: string; units: string | null } | null
            const material = Array.isArray(rawMaterial) ? rawMaterial[0] : rawMaterial as { id: string; name: string; lot_number: string; level: string } | null

            // Calculate CV% from mean and SD
            const cvPercent = def.mean > 0 ? (def.sd / def.mean) * 100 : null

            return {
                id: def.id,
                assay_id: assay?.id || '',
                material_id: material?.id || '',
                mean: def.mean,
                sd: def.sd,
                cv_percent: cvPercent,
                is_active: def.is_active,
                active_from: def.active_date,  // Map DB column name to type field name
                data_points_count: def.data_points_count,
                created_at: def.created_at,
                updated_at: def.updated_at,
                assay_name: assay?.name || '',
                assay_units: assay?.units || null,
                material_name: material?.name || '',
                material_lot: material?.lot_number || '',
                material_level: material?.level || '',
            }
        })

        const total = count ?? 0

        return {
            data: transformedData,
            total,
            page,
            page_size: pageSize,
            total_pages: Math.ceil(total / pageSize),
        }
    } catch (error) {
        console.error('Error in getQCDefinitionsPaginated:', error)
        return { error: error instanceof Error ? error.message : 'Không thể tải giới hạn kiểm soát' }
    }
}

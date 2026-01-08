'use server'

/**
 * QC Materials - CRUD operations for control materials
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireRole, isAuthError } from '@/lib/auth-helpers'
import {
    CreateQCMaterialSchema,
    UpdateQCMaterialSchema,
    type CreateQCMaterial,
    type UpdateQCMaterial,
} from '@/types/qc'

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

/**
 * Parameters for getQCMaterials pagination and filtering
 */
export interface GetQCMaterialsParams {
    page?: number           // Default: 1
    pageSize?: number       // Default: 20
    search?: string         // Searches: name, lot_number, manufacturer
    level?: 'low' | 'normal' | 'high' | null
    status?: 'valid' | 'expiring_soon' | 'expired' | null
}

/**
 * Result type for paginated QC materials
 */
export interface GetQCMaterialsResult {
    data: Array<{
        id: string
        name: string
        manufacturer: string
        lot_number: string
        expiration_date: string
        level: 'low' | 'normal' | 'high'
        created_at: string
        updated_at: string
        deleted_at: string | null
    }>
    total: number
    page: number
    pageSize: number
}

/**
 * Gets QC materials with optional pagination and filtering
 *
 * When called without params, returns all materials (backward compatible).
 * When called with params, returns paginated and filtered results.
 */
export async function getQCMaterials(params?: GetQCMaterialsParams): Promise<
    | { data: GetQCMaterialsResult['data']; total?: number; page?: number; pageSize?: number }
    | { error: string }
> {
    try {
        const supabase = await createClient()

        // If no params provided, return all materials (backward compatibility)
        if (!params || Object.keys(params).length === 0) {
            const { data, error } = await supabase
                .from('qc_materials')
                .select('id, name, manufacturer, lot_number, expiration_date, level, created_at, updated_at, deleted_at')
                .is('deleted_at', null)
                .order('name')

            if (error) {
                console.error('Error fetching QC materials:', error)
                return { error: error.message }
            }

            return { data: data || [] }
        }

        // Paginated query with filters
        const page = params.page ?? 1
        const pageSize = params.pageSize ?? 20
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        // Build query with count
        let query = supabase
            .from('qc_materials')
            .select('id, name, manufacturer, lot_number, expiration_date, level, created_at, updated_at, deleted_at', { count: 'exact' })
            .is('deleted_at', null)

        // Apply search filter (searches name, lot_number, manufacturer)
        if (params.search && params.search.trim()) {
            const searchTerm = `%${params.search.trim()}%`
            query = query.or(`name.ilike.${searchTerm},lot_number.ilike.${searchTerm},manufacturer.ilike.${searchTerm}`)
        }

        // Apply level filter
        if (params.level) {
            query = query.eq('level', params.level)
        }

        // Apply status filter based on expiration_date
        if (params.status) {
            const today = new Date()
            const todayStr = today.toISOString().split('T')[0]

            const thirtyDaysFromNow = new Date(today)
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
            const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0]

            switch (params.status) {
                case 'valid':
                    // expiration_date > today + 30 days
                    query = query.gt('expiration_date', thirtyDaysStr)
                    break
                case 'expiring_soon':
                    // expiration_date between today and today + 30 days
                    query = query.gte('expiration_date', todayStr).lte('expiration_date', thirtyDaysStr)
                    break
                case 'expired':
                    // expiration_date < today
                    query = query.lt('expiration_date', todayStr)
                    break
            }
        }

        // Apply ordering and pagination
        query = query.order('name').range(from, to)

        const { data, error, count } = await query

        if (error) {
            console.error('Error fetching QC materials:', error)
            return { error: error.message }
        }

        return {
            data: data || [],
            total: count ?? 0,
            page,
            pageSize,
        }
    } catch (error) {
        console.error('Error in getQCMaterials:', error)
        return { error: error instanceof Error ? error.message : 'Không thể tải vật liệu QC' }
    }
}

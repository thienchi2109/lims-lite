'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { CreateAssayDefinitionSchema } from '@/types'

// ============================================================================
// GET ALL ASSAY DEFINITIONS
// ============================================================================

export async function getAssayDefinitions(params?: {
    page?: number
    pageSize?: number
    search?: string
}) {
    try {
        const supabase = await createClient()
        const page = params?.page || 1
        const pageSize = params?.pageSize || 10
        const search = params?.search || ''

        // Calculate range
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        let query = supabase
            .from('assay_definitions')
            .select(
                `
                id,
                name,
                units,
                validation_rules,
                created_at,
                updated_at,
                assay_methods!assay_methods_assay_id_fkey (
                    id,
                    method_id,
                    is_default,
                    notes,
                    methods!assay_methods_method_id_fkey (
                        id,
                        name
                    )
                )
            `,
                { count: 'exact' }
            )
            .is('deleted_at', null)
            .order('name', { ascending: true })

        if (search) {
            // Search by assay name or method name
            query = query.ilike('name', `%${search}%`)
        }

        // Apply pagination
        const { data, error, count } = await query.range(from, to)

        if (error) {
            console.error('Error fetching assay definitions:', JSON.stringify(error, null, 2))
            return { error: error.message }
        }

        // Transform the data to include methods array
        const transformedData = data.map((assay: any) => ({
            ...assay,
            methods: (assay.assay_methods || []).map((am: any) => ({
                id: am.id,
                method_id: am.method_id,
                name: am.methods?.name || '',
                is_default: am.is_default,
                notes: am.notes,
            })),
            assay_methods: undefined, // Remove the nested object
        }))

        return {
            data: transformedData,
            totalCount: count || 0,
            totalPages: Math.ceil((count || 0) / pageSize),
            page,
            pageSize,
        }
    } catch (error) {
        console.error('Unexpected error:', error)
        return { error: 'Đã xảy ra lỗi không mong muốn' }
    }
}

// ============================================================================
// GET SINGLE ASSAY DEFINITION BY ID
// ============================================================================

export async function getAssayDefinitionById(id: string) {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('assay_definitions')
            .select(`
                id,
                name,
                units,
                validation_rules,
                created_at,
                updated_at,
                assay_methods!assay_methods_assay_id_fkey (
                    id,
                    method_id,
                    is_default,
                    notes,
                    methods!assay_methods_method_id_fkey (
                        id,
                        name
                    )
                )
            `)
            .eq('id', id)
            .is('deleted_at', null)
            .single()

        if (error) {
            console.error('Error fetching assay definition:', JSON.stringify(error, null, 2))
            return { error: error.message }
        }

        // Transform the data to include methods array
        const transformedData = {
            ...data,
            methods: ((data as any).assay_methods || []).map((am: any) => ({
                id: am.id,
                method_id: am.method_id,
                name: am.methods?.name || '',
                is_default: am.is_default,
                notes: am.notes,
            })),
            assay_methods: undefined,
        }

        return { data: transformedData }
    } catch (error) {
        console.error('Unexpected error:', error)
        return { error: 'Đã xảy ra lỗi không mong muốn' }
    }
}

// ============================================================================
// CREATE ASSAY DEFINITION
// ============================================================================

export async function createAssayDefinition(formData: FormData) {
    try {
        const supabase = await createClient()

        // Check user role
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: 'Unauthorized' }
        }

        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (userData?.role !== 'manager') {
            return { error: 'Chỉ Quản lý mới có thể tạo chỉ tiêu xét nghiệm' }
        }

        // Parse and validate form data
        const rawData = {
            name: formData.get('name'),
            method_id: formData.get('method_id') || undefined,
            units: formData.get('units') || undefined,
            validation_rules: formData.get('validation_rules')
                ? JSON.parse(formData.get('validation_rules') as string)
                : undefined,
        }

        const result = CreateAssayDefinitionSchema.safeParse(rawData)

        if (!result.success) {
            return {
                error: 'Dữ liệu không hợp lệ',
                details: result.error.flatten()
            }
        }

        // Insert assay definition
        const { data: assayData, error: assayError } = await supabase
            .from('assay_definitions')
            .insert({
                name: result.data.name,
                units: result.data.units || null,
                validation_rules: result.data.validation_rules || {},
            })
            .select()
            .single()

        if (assayError) {
            console.error('Error creating assay definition:', assayError)
            return { error: assayError.message }
        }

        // If method_id provided, create initial assay-method relationship
        if (result.data.method_id) {
            const { error: methodError } = await supabase
                .from('assay_methods')
                .insert({
                    assay_id: assayData.id,
                    method_id: result.data.method_id,
                    is_default: true,
                    notes: 'Initial method',
                })

            if (methodError) {
                console.error('Error creating assay-method relationship:', methodError)
                // Don't fail the whole operation, just log the error
            }
        }

        revalidatePath('/manager/assays')
        return { success: true, data: assayData }
    } catch (error) {
        console.error('Unexpected error:', error)
        return { error: 'Đã xảy ra lỗi không mong muốn' }
    }
}

// ============================================================================
// UPDATE ASSAY DEFINITION
// ============================================================================

const UpdateAssayDefinitionSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200),
    units: z.string().optional(),
    validation_rules: z.record(z.string(), z.any()).optional(),
})

export async function updateAssayDefinition(formData: FormData) {
    try {
        const supabase = await createClient()

        // Check user role
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: 'Unauthorized' }
        }

        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (userData?.role !== 'manager') {
            return { error: 'Chỉ Quản lý mới có thể cập nhật chỉ tiêu xét nghiệm' }
        }

        // Parse and validate form data
        const rawData = {
            id: formData.get('id'),
            name: formData.get('name'),
            units: formData.get('units') || undefined,
            validation_rules: formData.get('validation_rules')
                ? JSON.parse(formData.get('validation_rules') as string)
                : undefined,
        }

        const result = UpdateAssayDefinitionSchema.safeParse(rawData)

        if (!result.success) {
            return {
                error: 'Dữ liệu không hợp lệ',
                details: result.error.flatten()
            }
        }

        // Update in database
        const { data, error } = await supabase
            .from('assay_definitions')
            .update({
                name: result.data.name,
                units: result.data.units || null,
                validation_rules: result.data.validation_rules || {},
            })
            .eq('id', result.data.id)
            .is('deleted_at', null)
            .select()
            .single()

        if (error) {
            console.error('Error updating assay definition:', error)
            return { error: error.message }
        }

        revalidatePath('/manager/assays')
        return { success: true, data }
    } catch (error) {
        console.error('Unexpected error:', error)
        return { error: 'Đã xảy ra lỗi không mong muốn' }
    }
}

// ============================================================================
// DELETE ASSAY DEFINITION (SOFT DELETE)
// ============================================================================

export async function deleteAssayDefinition(id: string) {
    try {
        const supabase = await createClient()

        // Check user role
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { error: 'Unauthorized' }
        }

        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (userData?.role !== 'manager') {
            return { error: 'Chỉ Quản lý mới có thể xóa chỉ tiêu xét nghiệm' }
        }

        // Check if assay is being used in any results
        const { data: existingResults } = await supabase
            .from('results')
            .select('id')
            .eq('assay_id', id)
            .limit(1)

        if (existingResults && existingResults.length > 0) {
            return {
                error: 'Không thể xóa chỉ tiêu này vì đang được sử dụng trong kết quả xét nghiệm'
            }
        }

        // Soft delete (set deleted_at timestamp)
        const { error } = await supabase
            .from('assay_definitions')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id)

        if (error) {
            console.error('Error deleting assay definition:', error)
            return { error: error.message }
        }

        revalidatePath('/manager/assays')
        return { success: true }
    } catch (error) {
        console.error('Unexpected error:', error)
        return { error: 'Đã xảy ra lỗi không mong muốn' }
    }
}

// ============================================================================
// GET ALL METHODS (for dropdown)
// ============================================================================

export async function getMethods() {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('methods')
            .select('id, name, description')
            .is('deleted_at', null)
            .order('name', { ascending: true })

        if (error) {
            console.error('Error fetching methods:', error)
            return { error: error.message }
        }

        return { data }
    } catch (error) {
        console.error('Unexpected error:', error)
        return { error: 'Đã xảy ra lỗi không mong muốn' }
    }
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { CreateAssayDefinitionSchema } from '@/types'

// ============================================================================
// GET ALL ASSAY DEFINITIONS
// ============================================================================

export async function getAssayDefinitions() {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('assay_definitions')
            .select(`
                id,
                name,
                method_id,
                units,
                validation_rules,
                created_at,
                updated_at,
                methods (
                    id,
                    name
                )
            `)
            .is('deleted_at', null)
            .order('name', { ascending: true })

        if (error) {
            console.error('Error fetching assay definitions:', error)
            return { error: error.message }
        }

        // Transform the data to flatten method name
        const transformedData = data.map((assay: any) => ({
            ...assay,
            method_name: assay.methods?.name || null,
            methods: undefined, // Remove the nested object
        }))

        return { data: transformedData }
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
                method_id,
                units,
                validation_rules,
                created_at,
                updated_at,
                methods (
                    id,
                    name
                )
            `)
            .eq('id', id)
            .is('deleted_at', null)
            .single()

        if (error) {
            console.error('Error fetching assay definition:', error)
            return { error: error.message }
        }

        // Transform the data
        const transformedData = {
            ...data,
            method_name: data.methods?.name || null,
            methods: undefined,
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

        // Insert to database
        const { data, error } = await supabase
            .from('assay_definitions')
            .insert({
                name: result.data.name,
                method_id: result.data.method_id || null,
                units: result.data.units || null,
                validation_rules: result.data.validation_rules || {},
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating assay definition:', error)
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
// UPDATE ASSAY DEFINITION
// ============================================================================

const UpdateAssayDefinitionSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200),
    method_id: z.string().uuid().optional(),
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
            method_id: formData.get('method_id') || undefined,
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
                method_id: result.data.method_id || null,
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

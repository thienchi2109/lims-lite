'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { CreateAssayDefinitionSchema } from '@/types'
import { requireRole, isAuthError } from '@/lib/auth-helpers'

const UpdateAssayDefinitionSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200),
    specialty_id: z.string().uuid().optional(),
    method_name: z.string().trim().min(1).max(200).optional(),
    units: z.string().optional(),
    validation_rules: z.record(z.string(), z.any()).optional(),
    is_confidential: z.boolean().optional(),
})

function parseFormBoolean(value: FormDataEntryValue | null) {
    return value === 'true' || value === 'on'
}

/**
 * Create a new assay definition (Manager only)
 */
export async function createAssayDefinition(formData: FormData) {
    const auth = await requireRole('manager')
    if (isAuthError(auth)) {
        return { error: 'Chỉ Quản lý mới có thể tạo chỉ tiêu xét nghiệm' }
    }

    try {
        const supabase = await createClient()

        // Parse and validate form data
        const rawData = {
            name: formData.get('name'),
            specialty_id: formData.get('specialty_id') || undefined,
            method_id: formData.get('method_id') || undefined,
            method_name: formData.get('method_name') || undefined,
            units: formData.get('units') || undefined,
            is_confidential: parseFormBoolean(formData.get('is_confidential')),
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
                specialty_id: result.data.specialty_id || null,
                method_name: result.data.method_name || null,
                units: result.data.units || null,
                validation_rules: result.data.validation_rules || {},
                is_confidential: result.data.is_confidential ?? false,
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
            }
        }

        revalidatePath('/manager/assays')
        return { success: true, data: assayData }
    } catch (error) {
        console.error('Unexpected error:', error)
        return { error: 'Đã xảy ra lỗi không mong muốn' }
    }
}

/**
 * Update an assay definition (Manager only)
 */
export async function updateAssayDefinition(formData: FormData) {
    const auth = await requireRole('manager')
    if (isAuthError(auth)) {
        return { error: 'Chỉ Quản lý mới có thể cập nhật chỉ tiêu xét nghiệm' }
    }

    try {
        const supabase = await createClient()

        // Parse and validate form data
        const rawData = {
            id: formData.get('id'),
            name: formData.get('name'),
            specialty_id: formData.get('specialty_id') || undefined,
            method_name: formData.get('method_name') || undefined,
            units: formData.get('units') || undefined,
            is_confidential: formData.has('is_confidential')
                ? parseFormBoolean(formData.get('is_confidential'))
                : undefined,
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
                specialty_id: result.data.specialty_id || null,
                units: result.data.units || null,
                validation_rules: result.data.validation_rules || {},
                ...(result.data.method_name !== undefined
                    ? { method_name: result.data.method_name || null }
                    : {}),
                ...(result.data.is_confidential !== undefined
                    ? { is_confidential: result.data.is_confidential }
                    : {}),
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

/**
 * Soft delete an assay definition (Manager only)
 */
export async function deleteAssayDefinition(id: string) {
    const auth = await requireRole('manager')
    if (isAuthError(auth)) {
        return { error: 'Chỉ Quản lý mới có thể xóa chỉ tiêu xét nghiệm' }
    }

    try {
        const supabase = await createClient()

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

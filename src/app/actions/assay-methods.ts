'use server'

import { createClient } from '@/lib/supabase/server'
import { firstRelation, type RelationValue } from '@/lib/supabase/relations'
import { revalidatePath } from 'next/cache'
import { CreateAssayMethodSchema } from '@/types'

// ============================================================================
// GET METHODS FOR AN ASSAY
// ============================================================================

type AssayMethodRelation = {
    name: string
    description: string | null
}

export async function getMethodsForAssay(assayId: string) {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('assay_methods')
            .select(`
                id,
                method_id,
                is_default,
                notes,
                created_at,
                updated_at,
                methods (
                    id,
                    name,
                    description
                )
            `)
            .eq('assay_id', assayId)
            .order('is_default', { ascending: false })  // Default first
            .order('methods(name)', { ascending: true })

        if (error) {
            console.error('Error fetching methods for assay:', error)
            return { error: error.message }
        }

        // Transform the data to flatten method info
        const transformedData = data.map((assayMethod) => {
            const method = firstRelation(assayMethod.methods as RelationValue<AssayMethodRelation>)

            return {
                id: assayMethod.id,
                method_id: assayMethod.method_id,
                name: method?.name || '',
                description: method?.description || null,
                is_default: assayMethod.is_default,
                notes: assayMethod.notes,
                created_at: assayMethod.created_at,
                updated_at: assayMethod.updated_at,
            }
        })

        return { data: transformedData }
    } catch (error) {
        console.error('Unexpected error:', error)
        return { error: 'Đã xảy ra lỗi không mong muốn' }
    }
}

// ============================================================================
// ADD METHOD TO ASSAY
// ============================================================================

export async function addMethodToAssay(formData: FormData) {
    try {
        const supabase = await createClient()

        // Validate user is manager
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
            return { error: 'Chỉ Quản lý mới có thể thêm phương pháp' }
        }

        // Parse and validate
        const rawData = {
            assay_id: formData.get('assay_id'),
            method_id: formData.get('method_id'),
            is_default: formData.get('is_default') === 'true',
            notes: formData.get('notes') || undefined,
        }

        const result = CreateAssayMethodSchema.safeParse(rawData)
        if (!result.success) {
            return { error: 'Dữ liệu không hợp lệ', details: result.error.flatten() }
        }

        // If setting as default, unset other defaults first
        if (result.data.is_default) {
            await supabase
                .from('assay_methods')
                .update({ is_default: false })
                .eq('assay_id', result.data.assay_id)
        }

        // Insert relationship
        const { data, error } = await supabase
            .from('assay_methods')
            .insert({
                assay_id: result.data.assay_id,
                method_id: result.data.method_id,
                is_default: result.data.is_default,
                notes: result.data.notes || null,
            })
            .select()
            .single()

        if (error) {
            if (error.code === '23505') {  // Unique violation
                return { error: 'Phương pháp này đã được thêm vào chỉ tiêu' }
            }
            console.error('Error adding method to assay:', error)
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
// REMOVE METHOD FROM ASSAY
// ============================================================================

export async function removeMethodFromAssay(assayMethodId: string) {
    try {
        const supabase = await createClient()

        // Validate user is manager
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
            return { error: 'Chỉ Quản lý mới có thể xóa phương pháp' }
        }

        // Check if this is the last method for the assay
        const { data: assayMethod } = await supabase
            .from('assay_methods')
            .select('assay_id')
            .eq('id', assayMethodId)
            .single()

        if (assayMethod) {
            const { count } = await supabase
                .from('assay_methods')
                .select('id', { count: 'exact', head: true })
                .eq('assay_id', assayMethod.assay_id)

            if (count === 1) {
                return { error: 'Không thể xóa phương pháp cuối cùng. Mỗi chỉ tiêu phải có ít nhất một phương pháp.' }
            }
        }

        // Delete relationship
        const { error } = await supabase
            .from('assay_methods')
            .delete()
            .eq('id', assayMethodId)

        if (error) {
            console.error('Error removing method from assay:', error)
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
// SET DEFAULT METHOD FOR ASSAY
// ============================================================================

export async function setDefaultMethod(assayId: string, methodId: string) {
    try {
        const supabase = await createClient()

        // Validate user is manager
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
            return { error: 'Chỉ Quản lý mới có thể đặt phương pháp mặc định' }
        }

        // Unset all defaults for this assay
        await supabase
            .from('assay_methods')
            .update({ is_default: false })
            .eq('assay_id', assayId)

        // Set this one as default
        const { error } = await supabase
            .from('assay_methods')
            .update({ is_default: true })
            .eq('assay_id', assayId)
            .eq('method_id', methodId)

        if (error) {
            console.error('Error setting default method:', error)
            return { error: error.message }
        }

        revalidatePath('/manager/assays')
        return { success: true }
    } catch (error) {
        console.error('Unexpected error:', error)
        return { error: 'Đã xảy ra lỗi không mong muốn' }
    }
}

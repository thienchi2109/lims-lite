'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { CreateLabSpecialtySchema } from '@/types'

// ============================================================================
// CREATE LAB SPECIALTY
// ============================================================================

export async function createLabSpecialty(formData: FormData) {
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
            return { error: 'Chỉ Quản lý mới có thể tạo nhóm kỹ thuật' }
        }

        // Parse and validate form data
        const rawData = {
            name: formData.get('name'),
            code: formData.get('code'),
            description: formData.get('description') || undefined,
        }

        const result = CreateLabSpecialtySchema.safeParse(rawData)

        if (!result.success) {
            return {
                error: 'Dữ liệu không hợp lệ',
                details: result.error.flatten()
            }
        }

        // Get max display_order
        const { data: maxOrderData, error: maxOrderError } = await supabase
            .from('lab_specialties')
            .select('display_order')
            .order('display_order', { ascending: false })
            .limit(1)
            .single()

        // Handle error specifically if it's not "no rows found" (PGRST116)
        // If PGRST116, it just means table is empty, which is fine
        if (maxOrderError && maxOrderError.code !== 'PGRST116') {
            console.error('Error fetching max display_order:', maxOrderError)
            // Default to 0 if error, but logging it is important
        }

        const nextOrder = (maxOrderData?.display_order ?? 0) + 1

        // Insert specialty
        const { data: specialtyData, error: specialtyError } = await supabase
            .from('lab_specialties')
            .insert({
                name: result.data.name,
                code: result.data.code,
                description: result.data.description || null,
                display_order: nextOrder,
            })
            .select()
            .single()

        if (specialtyError) {
            console.error('Error creating lab specialty:', specialtyError)
            if (specialtyError.code === '23505') { // Unique violation
                return { error: 'Mã hoặc tên nhóm kỹ thuật đã tồn tại' }
            }
            return { error: specialtyError.message }
        }

        revalidatePath('/manager/assays')
        return { success: true, data: specialtyData }
    } catch (error) {
        console.error('Unexpected error:', error)
        return { error: 'Đã xảy ra lỗi không mong muốn' }
    }
}

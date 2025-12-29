'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Get all lab specialties (for dropdowns)
 */
export async function getSpecialties() {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('lab_specialties')
            .select('*')
            .is('deleted_at', null)
            .order('display_order', { ascending: true })
            .order('name', { ascending: true })

        if (error) {
            console.error('Error fetching specialties:', error)
            return { error: error.message }
        }

        return { data }
    } catch (error) {
        console.error('Unexpected error:', error)
        return { error: 'Đã xảy ra lỗi không mong muốn' }
    }
}

/**
 * Get all methods (for dropdowns)
 */
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

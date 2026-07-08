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

/**
 * Get method name suggestions from assay-owned method text and legacy catalog names.
 */
export async function getMethodNameSuggestions() {
    try {
        const supabase = await createClient()

        const [{ data: assayMethods, error: assayError }, { data: catalogMethods, error: catalogError }] = await Promise.all([
            supabase
                .from('assay_definitions')
                .select('method_name')
                .is('deleted_at', null)
                .not('method_name', 'is', null)
                .order('method_name', { ascending: true }),
            supabase
                .from('methods')
                .select('name')
                .is('deleted_at', null)
                .order('name', { ascending: true }),
        ])

        if (assayError) {
            console.error('Error fetching assay method names:', assayError)
            return { error: assayError.message }
        }

        if (catalogError) {
            console.error('Error fetching legacy methods:', catalogError)
            return { error: catalogError.message }
        }

        const suggestions = new Set<string>()
        for (const row of assayMethods || []) {
            if (row.method_name?.trim()) {
                suggestions.add(row.method_name.trim())
            }
        }
        for (const row of catalogMethods || []) {
            if (row.name?.trim()) {
                suggestions.add(row.name.trim())
            }
        }

        return { data: Array.from(suggestions) }
    } catch (error) {
        console.error('Unexpected error:', error)
        return { error: 'Đã xảy ra lỗi không mong muốn' }
    }
}

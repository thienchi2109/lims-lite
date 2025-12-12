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
    methodId?: string
    specialtyId?: string
}) {
    try {
        const supabase = await createClient()
        const page = params?.page || 1
        const pageSize = params?.pageSize || 10
        const search = params?.search || ''
        const methodId = params?.methodId
        const specialtyId = params?.specialtyId

        // Calculate range
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        // 1. Fetch assay definitions
        let query = supabase
            .from('assay_definitions')
            .select(
                `
                id,
                name,
                specialty_id,
                units,
                validation_rules,
                created_at,
                updated_at,
                lab_specialties (
                    name,
                    display_order
                )
            `,
                { count: 'exact' }
            )
            .is('deleted_at', null)
            .is('deleted_at', null)

        // Apply Specialty Filter
        if (specialtyId && specialtyId !== 'all') {
            query = query.eq('specialty_id', specialtyId)
        }

        // Apply Method Filter
        if (methodId && methodId !== 'all') {
            const { data: linkedAssays } = await supabase
                .from('assay_methods')
                .select('assay_id')
                .eq('method_id', methodId)

            if (linkedAssays && linkedAssays.length > 0) {
                const linkedAssayIds = linkedAssays.map(a => a.assay_id)
                query = query.in('id', linkedAssayIds)
            } else {
                // Method has no assays, return empty
                return {
                    data: [],
                    totalCount: 0,
                    totalPages: 0,
                    page,
                    pageSize,
                }
            }
        }

        // Handle search: match by assay name OR method name
        let assayIdsMatchingMethod: string[] = []
        if (search) {
            // First, find methods that match the search term
            const { data: matchingMethods } = await supabase
                .from('methods')
                .select('id')
                .ilike('name', `%${search}%`)

            if (matchingMethods && matchingMethods.length > 0) {
                const methodIds = matchingMethods.map((m) => m.id)

                // Find assays linked to these methods
                const { data: assayMethodLinks } = await supabase
                    .from('assay_methods')
                    .select('assay_id')
                    .in('method_id', methodIds)

                if (assayMethodLinks && assayMethodLinks.length > 0) {
                    assayIdsMatchingMethod = [...new Set(assayMethodLinks.map((am) => am.assay_id))]
                }
            }

            // Filter: assay name matches OR assay id is in the method-matched list
            if (assayIdsMatchingMethod.length > 0) {
                query = query.or(`name.ilike.%${search}%,id.in.(${assayIdsMatchingMethod.join(',')})`)
            } else {
                // No method matches, just search by assay name
                query = query.ilike('name', `%${search}%`)
            }
        }

        // Execute query (fetch all matching rows)
        const { data: allAssays, error: assayError } = await query

        if (assayError) {
            console.error('Error fetching assay definitions:', JSON.stringify(assayError, null, 2))
            return { error: assayError.message }
        }

        if (!allAssays || allAssays.length === 0) {
            return {
                data: [],
                totalCount: 0,
                totalPages: 0,
                page,
                pageSize,
            }
        }

        // Sort in memory: Specialty Display Order -> Specialty Name -> Assay Name
        const sortedAssays = [...allAssays].sort((a: any, b: any) => {
            // 1. Specialty Display Order
            const orderA = a.lab_specialties?.display_order ?? 9999
            const orderB = b.lab_specialties?.display_order ?? 9999
            if (orderA !== orderB) return orderA - orderB

            // 2. Specialty Name
            const specNameA = a.lab_specialties?.name || ''
            const specNameB = b.lab_specialties?.name || ''
            if (specNameA !== specNameB) return specNameA.localeCompare(specNameB)

            // 3. Assay Name
            return a.name.localeCompare(b.name)
        })

        // Slice for pagination
        const totalCount = sortedAssays.length
        const totalPages = Math.ceil(totalCount / pageSize)
        const assays = sortedAssays.slice(from, to)

        // 2. Fetch related assay_methods (without joining methods yet)
        const assayIds = assays.map(a => a.id)
        const { data: assayMethods, error: methodsError } = await supabase
            .from('assay_methods')
            .select(`
                id,
                assay_id,
                method_id,
                is_default,
                notes
            `)
            .in('assay_id', assayIds)

        if (methodsError) {
            console.error('Error fetching assay methods:', methodsError)
        }

        // 2.5 Fetch methods details
        let methodsMap = new Map<string, any>()
        if (assayMethods && assayMethods.length > 0) {
            const methodIds = [...new Set(assayMethods.map((am: any) => am.method_id))]
            const { data: methodsData, error: methodsDataError } = await supabase
                .from('methods')
                .select('id, name')
                .in('id', methodIds)

            if (methodsDataError) {
                console.error('Error fetching methods details:', methodsDataError)
            } else if (methodsData) {
                methodsData.forEach((m: any) => methodsMap.set(m.id, m))
            }
        }

        // 3. Merge data
        const transformedData = assays.map((assay: any) => {
            const relatedMethods = assayMethods?.filter((am: any) => am.assay_id === assay.id) || []

            return {
                ...assay,
                methods: relatedMethods.map((am: any) => {
                    const methodDetail = methodsMap.get(am.method_id)
                    return {
                        id: am.id,
                        method_id: am.method_id,
                        name: methodDetail?.name || '',
                        is_default: am.is_default,
                        notes: am.notes,
                    }
                }),
            }
        })

        return {
            data: transformedData,
            totalCount,
            totalPages,
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

        // 1. Fetch assay definition
        const { data: assay, error: assayError } = await supabase
            .from('assay_definitions')
            .select(`
                id,
                name,
                specialty_id,
                units,
                validation_rules,
                created_at,
                updated_at
            `)
            .eq('id', id)
            .is('deleted_at', null)
            .single()

        if (assayError) {
            console.error('Error fetching assay definition:', JSON.stringify(assayError, null, 2))
            return { error: assayError.message }
        }

        // 2. Fetch related assay_methods
        const { data: assayMethods, error: methodsError } = await supabase
            .from('assay_methods')
            .select(`
                id,
                method_id,
                is_default,
                notes
            `)
            .eq('assay_id', id)

        if (methodsError) {
            console.error('Error fetching assay methods:', methodsError)
        }

        // 2.5 Fetch methods details
        let methodsMap = new Map<string, any>()
        if (assayMethods && assayMethods.length > 0) {
            const methodIds = [...new Set(assayMethods.map((am: any) => am.method_id))]
            const { data: methodsData, error: methodsDataError } = await supabase
                .from('methods')
                .select('id, name')
                .in('id', methodIds)

            if (methodsDataError) {
                console.error('Error fetching methods details:', methodsDataError)
            } else if (methodsData) {
                methodsData.forEach((m: any) => methodsMap.set(m.id, m))
            }
        }

        // 3. Merge data
        const transformedData = {
            ...assay,
            methods: (assayMethods || []).map((am: any) => {
                const methodDetail = methodsMap.get(am.method_id)
                return {
                    id: am.id,
                    method_id: am.method_id,
                    name: methodDetail?.name || '',
                    is_default: am.is_default,
                    notes: am.notes,
                }
            }),
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
            specialty_id: formData.get('specialty_id') || undefined,
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
                specialty_id: result.data.specialty_id || null,
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
    specialty_id: z.string().uuid().optional(),
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
            specialty_id: formData.get('specialty_id') || undefined,
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
                specialty_id: result.data.specialty_id || null,
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
// GET ALL SPECIALTIES (for dropdown)
// ============================================================================

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

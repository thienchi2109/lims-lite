'use server'

import { createClient } from '@/lib/supabase/server'

interface AssayMethod {
    id: string
    method_id: string
    name: string
    is_default: boolean
    notes: string | null
}

interface AssayDefinition {
    id: string
    name: string
    specialty_id: string | null
    specialty_name: string | null
    specialty_order: number | null
    units: string | null
    validation_rules: Record<string, unknown>
    is_confidential: boolean
    methods: AssayMethod[]
    created_at: string
    updated_at: string
}

type AssayDefinitionRpcRow = AssayDefinition & {
    total_count: number | string
    lab_specialties?: {
        name: string | null
        display_order: number | null
    } | null
}

interface GetAssayDefinitionsParams {
    page?: number
    pageSize?: number
    search?: string
    methodId?: string
    specialtyId?: string
}

const MISSING_ASSAY_CONFIDENTIALITY_ERROR = 'Thiếu trạng thái bảo mật của chỉ tiêu xét nghiệm'

/**
 * Get paginated list of assay definitions with search/filter support
 * Uses database RPC for efficient query execution
 */
export async function getAssayDefinitions(params?: GetAssayDefinitionsParams) {
    try {
        const supabase = await createClient()
        const page = params?.page || 1
        const pageSize = params?.pageSize || 10

        const { data, error } = await supabase.rpc('get_assay_definitions', {
            p_search: params?.search || null,
            p_method_id: params?.methodId && params.methodId !== 'all' ? params.methodId : null,
            p_specialty_id: params?.specialtyId && params.specialtyId !== 'all' ? params.specialtyId : null,
            p_page: page,
            p_page_size: pageSize,
        })

        if (error) {
            console.error('Error fetching assay definitions:', error)
            return { error: error.message }
        }

        const rows = data as AssayDefinitionRpcRow[] | null

        if (!rows || rows.length === 0) {
            return {
                data: [],
                totalCount: 0,
                totalPages: 0,
                page,
                pageSize,
            }
        }

        if (rows.some((row) => typeof row.is_confidential !== 'boolean')) {
            return { error: MISSING_ASSAY_CONFIDENTIALITY_ERROR }
        }

        const totalCount = Number(rows[0].total_count)
        const transformedData: AssayDefinition[] = rows.map((row) => ({
            id: row.id,
            name: row.name,
            specialty_id: row.specialty_id,
            specialty_name: row.specialty_name,
            specialty_order: row.specialty_order,
            units: row.units,
            validation_rules: row.validation_rules || {},
            is_confidential: row.is_confidential,
            methods: row.methods || [],
            created_at: row.created_at,
            updated_at: row.updated_at,
            // Include lab_specialties for backward compatibility
            lab_specialties: row.specialty_name ? {
                name: row.specialty_name,
                display_order: row.specialty_order,
            } : null,
        }))

        return {
            data: transformedData,
            totalCount,
            totalPages: Math.ceil(totalCount / pageSize),
            page,
            pageSize,
        }
    } catch (error) {
        console.error('Unexpected error:', error)
        return { error: 'Đã xảy ra lỗi không mong muốn' }
    }
}

/**
 * Get single assay definition by ID with methods
 * Uses database RPC for efficient query execution
 */
export async function getAssayDefinitionById(id: string) {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('get_assay_definition_by_id', {
            p_id: id,
        })

        if (error) {
            console.error('Error fetching assay definition:', error)
            return { error: error.message }
        }

        if (!data || data.length === 0) {
            return { error: 'Không tìm thấy chỉ tiêu' }
        }

        const row = data[0]
        if (typeof row.is_confidential !== 'boolean') {
            return { error: MISSING_ASSAY_CONFIDENTIALITY_ERROR }
        }

        return {
            data: {
                id: row.id,
                name: row.name,
                specialty_id: row.specialty_id,
                units: row.units,
                validation_rules: row.validation_rules || {},
                is_confidential: row.is_confidential,
                methods: row.methods || [],
                created_at: row.created_at,
                updated_at: row.updated_at,
            },
        }
    } catch (error) {
        console.error('Unexpected error:', error)
        return { error: 'Đã xảy ra lỗi không mong muốn' }
    }
}

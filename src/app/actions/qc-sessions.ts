'use server'

/**
 * QC Sessions - Paginated listing with filters
 * Functions: getQCSessionsPaginated
 */

import { createClient } from '@/lib/supabase/server'
import {
    QCSessionFiltersSchema,
    type QCSessionFilters,
    type QCSessionRow,
    type QCSessionsResult,
} from '@/types/qc'

// ============================================================================
// SERVER ACTION
// ============================================================================

/**
 * Get QC sessions with filters and pagination
 * Returns sessions with assay details, user names, and counts
 */
export async function getQCSessionsPaginated(
    filters: QCSessionFilters
): Promise<QCSessionsResult | { error: string }> {
    try {
        const validated = QCSessionFiltersSchema.parse(filters)
        const supabase = await createClient()

        const { page, page_size, status, session_mode, assay_id, specialty_id, active_only, search } = validated
        const offset = (page - 1) * page_size

        // Build base query
        let query = supabase
            .from('qc_sessions')
            .select(`
                id,
                assay_id,
                session_mode,
                qc_status,
                started_at,
                ended_at,
                notes,
                assay:assay_definitions!inner(
                    id,
                    name,
                    units,
                    specialty_id,
                    specialty:lab_specialties(id, name)
                ),
                started_by_user:users!qc_sessions_started_by_fkey(full_name),
                ended_by_user:users!qc_sessions_ended_by_fkey(full_name)
            `, { count: 'exact' })

        // Apply filters
        if (status) {
            query = query.eq('qc_status', status)
        }

        if (session_mode) {
            query = query.eq('session_mode', session_mode)
        }

        if (assay_id) {
            query = query.eq('assay_id', assay_id)
        }

        if (active_only) {
            query = query.is('ended_at', null)
        }

        // Order and paginate
        query = query
            .order('started_at', { ascending: false })
            .range(offset, offset + page_size - 1)

        const { data: sessions, error, count } = await query

        if (error) {
            console.error('Error fetching QC sessions:', error)
            return { error: error.message }
        }

        // Get counts for each session (results and violations)
        const sessionIds = sessions?.map(s => s.id) || []

        let resultsCounts: Record<string, number> = {}
        let violationsCounts: Record<string, number> = {}

        if (sessionIds.length > 0) {
            // Get results count per session
            const { data: resultsData } = await supabase
                .from('qc_results')
                .select('session_id')
                .in('session_id', sessionIds)

            if (resultsData) {
                for (const r of resultsData) {
                    if (r.session_id) {
                        resultsCounts[r.session_id] = (resultsCounts[r.session_id] || 0) + 1
                    }
                }
            }

            // Get unresolved violations count per session
            const { data: violationsData } = await supabase
                .from('qc_violations')
                .select('session_id')
                .in('session_id', sessionIds)
                .is('resolved_at', null)

            if (violationsData) {
                for (const v of violationsData) {
                    if (v.session_id) {
                        violationsCounts[v.session_id] = (violationsCounts[v.session_id] || 0) + 1
                    }
                }
            }
        }

        // Transform data
        const transformedData: QCSessionRow[] = (sessions || [])
            .map(session => {
                const rawAssay = session.assay as any
                const assay = Array.isArray(rawAssay) ? rawAssay[0] : rawAssay
                const rawSpecialty = assay?.specialty as any
                const specialty = Array.isArray(rawSpecialty) ? rawSpecialty[0] : rawSpecialty
                const startedByUser = session.started_by_user as any
                const endedByUser = session.ended_by_user as any

                return {
                    id: session.id,
                    assay_id: session.assay_id,
                    session_mode: session.session_mode,
                    qc_status: session.qc_status,
                    started_at: session.started_at,
                    ended_at: session.ended_at,
                    notes: session.notes,
                    assay_name: assay?.name || '',
                    assay_units: assay?.units || null,
                    specialty_id: assay?.specialty_id || null,
                    specialty_name: specialty?.name || null,
                    started_by_name: startedByUser?.full_name || null,
                    ended_by_name: endedByUser?.full_name || null,
                    results_count: resultsCounts[session.id] || 0,
                    violations_count: violationsCounts[session.id] || 0,
                }
            })
            // Filter by specialty (post-query since it's a nested field)
            .filter(row => {
                if (specialty_id && row.specialty_id !== specialty_id) {
                    return false
                }
                if (search) {
                    const searchLower = search.toLowerCase()
                    return row.assay_name.toLowerCase().includes(searchLower)
                }
                return true
            })

        const total = count || 0

        return {
            data: transformedData,
            total,
            page,
            page_size,
            total_pages: Math.ceil(total / page_size),
        }
    } catch (error) {
        console.error('Error in getQCSessionsPaginated:', error)
        return { error: error instanceof Error ? error.message : 'Không thể tải phiên QC' }
    }
}

/**
 * Get filter options for sessions (specialties, assays)
 */
export async function getQCSessionFilterOptions() {
    try {
        const supabase = await createClient()

        // Get specialties
        const { data: specialties } = await supabase
            .from('lab_specialties')
            .select('id, name')
            .order('name')

        // Get assays that have QC definitions
        const { data: assays } = await supabase
            .from('assay_definitions')
            .select('id, name')
            .is('deleted_at', null)
            .order('name')

        return {
            specialties: specialties || [],
            assays: assays || [],
        }
    } catch (error) {
        console.error('Error fetching filter options:', error)
        return { specialties: [], assays: [] }
    }
}

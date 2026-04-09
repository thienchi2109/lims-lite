'use server'

/**
 * CoA Access Log Server Action
 *
 * Manager-only feature for viewing CoA access logs.
 * Extracted from src/app/actions/coa.ts for better maintainability.
 */

import { createClient } from '@/lib/supabase/server'
import { firstRelation, type RelationValue } from '@/lib/supabase/relations'

// ============================================================================
// COA ACCESS LOG VIEWER (Manager Feature)
// ============================================================================

type CoAAccessClientRelation = {
    name: string | null
}

type CoAAccessSampleRelation = {
    sample_id: string | null
}

/**
 * Fetch CoA access logs for a sample (manager only)
 */
export async function getCoAAccessLogs(sampleId: string): Promise<{
    data: {
        id: string
        client_name: string
        sample_id_display: string
        accessed_at: string
        ip_address: string | null
        user_agent: string | null
        success: boolean
        failure_reason: string | null
    }[]
    error?: string
}> {
    try {
        const supabase = await createClient()

        // Verify user is manager
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { data: [], error: 'User not authenticated' }
        }

        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!userData || userData.role !== 'manager') {
            return { data: [], error: 'Unauthorized: Only managers can view access logs' }
        }

        // Fetch access logs with client name
        const { data: logs, error } = await supabase
            .from('coa_access_log')
            .select(
                `
                id,
                accessed_at,
                ip_address,
                user_agent,
                success,
                failure_reason,
                clients!inner (
                    name
                ),
                samples!inner (
                    sample_id
                )
            `
            )
            .eq('sample_id', sampleId)
            .order('accessed_at', { ascending: false })

        if (error) {
            console.error('Error fetching CoA access logs:', error)
            return { data: [], error: error.message }
        }

        // Transform data to flat structure
        const transformedLogs = (logs || []).map((log) => {
            const client = firstRelation(log.clients as RelationValue<CoAAccessClientRelation>)
            const sample = firstRelation(log.samples as RelationValue<CoAAccessSampleRelation>)

            return {
                id: log.id,
                client_name: client?.name || 'N/A',
                sample_id_display: sample?.sample_id || 'N/A',
                accessed_at: log.accessed_at,
                ip_address: log.ip_address,
                user_agent: log.user_agent,
                success: log.success,
                failure_reason: log.failure_reason,
            }
        })

        return { data: transformedLogs }
    } catch (error) {
        console.error('Unexpected error in getCoAAccessLogs:', error)
        return { data: [], error: 'Unexpected error occurred' }
    }
}

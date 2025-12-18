'use server'

import { createClient } from '@/lib/supabase/server'
import {
    SearchQuerySchema,
    SearchSampleResultSchema,
    SearchClientResultSchema,
    SearchAssayResultSchema,
    SearchResultResultSchema,
    SearchAuditLogResultSchema,
    GlobalSearchResultSchema,
    type SearchSampleResult,
    type SearchClientResult,
    type SearchAssayResult,
    type SearchResultResult,
    type SearchAuditLogResult,
    type GlobalSearchResult,
} from '@/types'
import { z } from 'zod'

// ============================================================================
// SEARCH SAMPLES
// ============================================================================

/**
 * Search samples by query
 * Returns: id, sample_id, client_name, type, status, received_at, rank
 * Access: All authenticated users (RLS enforced)
 */
export async function searchSamples(query: string, maxResults = 20) {
    try {
        const supabase = await createClient()

        // Verify authentication
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        // Validate input
        const validated = SearchQuerySchema.parse({ query, maxResults })

        // Call database function
        const { data, error } = await supabase.rpc('search_samples', {
            search_query: validated.query,
            max_results: validated.maxResults,
        })

        if (error) {
            console.error('searchSamples error:', error)
            return { error: error.message }
        }

        // Validate and return results
        const results = z.array(SearchSampleResultSchema).parse(data || [])
        return { data: results }
    } catch (err) {
        console.error('searchSamples exception:', err)
        if (err instanceof z.ZodError) {
            return { error: err.issues[0].message }
        }
        return { error: err instanceof Error ? err.message : 'Failed to search samples' }
    }
}

// ============================================================================
// SEARCH CLIENTS
// ============================================================================

/**
 * Search clients by query
 * Returns: id, name, phone, address, rank
 * Access: All authenticated users (RLS enforced)
 */
export async function searchClients(query: string, maxResults = 20) {
    try {
        const supabase = await createClient()

        // Verify authentication
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        // Validate input
        const validated = SearchQuerySchema.parse({ query, maxResults })

        // Call database function
        const { data, error } = await supabase.rpc('search_clients', {
            search_query: validated.query,
            max_results: validated.maxResults,
        })

        if (error) {
            console.error('searchClients error:', error)
            return { error: error.message }
        }

        // Validate and return results
        const results = z.array(SearchClientResultSchema).parse(data || [])
        return { data: results }
    } catch (err) {
        console.error('searchClients exception:', err)
        if (err instanceof z.ZodError) {
            return { error: err.issues[0].message }
        }
        return { error: err instanceof Error ? err.message : 'Failed to search clients' }
    }
}

// ============================================================================
// SEARCH ASSAYS
// ============================================================================

/**
 * Search assay definitions by query
 * Returns: id, name, units, rank
 * Access: All authenticated users (RLS enforced)
 */
export async function searchAssays(query: string, maxResults = 20) {
    try {
        const supabase = await createClient()

        // Verify authentication
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        // Validate input
        const validated = SearchQuerySchema.parse({ query, maxResults })

        // Call database function
        const { data, error } = await supabase.rpc('search_assays', {
            search_query: validated.query,
            max_results: validated.maxResults,
        })

        if (error) {
            console.error('searchAssays error:', error)
            return { error: error.message }
        }

        // Validate and return results
        const results = z.array(SearchAssayResultSchema).parse(data || [])
        return { data: results }
    } catch (err) {
        console.error('searchAssays exception:', err)
        if (err instanceof z.ZodError) {
            return { error: err.issues[0].message }
        }
        return { error: err instanceof Error ? err.message : 'Failed to search assays' }
    }
}

// ============================================================================
// SEARCH RESULTS
// ============================================================================

/**
 * Search results by query
 * Returns: id, sample_id, assay_id, value, status, rank
 * Access: All authenticated users (RLS enforced via samples.deleted_at)
 */
export async function searchResults(query: string, maxResults = 20) {
    try {
        const supabase = await createClient()

        // Verify authentication
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        // Validate input
        const validated = SearchQuerySchema.parse({ query, maxResults })

        // Call database function
        const { data, error } = await supabase.rpc('search_results', {
            search_query: validated.query,
            max_results: validated.maxResults,
        })

        if (error) {
            console.error('searchResults error:', error)
            return { error: error.message }
        }

        // Validate and return results
        const results = z.array(SearchResultResultSchema).parse(data || [])
        return { data: results }
    } catch (err) {
        console.error('searchResults exception:', err)
        if (err instanceof z.ZodError) {
            return { error: err.issues[0].message }
        }
        return { error: err instanceof Error ? err.message : 'Failed to search results' }
    }
}

// ============================================================================
// SEARCH AUDIT LOGS (MANAGER ONLY)
// ============================================================================

/**
 * Search audit logs by query
 * Returns: id, operation, table_name, changed_at, rank
 * Access: MANAGERS ONLY (explicit role check in database function)
 */
export async function searchAuditLogs(query: string, maxResults = 20) {
    try {
        const supabase = await createClient()

        // Verify authentication
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        // Verify manager role (database function also checks, but verify early for better UX)
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (userData?.role !== 'manager') {
            return { error: 'Unauthorized: Manager access required' }
        }

        // Validate input
        const validated = SearchQuerySchema.parse({ query, maxResults })

        // Call database function (has additional manager check)
        const { data, error } = await supabase.rpc('search_audit_logs', {
            search_query: validated.query,
            max_results: validated.maxResults,
        })

        if (error) {
            console.error('searchAuditLogs error:', error)
            return { error: error.message }
        }

        // Validate and return results
        const results = z.array(SearchAuditLogResultSchema).parse(data || [])
        return { data: results }
    } catch (err) {
        console.error('searchAuditLogs exception:', err)
        if (err instanceof z.ZodError) {
            return { error: err.issues[0].message }
        }
        return { error: err instanceof Error ? err.message : 'Failed to search audit logs' }
    }
}

// ============================================================================
// GLOBAL SEARCH
// ============================================================================

/**
 * Search across all entities (samples, clients, assays, results)
 * Returns: entity_type, entity_id, description, rank
 * Access: All authenticated users (calls other search functions which enforce RLS)
 * Note: Does NOT include audit_logs (manager-only)
 */
export async function globalSearch(query: string, maxResults = 20) {
    try {
        const supabase = await createClient()

        // Verify authentication
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        // Validate input
        const validated = SearchQuerySchema.parse({ query, maxResults })

        // Call database function
        const { data, error } = await supabase.rpc('global_search', {
            search_query: validated.query,
            max_results: validated.maxResults,
        })

        if (error) {
            console.error('globalSearch error:', error)
            return { error: error.message }
        }

        // Validate and return results
        const results = z.array(GlobalSearchResultSchema).parse(data || [])
        return { data: results }
    } catch (err) {
        console.error('globalSearch exception:', err)
        if (err instanceof z.ZodError) {
            return { error: err.issues[0].message }
        }
        return { error: err instanceof Error ? err.message : 'Failed to perform global search' }
    }
}

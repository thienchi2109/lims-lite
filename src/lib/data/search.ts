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
// SEARCH HELPERS (Server-side data layer)
// ============================================================================
// These functions can be safely imported into Server Components.
// They call the PostgreSQL full-text search functions directly.

/**
 * Fetch sample search results
 * Can be safely imported into Server Components (no Server Action boundary)
 */
export async function fetchSearchSamples(query: string, maxResults = 20) {
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
            console.error('fetchSearchSamples error:', error)
            return { error: error.message }
        }

        // Validate and return results
        const results = z.array(SearchSampleResultSchema).parse(data || [])
        return { data: results }
    } catch (err) {
        console.error('fetchSearchSamples exception:', err)
        if (err instanceof z.ZodError) {
            return { error: err.issues[0].message }
        }
        return { error: err instanceof Error ? err.message : 'Failed to search samples' }
    }
}

/**
 * Fetch client search results
 */
export async function fetchSearchClients(query: string, maxResults = 20) {
    try {
        const supabase = await createClient()

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        const validated = SearchQuerySchema.parse({ query, maxResults })

        const { data, error } = await supabase.rpc('search_clients', {
            search_query: validated.query,
            max_results: validated.maxResults,
        })

        if (error) {
            console.error('fetchSearchClients error:', error)
            return { error: error.message }
        }

        const results = z.array(SearchClientResultSchema).parse(data || [])
        return { data: results }
    } catch (err) {
        console.error('fetchSearchClients exception:', err)
        if (err instanceof z.ZodError) {
            return { error: err.issues[0].message }
        }
        return { error: err instanceof Error ? err.message : 'Failed to search clients' }
    }
}

/**
 * Fetch assay search results
 */
export async function fetchSearchAssays(query: string, maxResults = 20) {
    try {
        const supabase = await createClient()

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        const validated = SearchQuerySchema.parse({ query, maxResults })

        const { data, error } = await supabase.rpc('search_assays', {
            search_query: validated.query,
            max_results: validated.maxResults,
        })

        if (error) {
            console.error('fetchSearchAssays error:', error)
            return { error: error.message }
        }

        const results = z.array(SearchAssayResultSchema).parse(data || [])
        return { data: results }
    } catch (err) {
        console.error('fetchSearchAssays exception:', err)
        if (err instanceof z.ZodError) {
            return { error: err.issues[0].message }
        }
        return { error: err instanceof Error ? err.message : 'Failed to search assays' }
    }
}

/**
 * Fetch result search results
 */
export async function fetchSearchResults(query: string, maxResults = 20) {
    try {
        const supabase = await createClient()

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        const validated = SearchQuerySchema.parse({ query, maxResults })

        const { data, error } = await supabase.rpc('search_results', {
            search_query: validated.query,
            max_results: validated.maxResults,
        })

        if (error) {
            console.error('fetchSearchResults error:', error)
            return { error: error.message }
        }

        const results = z.array(SearchResultResultSchema).parse(data || [])
        return { data: results }
    } catch (err) {
        console.error('fetchSearchResults exception:', err)
        if (err instanceof z.ZodError) {
            return { error: err.issues[0].message }
        }
        return { error: err instanceof Error ? err.message : 'Failed to search results' }
    }
}

/**
 * Fetch audit log search results (manager only)
 */
export async function fetchSearchAuditLogs(query: string, maxResults = 20) {
    try {
        const supabase = await createClient()

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        // Manager role verification (defense-in-depth)
        const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()

        if (userData?.role !== 'manager') {
            return { error: 'Unauthorized: Manager access required' }
        }

        const validated = SearchQuerySchema.parse({ query, maxResults })

        const { data, error } = await supabase.rpc('search_audit_logs', {
            search_query: validated.query,
            max_results: validated.maxResults,
        })

        if (error) {
            console.error('fetchSearchAuditLogs error:', error)
            return { error: error.message }
        }

        const results = z.array(SearchAuditLogResultSchema).parse(data || [])
        return { data: results }
    } catch (err) {
        console.error('fetchSearchAuditLogs exception:', err)
        if (err instanceof z.ZodError) {
            return { error: err.issues[0].message }
        }
        return { error: err instanceof Error ? err.message : 'Failed to search audit logs' }
    }
}

/**
 * Fetch global search results (combined from all entities)
 */
export async function fetchGlobalSearch(query: string, maxResults = 20) {
    try {
        const supabase = await createClient()

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { error: 'Unauthorized' }
        }

        const validated = SearchQuerySchema.parse({ query, maxResults })

        const { data, error } = await supabase.rpc('global_search', {
            search_query: validated.query,
            max_results: validated.maxResults,
        })

        if (error) {
            console.error('fetchGlobalSearch error:', error)
            return { error: error.message }
        }

        const results = z.array(GlobalSearchResultSchema).parse(data || [])
        return { data: results }
    } catch (err) {
        console.error('fetchGlobalSearch exception:', err)
        if (err instanceof z.ZodError) {
            return { error: err.issues[0].message }
        }
        return { error: err instanceof Error ? err.message : 'Failed to perform global search' }
    }
}

// ============================================================================
// SCORE NORMALIZATION UTILITIES (Optional)
// ============================================================================

/**
 * Normalize rank scores to 0-100 scale
 * PostgreSQL ts_rank returns values typically between 0 and 1
 */
export function normalizeRankScore(rank: number): number {
    return Math.round(rank * 100)
}

/**
 * Group search results by score ranges
 * Useful for UI categorization (Highly Relevant, Relevant, Somewhat Relevant)
 */
export function categorizeByScore(rank: number): 'high' | 'medium' | 'low' {
    const normalized = normalizeRankScore(rank)
    if (normalized >= 70) return 'high'
    if (normalized >= 40) return 'medium'
    return 'low'
}

/**
 * Sort search results by rank (highest first)
 */
export function sortByRank<T extends { rank: number }>(results: T[]): T[] {
    return [...results].sort((a, b) => b.rank - a.rank)
}

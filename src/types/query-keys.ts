/**
 * TanStack Query Key Types and Factories
 * 
 * Centralized query key management for type-safe cache invalidation.
 * Following TanStack Query best practices with hierarchical key structure.
 */

import type { SampleListParams, QCEntryParams } from './index'

/**
 * Query key factory for samples-related queries
 * 
 * Hierarchical structure:
 * - ['samples'] - All samples queries
 * - ['samples', filters] - Specific filtered samples list
 * - ['sample', id] - Single sample detail
 * - ['sample-tests', id] - Tests assigned to a sample
 */
export const sampleKeys = {
    /**
     * Base key for all samples queries
     * Use for invalidating all samples-related data
     */
    all: ['samples'] as const,

    /**
     * Key for samples list with filters
     * Automatically refetches when filter params change
     */
    list: (params: SampleListParams) => ['samples', params] as const,

    /**
     * Key for single sample detail
     */
    detail: (id: string) => ['sample', id] as const,

    /**
     * Key for tests assigned to a sample
     */
    tests: (sampleId: string) => ['sample-tests', sampleId] as const,
}

/**
 * Query key factory for assay definitions
 */
export const assayKeys = {
    all: ['assays'] as const,
    list: (search?: string) => ['assays', { search }] as const,
    detail: (id: string) => ['assay', id] as const,
}

/**
 * Query key factory for results
 */
export const resultKeys = {
    all: ['results'] as const,
    bySample: (sampleId: string) => ['results', sampleId] as const,
    detail: (id: string) => ['result', id] as const,
}

/**
 * Query key factory for QC entry
 */
export const qcEntryKeys = {
    all: ['qc-entry'] as const,
    list: (params: QCEntryParams) => ['qc-entry', params] as const,
    detail: (id: string) => ['qc-detail', id] as const,
}

/**
 * Query key factory for clients
 */
export const clientKeys = {
    all: ['clients'] as const,
    detail: (id: string | null) => ['client', id] as const,
}

/**
 * Query key factory for approval queue
 */
export const approvalKeys = {
    all: ['approvals'] as const,
    count: ['approvals', 'count'] as const,
    list: (tab: string) => ['approvals', 'list', tab] as const,
}

/**
 * Query key factory for user signatures
 *
 * Hierarchical structure:
 * - ['signature'] - All signature queries
 * - ['signature', 'status'] - Current user's signature status
 * - ['signature', 'history'] - Signature upload history
 */
export const signatureKeys = {
    /** Base key for all signature queries */
    all: ['signature'] as const,
    /** Current user's active signature status */
    status: ['signature', 'status'] as const,
    /** Signature upload history */
    history: ['signature', 'history'] as const,
}

/**
 * Query key factory for search queries
 *
 * Hierarchical structure:
 * - ['search'] - All search queries
 * - ['search', 'samples', query] - Sample search results
 * - ['search', 'clients', query] - Client search results
 * - ['search', 'assays', query] - Assay search results
 * - ['search', 'results', query] - Result search results
 * - ['search', 'audit-logs', query] - Audit log search results
 * - ['search', 'global', query] - Global search results
 */
export const searchKeys = {
    /**
     * Base key for all search queries
     * Use for invalidating all search-related data
     */
    all: ['search'] as const,

    /**
     * Key for sample search results
     */
    samples: (query: string, maxResults?: number) => ['search', 'samples', query, maxResults] as const,

    /**
     * Key for client search results
     */
    clients: (query: string, maxResults?: number) => ['search', 'clients', query, maxResults] as const,

    /**
     * Key for assay search results
     */
    assays: (query: string, maxResults?: number) => ['search', 'assays', query, maxResults] as const,

    /**
     * Key for result search results
     */
    results: (query: string, maxResults?: number) => ['search', 'results', query, maxResults] as const,

    /**
     * Key for audit log search results (manager only)
     */
    auditLogs: (query: string, maxResults?: number) => ['search', 'audit-logs', query, maxResults] as const,

    /**
     * Key for global search results
     */
    global: (query: string, maxResults?: number) => ['search', 'global', query, maxResults] as const,
}

/**
 * Type helper to extract query key from factory
 */
export type QueryKey<T extends (...args: any[]) => readonly any[]> = ReturnType<T>

/**
 * Invalidation helper for sample-related operations.
 *
 * Consolidates multiple invalidations into a single atomic operation,
 * reducing redundant network requests and preventing UI flicker.
 *
 * @example
 * // Invalidate all sample-related queries for a specific sample
 * await invalidateSampleQueries(queryClient, sampleId)
 *
 * // Invalidate only sample list and detail (no results)
 * await invalidateSampleQueries(queryClient, sampleId, { includeResults: false })
 */
import type { QueryClient } from '@tanstack/react-query'

interface InvalidateSampleQueriesOptions {
    /** Include results queries in invalidation (default: true) */
    includeResults?: boolean
    /** Include sample tests queries in invalidation (default: false) */
    includeTests?: boolean
}

export async function invalidateSampleQueries(
    queryClient: QueryClient,
    sampleId: string,
    options: InvalidateSampleQueriesOptions = {}
): Promise<void> {
    const { includeResults = true, includeTests = false } = options

    await queryClient.invalidateQueries({
        predicate: (query) => {
            const key = query.queryKey

            // Match samples list queries: ['samples', ...]
            if (key[0] === 'samples') return true

            // Match specific sample detail: ['sample', sampleId]
            if (key[0] === 'sample' && key[1] === sampleId) return true

            // Match results for this sample: ['results', sampleId]
            if (includeResults && key[0] === 'results' && key[1] === sampleId) return true

            // Match tests for this sample: ['sample-tests', sampleId]
            if (includeTests && key[0] === 'sample-tests' && key[1] === sampleId) return true

            return false
        },
    })
}

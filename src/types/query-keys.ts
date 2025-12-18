/**
 * TanStack Query Key Types and Factories
 * 
 * Centralized query key management for type-safe cache invalidation.
 * Following TanStack Query best practices with hierarchical key structure.
 */

import type { SampleListParams } from './index'

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

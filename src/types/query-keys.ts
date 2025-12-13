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
 * Type helper to extract query key from factory
 */
export type QueryKey<T extends (...args: any[]) => readonly any[]> = ReturnType<T>

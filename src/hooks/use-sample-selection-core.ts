'use client'

import { useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchSampleResultsClient } from '@/lib/api-client'
import { sampleKeys } from '@/types/query-keys'
import type { ResultWithAssay, SampleWithUser } from '@/types'
import { fetchSampleDetail } from '@/hooks/use-sample-detail'

const SAMPLE_SELECTION_CORE_STALE_TIME_MS = 30 * 1000
const SAMPLE_SELECTION_CORE_GC_TIME_MS = 10 * 60 * 1000

export interface SampleSelectionCoreData {
    sample: SampleWithUser
    results: ResultWithAssay[]
}

interface UseSampleSelectionCoreCacheOptions {
    sampleId?: string | null
    initialSample?: SampleWithUser | null
    initialResults?: ResultWithAssay[]
}

export function createSampleSelectionCoreData(
    sample: SampleWithUser,
    results: ResultWithAssay[] = [],
): SampleSelectionCoreData {
    return {
        sample,
        results,
    }
}

export async function fetchSampleSelectionCore(sampleId: string): Promise<SampleSelectionCoreData> {
    const samplePromise = fetchSampleDetail(sampleId)
    const unresolvedSample = Symbol('unresolved-sample')
    const immediateSample = await Promise.race([
        samplePromise,
        Promise.resolve(unresolvedSample),
    ])

    if (immediateSample !== unresolvedSample) {
        const embeddedResults = Array.isArray((immediateSample as SampleWithUser & { results?: ResultWithAssay[] }).results)
            ? (immediateSample as SampleWithUser & { results?: ResultWithAssay[] }).results ?? []
            : null

        if (embeddedResults) {
            return createSampleSelectionCoreData(immediateSample, embeddedResults)
        }
    }

    const [sample, resultsResponse] = await Promise.all([
        samplePromise,
        fetchSampleResultsClient(sampleId),
    ])

    if (resultsResponse?.error) {
        throw new Error(resultsResponse.error)
    }

    return createSampleSelectionCoreData(sample, resultsResponse?.data ?? [])
}

export function useSampleSelectionCoreCache({
    sampleId,
    initialSample,
    initialResults = [],
}: UseSampleSelectionCoreCacheOptions = {}) {
    const queryClient = useQueryClient()

    useEffect(() => {
        if (!sampleId || !initialSample || initialSample.id !== sampleId) {
            return
        }

        queryClient.setQueryData(
            sampleKeys.selectionCore(sampleId),
            createSampleSelectionCoreData(initialSample, initialResults),
        )
    }, [initialResults, initialSample, queryClient, sampleId])

    const getCachedSampleCore = useCallback((targetSampleId: string) => {
        return (
            queryClient.getQueryData<SampleSelectionCoreData>(
                sampleKeys.selectionCore(targetSampleId),
            ) ?? null
        )
    }, [queryClient])

    const loadSampleCore = useCallback((targetSampleId: string) => {
        return queryClient.fetchQuery({
            queryKey: sampleKeys.selectionCore(targetSampleId),
            queryFn: () => fetchSampleSelectionCore(targetSampleId),
            staleTime: SAMPLE_SELECTION_CORE_STALE_TIME_MS,
            gcTime: SAMPLE_SELECTION_CORE_GC_TIME_MS,
        })
    }, [queryClient])

    return {
        getCachedSampleCore,
        loadSampleCore,
    }
}

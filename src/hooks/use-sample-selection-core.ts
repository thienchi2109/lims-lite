'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSampleResultsClient } from '@/lib/api-client'
import { sampleKeys } from '@/types/query-keys'
import type { ResultWithAssay, SampleWithUser } from '@/types'
import { fetchSampleDetail } from '@/hooks/use-sample-detail'

const SAMPLE_SELECTION_CORE_STALE_TIME_MS = 30 * 1000
const SAMPLE_SELECTION_CORE_GC_TIME_MS = 10 * 60 * 1000
const EMPTY_INITIAL_RESULTS: ResultWithAssay[] = []

export interface SampleSelectionCoreData {
    sample: SampleWithUser
    results?: ResultWithAssay[]
}

interface UseSampleSelectionCoreCacheOptions {
    sampleId?: string | null
    initialSample?: SampleWithUser | null
    initialResults?: ResultWithAssay[]
    includeResults?: boolean
}

export function createSampleSelectionCoreData(
    sample: SampleWithUser,
    results?: ResultWithAssay[],
): SampleSelectionCoreData {
    return {
        sample,
        results,
    }
}

export async function fetchSampleSelectionCore(
    sampleId: string,
    includeResults = true,
): Promise<SampleSelectionCoreData> {
    const samplePromise = fetchSampleDetail(sampleId)
    const resultsPromise = includeResults
        ? fetchSampleResultsClient(sampleId).catch(() => null)
        : Promise.resolve(null)
    const sample = await samplePromise
    const resultsResponse = await resultsPromise

    if (!resultsResponse || resultsResponse.error) {
        return createSampleSelectionCoreData(sample)
    }

    return createSampleSelectionCoreData(sample, resultsResponse.data ?? [])
}

export function useSampleSelectionCore({
    sampleId,
    initialSample,
    initialResults = EMPTY_INITIAL_RESULTS,
    includeResults = true,
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

    return useQuery({
        queryKey: sampleKeys.selectionCore(sampleId ?? ''),
        queryFn: async () => {
            if (!sampleId) {
                throw new Error('Sample ID is required')
            }

            return fetchSampleSelectionCore(sampleId, includeResults)
        },
        enabled: Boolean(sampleId),
        staleTime: SAMPLE_SELECTION_CORE_STALE_TIME_MS,
        gcTime: SAMPLE_SELECTION_CORE_GC_TIME_MS,
        placeholderData: (previousData) => previousData,
    })
}

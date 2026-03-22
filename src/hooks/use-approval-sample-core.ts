'use client'

import { useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchSampleResultsClient } from '@/lib/api-client'
import { approvalKeys } from '@/types/query-keys'
import type { ResultWithAssay, SampleWithUser } from '@/types'
import { fetchSampleDetail } from '@/hooks/use-sample-detail'

const APPROVAL_SAMPLE_CORE_STALE_TIME_MS = 30 * 1000
const APPROVAL_SAMPLE_CORE_GC_TIME_MS = 10 * 60 * 1000

export interface ApprovalSampleCoreData {
    sample: SampleWithUser
    results: ResultWithAssay[]
}

interface UseApprovalSampleCoreCacheOptions {
    sampleId?: string | null
    initialSample?: SampleWithUser | null
    initialResults?: ResultWithAssay[]
}

export function createApprovalSampleCoreData(
    sample: SampleWithUser,
    results: ResultWithAssay[] = [],
): ApprovalSampleCoreData {
    return {
        sample,
        results,
    }
}

export async function fetchApprovalSampleCore(sampleId: string): Promise<ApprovalSampleCoreData> {
    const [sample, resultsResponse] = await Promise.all([
        fetchSampleDetail(sampleId),
        fetchSampleResultsClient(sampleId),
    ])

    return createApprovalSampleCoreData(sample, resultsResponse?.data ?? [])
}

export function useApprovalSampleCoreCache({
    sampleId,
    initialSample,
    initialResults = [],
}: UseApprovalSampleCoreCacheOptions) {
    const queryClient = useQueryClient()

    useEffect(() => {
        if (!sampleId || !initialSample || initialSample.id !== sampleId) {
            return
        }

        queryClient.setQueryData(
            approvalKeys.detail(sampleId),
            createApprovalSampleCoreData(initialSample, initialResults),
        )
    }, [initialResults, initialSample, queryClient, sampleId])

    const getCachedSampleCore = useCallback((targetSampleId: string) => {
        return (
            queryClient.getQueryData<ApprovalSampleCoreData>(
                approvalKeys.detail(targetSampleId),
            ) ?? null
        )
    }, [queryClient])

    const loadSampleCore = useCallback((targetSampleId: string) => {
        return queryClient.fetchQuery({
            queryKey: approvalKeys.detail(targetSampleId),
            queryFn: () => fetchApprovalSampleCore(targetSampleId),
            staleTime: APPROVAL_SAMPLE_CORE_STALE_TIME_MS,
            gcTime: APPROVAL_SAMPLE_CORE_GC_TIME_MS,
        })
    }, [queryClient])

    return {
        getCachedSampleCore,
        loadSampleCore,
    }
}

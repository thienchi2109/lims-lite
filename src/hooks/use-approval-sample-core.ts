'use client'

import { useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
    fetchSampleResultsClient,
    fetchSampleSubmissionReviewClient,
} from '@/lib/api-client'
import { approvalKeys } from '@/types/query-keys'
import {
    SampleSubmissionReviewSchema,
    type ResultWithAssay,
    type SampleSubmissionReview,
    type SampleWithUser,
} from '@/types'
import { fetchSampleDetail } from '@/hooks/use-sample-detail'

const APPROVAL_SAMPLE_CORE_STALE_TIME_MS = 30 * 1000
const APPROVAL_SAMPLE_CORE_GC_TIME_MS = 10 * 60 * 1000
const EMPTY_SUBMISSION_REVIEW: SampleSubmissionReview = { submissions: [] }

export interface ApprovalSampleCoreData {
    sample: SampleWithUser
    results: ResultWithAssay[]
    submissionReview: SampleSubmissionReview
}

interface UseApprovalSampleCoreCacheOptions {
    sampleId?: string | null
    initialSample?: SampleWithUser | null
    initialResults?: ResultWithAssay[]
    initialSubmissionReview?: SampleSubmissionReview
}

export function createApprovalSampleCoreData(
    sample: SampleWithUser,
    results: ResultWithAssay[] = [],
    submissionReview: SampleSubmissionReview = EMPTY_SUBMISSION_REVIEW,
): ApprovalSampleCoreData {
    return {
        sample,
        results,
        submissionReview,
    }
}

export async function fetchApprovalSampleCore(sampleId: string): Promise<ApprovalSampleCoreData> {
    const [sample, resultsResponse, reviewResponse] = await Promise.all([
        fetchSampleDetail(sampleId),
        fetchSampleResultsClient(sampleId),
        fetchSampleSubmissionReviewClient(sampleId),
    ])

    if (reviewResponse.error) {
        throw new Error(reviewResponse.error)
    }

    const review = SampleSubmissionReviewSchema.parse(
        reviewResponse.data ?? { submissions: [] },
    )

    return createApprovalSampleCoreData(sample, resultsResponse?.data ?? [], review)
}

export function useApprovalSampleCoreCache({
    sampleId,
    initialSample,
    initialResults = [],
    initialSubmissionReview = EMPTY_SUBMISSION_REVIEW,
}: UseApprovalSampleCoreCacheOptions) {
    const queryClient = useQueryClient()

    useEffect(() => {
        if (!sampleId || !initialSample || initialSample.id !== sampleId) {
            return
        }

        queryClient.setQueryData(
            approvalKeys.detail(sampleId),
            createApprovalSampleCoreData(
                initialSample,
                initialResults,
                initialSubmissionReview,
            ),
        )
    }, [
        initialResults,
        initialSample,
        initialSubmissionReview,
        queryClient,
        sampleId,
    ])

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

'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchApprovalQueueClient } from '@/lib/api-client'
import { approvalKeys } from '@/types/query-keys'
import type { ApprovalQueueSample, ApprovalTab } from '@/types'
import { getOppositeApprovalTab } from '@/lib/approval-queue-url'

const APPROVAL_QUEUE_STALE_TIME_MS = 30 * 1000
const APPROVAL_QUEUE_GC_TIME_MS = 10 * 60 * 1000

interface UseApprovalQueueOptions {
    tab: ApprovalTab
    initialData?: ApprovalQueueSample[]
    initialDataTab?: ApprovalTab
    enabled?: boolean
}

async function fetchApprovalQueue(tab: ApprovalTab) {
    const result = await fetchApprovalQueueClient(tab)

    if ('error' in result) {
        throw new Error(String(result.error))
    }

    return result.data ?? []
}

export function useApprovalQueue({ tab, initialData, initialDataTab, enabled = true }: UseApprovalQueueOptions) {
    const queryClient = useQueryClient()
    const seededInitialData = initialData && (initialDataTab ?? tab) === tab ? initialData : undefined

    useEffect(() => {
        if (!seededInitialData) {
            return
        }

        queryClient.setQueryData(approvalKeys.list({ tab }), seededInitialData)
    }, [queryClient, seededInitialData, tab])

    const query = useQuery({
        queryKey: approvalKeys.list({ tab }),
        queryFn: () => fetchApprovalQueue(tab),
        enabled,
        initialData: seededInitialData,
        staleTime: APPROVAL_QUEUE_STALE_TIME_MS,
        gcTime: APPROVAL_QUEUE_GC_TIME_MS,
        placeholderData: () => queryClient.getQueryData<ApprovalQueueSample[]>(approvalKeys.list({ tab })),
    })

    useEffect(() => {
        if (!enabled || !query.isSuccess) {
            return
        }

        const oppositeTab = getOppositeApprovalTab(tab)

        void queryClient.prefetchQuery({
            queryKey: approvalKeys.list({ tab: oppositeTab }),
            queryFn: () => fetchApprovalQueue(oppositeTab),
            staleTime: APPROVAL_QUEUE_STALE_TIME_MS,
            gcTime: APPROVAL_QUEUE_GC_TIME_MS,
        })
    }, [enabled, query.isSuccess, queryClient, tab])

    return query
}

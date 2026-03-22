'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ApprovalTab } from '@/types'
import { resolveApprovalUrlState } from '@/lib/approval-queue-url'

interface UseApprovalUrlStateOptions {
    tab: ApprovalTab
    sampleId?: string | null
}

export function useApprovalUrlState({ tab, sampleId }: UseApprovalUrlStateOptions) {
    const [urlState, setUrlState] = useState(() =>
        resolveApprovalUrlState({
            fallbackTab: tab,
            fallbackSampleId: sampleId ?? null,
        }),
    )

    useEffect(() => {
        setUrlState(
            resolveApprovalUrlState({
                fallbackTab: tab,
                fallbackSampleId: sampleId ?? null,
            }),
        )
    }, [tab, sampleId])

    const setActiveTab = useCallback((nextTab: ApprovalTab) => {
        setUrlState((current) => ({
            ...current,
            tab: nextTab,
        }))
    }, [])

    const setUrlSampleId = useCallback((nextSampleId: string | null) => {
        setUrlState((current) => ({
            ...current,
            sampleId: nextSampleId,
        }))
    }, [])

    return {
        activeTab: urlState.tab,
        urlSampleId: urlState.sampleId,
        setActiveTab,
        setUrlSampleId,
    }
}

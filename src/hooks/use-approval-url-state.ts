'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApprovalTab } from '@/types'
import { resolveApprovalUrlState } from '@/lib/approval-queue-url'

interface UseApprovalUrlStateOptions {
    tab: ApprovalTab
    sampleId?: string | null
}

interface ApprovalUrlState {
    tab: ApprovalTab
    sampleId: string | null
}

interface LocalApprovalUrlOverride {
    base: ApprovalUrlState
    state: ApprovalUrlState
}

export function useApprovalUrlState({ tab, sampleId }: UseApprovalUrlStateOptions) {
    const resolvedUrlState = resolveApprovalUrlState({
        fallbackTab: tab,
        fallbackSampleId: sampleId ?? null,
    })
    const [localOverride, setLocalOverride] = useState<LocalApprovalUrlOverride | null>(null)

    const hasActiveLocalOverride =
        localOverride?.base.tab === resolvedUrlState.tab &&
        localOverride.base.sampleId === resolvedUrlState.sampleId
    const urlState = hasActiveLocalOverride ? localOverride.state : resolvedUrlState

    const resolvedUrlStateRef = useRef<ApprovalUrlState>(resolvedUrlState)
    const urlStateRef = useRef<ApprovalUrlState>(urlState)

    useEffect(() => {
        resolvedUrlStateRef.current = resolvedUrlState
        urlStateRef.current = urlState
    }, [resolvedUrlState, urlState])

    const setActiveTab = useCallback((nextTab: ApprovalTab) => {
        setLocalOverride({
            base: resolvedUrlStateRef.current,
            state: {
                ...urlStateRef.current,
                tab: nextTab,
            },
        })
    }, [])

    const setUrlSampleId = useCallback((nextSampleId: string | null) => {
        setLocalOverride({
            base: resolvedUrlStateRef.current,
            state: {
                ...urlStateRef.current,
                sampleId: nextSampleId,
            },
        })
    }, [])

    return {
        activeTab: urlState.tab,
        urlSampleId: urlState.sampleId,
        setActiveTab,
        setUrlSampleId,
    }
}

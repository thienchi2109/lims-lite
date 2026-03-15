'use client'

/**
 * ApprovalMobileLayout
 *
 * Orchestrates the mobile approval view at <1280px breakpoint.
 * Renders the mobile card list and manages the detail drawer state.
 * Used by page.tsx alongside the existing desktop layout via CSS breakpoints.
 */

import { useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ApprovalMobileList } from '@/components/approval-mobile-list'
import { ApprovalMobileDetail } from '@/components/approval-mobile-detail'
import type { ApprovalCardSample } from '@/components/approval-sample-card'
import type { SampleWithUser, ResultWithAssay } from '@/types'

interface ApprovalMobileLayoutProps {
    samples: ApprovalCardSample[]
    selectedSample: SampleWithUser | null
    results: ResultWithAssay[]
}

export function ApprovalMobileLayout({
    samples,
    selectedSample,
    results,
}: ApprovalMobileLayoutProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()

    const isDrawerOpen = selectedSample !== null

    const handleSelectSample = useCallback(
        (sampleId: string) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('sampleId', sampleId)
            router.replace(`${pathname}?${params.toString()}`)
        },
        [router, searchParams, pathname],
    )

    const handleCloseDrawer = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('sampleId')
        router.replace(`${pathname}?${params.toString()}`)
    }, [router, searchParams, pathname])

    return (
        <>
            {/* Mobile card list */}
            <ApprovalMobileList
                samples={samples}
                selectedSampleId={selectedSample?.id ?? null}
                onSelectSample={handleSelectSample}
            />

            {/* Detail drawer */}
            <ApprovalMobileDetail
                sample={selectedSample}
                results={results}
                open={isDrawerOpen}
                onClose={handleCloseDrawer}
            />
        </>
    )
}

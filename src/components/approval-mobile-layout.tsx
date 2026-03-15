'use client'

/**
 * ApprovalMobileLayout
 *
 * Orchestrates the mobile approval view at <1280px breakpoint.
 * Renders tab switcher, mobile card list, and detail drawer.
 * Used by page.tsx alongside the existing desktop layout via CSS breakpoints.
 */

import { useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ApprovalMobileList } from '@/components/approval-mobile-list'
import { ApprovalMobileDetail } from '@/components/approval-mobile-detail'
import type { ApprovalCardSample } from '@/components/approval-sample-card'
import type { SampleWithUser, ResultWithAssay } from '@/types'

interface ApprovalMobileLayoutProps {
    samples: ApprovalCardSample[]
    selectedSample: SampleWithUser | null
    results: ResultWithAssay[]
    tab: 'review' | 'completed'
    reviewCount: number
}

export function ApprovalMobileLayout({
    samples,
    selectedSample,
    results,
    tab,
    reviewCount,
}: ApprovalMobileLayoutProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()

    const isDrawerOpen = selectedSample !== null

    const handleTabChange = useCallback(
        (newTab: string) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('tab', newTab)
            params.delete('sampleId')
            router.replace(`${pathname}?${params.toString()}`)
        },
        [router, searchParams, pathname],
    )

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
            {/* Tab switcher */}
            <Tabs value={tab} onValueChange={handleTabChange} className="mb-3">
                <TabsList className="w-full">
                    <TabsTrigger value="review" className="flex-1 gap-1.5" data-testid="tab-review">
                        Chờ duyệt KQ
                        {reviewCount > 0 && (
                            <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]">
                                {reviewCount}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="flex-1" data-testid="tab-completed">
                        Đã duyệt KQ
                    </TabsTrigger>
                </TabsList>
            </Tabs>

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

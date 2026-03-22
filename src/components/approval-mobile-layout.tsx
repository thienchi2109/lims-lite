'use client'

/**
 * ApprovalMobileLayout
 *
 * Orchestrates the mobile approval view at <1280px breakpoint.
 * Renders tab switcher, mobile card list, and detail drawer.
 * Used by page.tsx alongside the existing desktop layout via CSS breakpoints.
 */

import { useCallback, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ApprovalMobileList } from '@/components/approval-mobile-list'
import { ApprovalMobileDetail } from '@/components/approval-mobile-detail'
import { useApprovalQueue } from '@/hooks/use-approval-queue'
import { useApprovalUrlState } from '@/hooks/use-approval-url-state'
import { buildApprovalQueueUrl, replaceApprovalQueueUrl } from '@/lib/approval-queue-url'
import type { SampleWithUser, ResultWithAssay, ApprovalQueueSample, ApprovalTab } from '@/types'
import { ApprovalQueueErrorState } from '@/components/approval-queue-error-state'
import { ApprovalPageHeader } from '@/components/approval-page-header'

interface ApprovalMobileLayoutProps {
    samples: ApprovalQueueSample[]
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
    const pathname = usePathname()
    const serverSampleId = selectedSample?.id ?? null
    const { activeTab, setActiveTab, urlSampleId, setUrlSampleId } = useApprovalUrlState({
        tab,
        sampleId: serverSampleId,
    })
    const [closedSampleId, setClosedSampleId] = useState<string | null>(null)
    const approvalQueue = useApprovalQueue({
        tab: activeTab,
        initialData: samples,
        initialDataTab: tab,
    })

    const isDrawerOpen = selectedSample !== null && selectedSample.id === urlSampleId && selectedSample.id !== closedSampleId
    const queueSamples = approvalQueue.data ?? (activeTab === tab ? samples : [])

    const handleTabChange = useCallback(
        (newTab: string) => {
            const nextTab = newTab as ApprovalTab
            setActiveTab(nextTab)
            setUrlSampleId(null)
            setClosedSampleId(selectedSample?.id ?? null)

            const url = buildApprovalQueueUrl({
                pathname,
                tab: nextTab,
            })
            replaceApprovalQueueUrl(url)
        },
        [pathname, selectedSample?.id, setActiveTab, setUrlSampleId],
    )

    const handleSelectSample = useCallback(
        (sampleId: string) => {
            if (sampleId === closedSampleId) {
                setClosedSampleId(null)
            }
            setUrlSampleId(sampleId)

            const url = buildApprovalQueueUrl({
                pathname,
                tab: activeTab,
                sampleId,
            })
            router.replace(url)
        },
        [router, pathname, activeTab, closedSampleId, setUrlSampleId],
    )

    const handleCloseDrawer = useCallback(() => {
        setUrlSampleId(null)
        setClosedSampleId(selectedSample?.id ?? null)
        const url = buildApprovalQueueUrl({
            pathname,
            tab: activeTab,
        })
        router.replace(url)
    }, [router, pathname, activeTab, selectedSample?.id, setUrlSampleId])

    return (
        <div className="flex flex-1 min-h-0 flex-col gap-2">
            <ApprovalPageHeader samplesCount={queueSamples.length} tab={activeTab} />

            {/* Tab switcher */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-3">
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

            {approvalQueue.isError ? (
                <ApprovalQueueErrorState />
            ) : (
                <>
                    {/* Mobile card list */}
                    <ApprovalMobileList
                        samples={queueSamples}
                        selectedSampleId={urlSampleId}
                        onSelectSample={handleSelectSample}
                        tab={activeTab}
                    />

                    {/* Detail drawer */}
                    <ApprovalMobileDetail
                        sample={selectedSample}
                        results={results}
                        open={isDrawerOpen}
                        onClose={handleCloseDrawer}
                    />
                </>
            )}
        </div>
    )
}

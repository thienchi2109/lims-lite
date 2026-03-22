'use client'

/**
 * ApprovalMobileLayout
 *
 * Orchestrates the mobile approval view at <1280px breakpoint.
 * Renders tab switcher, mobile card list, and detail drawer.
 * Used by page.tsx alongside the existing desktop layout via CSS breakpoints.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ApprovalMobileList } from '@/components/approval-mobile-list'
import { ApprovalMobileDetail } from '@/components/approval-mobile-detail'
import { useApprovalSampleCoreCache } from '@/hooks/use-approval-sample-core'
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
    const pathname = usePathname()
    const serverSampleId = selectedSample?.id ?? null
    const { activeTab, setActiveTab, urlSampleId, setUrlSampleId } = useApprovalUrlState({
        tab,
        sampleId: serverSampleId,
    })
    const hasServerSelection = Boolean(urlSampleId && selectedSample?.id === urlSampleId)
    const [closedSampleId, setClosedSampleId] = useState<string | null>(null)
    const [activeSample, setActiveSample] = useState<SampleWithUser | null>(
        hasServerSelection ? selectedSample : null,
    )
    const [activeResults, setActiveResults] = useState<ResultWithAssay[]>(
        hasServerSelection ? results : [],
    )
    const [isLoadingSample, setIsLoadingSample] = useState(false)
    const [sampleLoadError, setSampleLoadError] = useState<string | null>(null)
    const sampleRequestIdRef = useRef(0)
    const isClientSelectionRef = useRef(false)
    const { getCachedSampleCore, loadSampleCore } = useApprovalSampleCoreCache({
        sampleId: serverSampleId,
        initialSample: selectedSample,
        initialResults: results,
    })
    const approvalQueue = useApprovalQueue({
        tab: activeTab,
        initialData: samples,
        initialDataTab: tab,
    })

    const isDrawerOpen =
        urlSampleId !== null &&
        urlSampleId !== closedSampleId &&
        (
            (activeSample !== null && activeSample.id === urlSampleId) ||
            isLoadingSample ||
            sampleLoadError !== null
        )
    const queueSamples = approvalQueue.data ?? (activeTab === tab ? samples : [])

    const applyActiveDetail = useCallback(
        (nextDetail: { sample: SampleWithUser; results: ResultWithAssay[] } | null) => {
            setActiveSample(nextDetail?.sample ?? null)
            setActiveResults(nextDetail?.results ?? [])
        },
        [],
    )

    useEffect(() => {
        const serverSelectionMatchesUrl = urlSampleId === serverSampleId
        if (isClientSelectionRef.current && !serverSelectionMatchesUrl) {
            return
        }

        sampleRequestIdRef.current += 1
        applyActiveDetail(
            hasServerSelection && selectedSample
                ? { sample: selectedSample, results }
                : null,
        )
        setSampleLoadError(null)
        setIsLoadingSample(false)
        isClientSelectionRef.current = false
    }, [
        applyActiveDetail,
        hasServerSelection,
        results,
        selectedSample,
        serverSampleId,
        urlSampleId,
    ])

    const handleTabChange = useCallback(
        (newTab: string) => {
            const nextTab = newTab as ApprovalTab
            setActiveTab(nextTab)
            setUrlSampleId(null)
            setClosedSampleId(activeSample?.id ?? null)
            isClientSelectionRef.current = false
            sampleRequestIdRef.current += 1
            applyActiveDetail(null)
            setSampleLoadError(null)
            setIsLoadingSample(false)

            const url = buildApprovalQueueUrl({
                pathname,
                tab: nextTab,
            })
            replaceApprovalQueueUrl(url)
        },
        [activeSample?.id, applyActiveDetail, pathname, setActiveTab, setUrlSampleId],
    )

    const handleSelectSample = useCallback(
        async (sampleId: string) => {
            if (sampleId === urlSampleId && !sampleLoadError) {
                return
            }

            if (sampleId === closedSampleId) {
                setClosedSampleId(null)
            }

            isClientSelectionRef.current = true
            setUrlSampleId(sampleId)
            setSampleLoadError(null)

            const url = buildApprovalQueueUrl({
                pathname,
                tab: activeTab,
                sampleId,
            })

            replaceApprovalQueueUrl(url)

            const requestId = sampleRequestIdRef.current + 1
            sampleRequestIdRef.current = requestId
            const cachedSampleCore = getCachedSampleCore(sampleId)

            if (cachedSampleCore) {
                applyActiveDetail(cachedSampleCore)
            }

            setIsLoadingSample(!cachedSampleCore)

            try {
                const sampleCore = await loadSampleCore(sampleId)

                if (sampleRequestIdRef.current !== requestId) {
                    return
                }

                applyActiveDetail(sampleCore)
                setIsLoadingSample(false)
            } catch (error) {
                if (sampleRequestIdRef.current !== requestId) {
                    return
                }

                console.error('Failed to load mobile approval sample detail:', error)
                if (!cachedSampleCore) {
                    applyActiveDetail(null)
                }
                setSampleLoadError('Không thể tải chi tiết mẫu. Vui lòng thử lại.')
                setIsLoadingSample(false)
            }
        },
        [
            activeTab,
            applyActiveDetail,
            closedSampleId,
            getCachedSampleCore,
            loadSampleCore,
            pathname,
            sampleLoadError,
            setUrlSampleId,
            urlSampleId,
        ],
    )

    const handleCloseDrawer = useCallback(() => {
        isClientSelectionRef.current = false
        sampleRequestIdRef.current += 1
        setUrlSampleId(null)
        setClosedSampleId(activeSample?.id ?? urlSampleId)
        setSampleLoadError(null)
        setIsLoadingSample(false)
        const url = buildApprovalQueueUrl({
            pathname,
            tab: activeTab,
        })
        replaceApprovalQueueUrl(url)
    }, [activeSample?.id, activeTab, pathname, setUrlSampleId, urlSampleId])

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
                        sample={activeSample}
                        results={activeResults}
                        open={isDrawerOpen}
                        onClose={handleCloseDrawer}
                        isLoadingSample={isLoadingSample}
                        loadErrorMessage={sampleLoadError}
                    />
                </>
            )}
        </div>
    )
}

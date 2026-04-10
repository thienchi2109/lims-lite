'use client'

import { Suspense } from 'react'
import { useSamples } from '@/hooks/use-samples'
import { SampleListTable } from '@/components/sample-list-table'
import { SampleFilters } from '@/components/sample-filters'
import { DesktopMasterDetailShell } from '@/components/desktop-master-detail-shell'
import { SampleInspectorColumn } from '@/components/sample-inspector-column'
import { type SampleStatus } from '@/types'
import { useSampleSelectionCore } from '@/hooks/use-sample-selection-core'
import type { LabSpecialty } from '@/types'
import { isValidUUID } from '@/lib/utils-lims'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

interface SamplesPageClientProps {
    role: 'analyst' | 'manager' | 'doctor'
    permissions: {
        canDiscard: boolean
        canEdit: boolean
        canViewResults: boolean
        canEnterResults: boolean
    }
    homeHref: string
    receiverOptions: Array<{ id: string; name: string }>
    specialties: LabSpecialty[]
}

export function SamplesPageClient({
    role,
    permissions,
    homeHref,
    receiverOptions,
    specialties
}: SamplesPageClientProps) {
    const searchParams = useSearchParams()
    const isDoctor = role === 'doctor'

    // Parse URL params
    const searchTerm = searchParams.get('search') || ''
    const scope = isDoctor
        ? 'all'
        : searchParams.get('scope') === 'all' ? 'all' : 'active'
    const statusParam = searchParams.get('status') || 'all'
    const validStatuses: SampleStatus[] = ['received', 'assigned', 'in_progress', 'review', 'completed', 'discarded']
    const status = isDoctor
        ? 'completed'
        : validStatuses.includes(statusParam as SampleStatus)
        ? (statusParam as SampleStatus)
        : undefined

    const pageParam = Number(searchParams.get('page') || '1')
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1

    const pageSizeParam = Number(searchParams.get('pageSize') || '20')
    const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? pageSizeParam : 20

    const fromDate = searchParams.get('fromDate') || ''
    const toDate = searchParams.get('toDate') || ''
    const sortBy = searchParams.get('sortBy') || 'updated_at'
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

    const receiverIdParam = searchParams.get('receiverId') || ''
    const receiverId = isValidUUID(receiverIdParam) ? receiverIdParam : ''

    // Parse specialty IDs (comma-separated UUIDs)
    const specialtyIdsParam = searchParams.get('specialtyIds') || ''
    const specialtyIds = specialtyIdsParam
        .split(',')
        .filter(isValidUUID)

    const sampleId = searchParams.get('sampleId') || undefined
    const {
        data: selectedSampleCore,
        error: selectedSampleError,
        isLoading: isLoadingSelectedSampleCore,
        isFetching: isFetchingSelectedSampleCore,
        isPlaceholderData,
    } = useSampleSelectionCore({
        sampleId,
        includeResults: !isDoctor,
    })

    // Fetch samples with TanStack Query
    const { data: result, isLoading, error } = useSamples({
        params: {
            page,
            pageSize,
            search: searchTerm || undefined,
            scope,
            status,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
            sortBy,
            sortOrder: sortOrder as 'asc' | 'desc',
            receiverId: receiverId || undefined,
            specialtyIds: specialtyIds.length > 0 ? specialtyIds.join(',') : undefined,
        }
    })

    // Handle loading and error states
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-sm text-slate-500">Đang tải danh sách mẫu...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-sm text-destructive">Lỗi: {error instanceof Error ? error.message : 'Không thể tải danh sách mẫu'}</div>
            </div>
        )
    }

    const samples = result?.data || []
    const totalPages = result?.totalPages || 1
    const totalCount = result?.count || 0
    const activeSampleCore = sampleId ? selectedSampleCore ?? null : null
    const isSwitchingSamples = Boolean(
        sampleId &&
        activeSampleCore &&
        activeSampleCore.sample.id !== sampleId &&
        (isFetchingSelectedSampleCore || isPlaceholderData),
    )
    const isLoadingSample = Boolean(
        sampleId &&
        ((isLoadingSelectedSampleCore && !activeSampleCore) || isSwitchingSamples),
    )
    const loadErrorMessage = selectedSampleError
        ? 'Không thể tải chi tiết mẫu. Vui lòng thử lại.'
        : null

    return (
        <main className="flex-1 flex flex-col min-h-0 p-2 sm:px-4 gap-2">
            <div className="flex items-center gap-4 shrink-0">
                <Link href={homeHref}>
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        {isDoctor ? 'Quản lý mẫu' : 'Quay lại Bảng điều khiển'}
                    </Button>
                </Link>
            </div>

            <DesktopMasterDetailShell
                workspaceTestId="samples-workspace"
                gridColumnTestId="samples-grid-column"
                inspectorColumnTestId="samples-inspector-column"
                gridColumnClassName="gap-2"
                left={(
                    <>
                        <div className="shrink-0 flex flex-col gap-2">
                            <Suspense fallback={<div className="text-sm text-slate-500">Đang tải bộ lọc...</div>}>
                                <SampleFilters
                                    receiverOptions={receiverOptions}
                                    specialties={specialties}
                                    completedOnly={isDoctor}
                                />
                            </Suspense>
                        </div>
                        <div className="min-h-[400px] flex-1 min-h-0">
                            <SampleListTable
                                samples={samples}
                                page={result?.page || page}
                                pageSize={result?.pageSize || pageSize}
                                totalPages={totalPages}
                                totalCount={totalCount}
                                searchParams={searchParams.toString()}
                                error={result?.error || null}
                                permissions={permissions}
                                sortBy={sortBy}
                                sortOrder={sortOrder as 'asc' | 'desc'}
                                selectedSampleId={sampleId}
                            />
                        </div>
                    </>
                )}
                right={(
                    <SampleInspectorColumn
                        sample={activeSampleCore?.sample ?? null}
                        results={activeSampleCore?.results}
                        isLoadingSample={isLoadingSample}
                        loadErrorMessage={loadErrorMessage}
                        permissions={permissions}
                        specialties={specialties}
                        userRole={role}
                    />
                )}
            />
        </main>
    )
}

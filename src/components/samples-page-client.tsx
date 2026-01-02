'use client'

import { useSamples } from '@/hooks/use-samples'
import { useSampleDetail } from '@/hooks/use-sample-detail'
import { SampleListTable } from '@/components/sample-list-table'
import { SampleFilters } from '@/components/sample-filters'
import { SampleBottomRow } from '@/components/sample-bottom-row'
import { type SampleStatus } from '@/types'
import type { LabSpecialty } from '@/types'
import { isValidUUID } from '@/lib/utils-lims'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface SamplesPageClientProps {
    role: 'analyst' | 'manager'
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

    // Parse URL params
    const searchTerm = searchParams.get('search') || ''
    const statusParam = searchParams.get('status') || 'all'
    const validStatuses: SampleStatus[] = ['received', 'assigned', 'in_progress', 'review', 'completed', 'discarded']
    const status = validStatuses.includes(statusParam as SampleStatus)
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

    // Fetch samples with TanStack Query
    const { data: result, isLoading, error } = useSamples({
        params: {
            page,
            pageSize,
            search: searchTerm || undefined,
            status,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
            sortBy,
            sortOrder: sortOrder as 'asc' | 'desc',
            receiverId: receiverId || undefined,
            specialtyIds: specialtyIds.length > 0 ? specialtyIds.join(',') : undefined,
        }
    })

    // Fetch selected sample with TanStack Query hook
    const {
        data: selectedSampleData,
        isLoading: isLoadingSample
    } = useSampleDetail({
        sampleId: sampleId || null,
        enabled: !!sampleId
    })

    const selectedSample = selectedSampleData || null

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

    return (
        <main className="flex-1 flex flex-col min-h-0 p-2 sm:px-4 gap-2">
            <div className="flex items-center gap-4 shrink-0">
                <Link href={homeHref}>
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Quay lại Bảng điều khiển
                    </Button>
                </Link>
            </div>

            {/* Top Row: Filters & Grid (Fixed Height ~50%) */}
            <div className="flex flex-col gap-2 h-[50vh] min-h-[400px] shrink-0">
                <div className="shrink-0 flex flex-col gap-2">
                    <Suspense fallback={<div className="text-sm text-slate-500">Đang tải bộ lọc...</div>}>
                        <SampleFilters
                            receiverOptions={receiverOptions}
                            specialties={specialties}
                        />
                    </Suspense>
                </div>
                <div className="flex-1 min-h-0">
                    <SampleListTable
                        samples={samples}
                        page={result?.page || page}
                        pageSize={result?.pageSize || pageSize}
                        totalPages={totalPages}
                        totalCount={totalCount}
                        error={result?.error || null}
                        permissions={permissions}
                        sortBy={sortBy}
                        sortOrder={sortOrder as 'asc' | 'desc'}
                        selectedSampleId={selectedSample?.id}
                    />
                </div>
            </div>

            {/* Bottom Row: Detail & Assignments (Remaining Height) */}
            <div className="flex-1 min-h-0 border-t pt-4">
                <SampleBottomRow
                    sample={selectedSample}
                    isLoadingSample={isLoadingSample}
                    permissions={permissions}
                    specialties={specialties}
                    userRole={role}
                />
            </div>
        </main>
    )
}

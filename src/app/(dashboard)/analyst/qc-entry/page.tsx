import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchQCEntryData, fetchQCDetailData } from '@/lib/data/qc-entry'
import { QCEntryHeader } from '@/components/qc-entry/qc-entry-header'
import { SpecialtyFilter, type SpecialtyWithQC } from '@/components/qc-entry/specialty-filter'
import { QCAssayTable } from '@/components/qc-entry/qc-assay-table'
import { QCDetailSheet } from '@/components/qc-entry/qc-detail-sheet'
import { type AssayWithQC } from '@/components/qc-entry/qc-table-row'
import { type MiniChartDataPoint } from '@/components/qc-entry/qc-sparkline'
import { type QCHistoryEntry } from '@/components/qc-entry/qc-recent-history'

export const metadata: Metadata = {
    title: 'Kiểm soát chất lượng nội bộ - CDC LIMS',
    description: 'Nhập kết quả kiểm soát chất lượng (IQC) theo xét nghiệm',
}

interface SearchParams {
    specialty?: string
    id?: string
    page?: string
}

interface Props {
    searchParams: Promise<SearchParams>
}

export default async function QCEntryPage({ searchParams }: Props) {
    const supabase = await createClient()
    const params = await searchParams

    // Auth check
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Parse pagination params
    const page = Math.max(1, parseInt(params.page || '1', 10))
    const pageSize = 20 // Fixed at 20 items per page

    // Parallel fetch for user data, specialties, and paginated QC data
    const [
        { data: userData, error: userError },
        { data: specialties, error: specialtiesError },
        qcResult,
    ] = await Promise.all([
        supabase.from('users').select('full_name, role').eq('id', user.id).single(),
        supabase.from('lab_specialties').select('id, name').order('name'),
        fetchQCEntryData({ page, pageSize, specialty: params.specialty }),
    ])

    // Error handling for database queries
    if (userError) {
        console.error('User fetch failed:', userError)
        redirect('/error?message=Failed+to+load+user')
    }
    if (specialtiesError) {
        console.error('Specialties fetch failed:', specialtiesError)
        redirect('/error?message=Failed+to+load+specialties')
    }
    if ('error' in qcResult) {
        redirect(`/error?message=${encodeURIComponent(qcResult.error)}`)
    }

    if (!userData || userData.role !== 'analyst') {
        redirect('/manager')
    }

    const { data: filteredAssays, qcResultsByDefinition, count, totalPages } = qcResult

    // Fetch accurate specialty counts (lightweight query for filter badges)
    const { data: allQCDefs } = await supabase
        .from('qc_definitions')
        .select('id, assay:assay_definitions!inner(specialty_id)')
        .eq('is_active', true)

    // Build specialty map with accurate counts
    const specialtyMap = new Map<string, SpecialtyWithQC>()
    for (const spec of specialties || []) {
        const qcCount =
            allQCDefs?.filter((d) => {
                const assay = Array.isArray(d.assay) ? d.assay[0] : d.assay
                return assay?.specialty_id === spec.id
            }).length || 0

        specialtyMap.set(spec.id, { id: spec.id, name: spec.name, qc_count: qcCount })
    }

    const specialtiesWithCounts = Array.from(specialtyMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name, 'vi')
    )

    // Build detail sheet data if ID is selected
    let selectedAssay: AssayWithQC | undefined
    let qcDataPoints: Array<MiniChartDataPoint & { measuredAt: string }> = []
    let recentHistory: QCHistoryEntry[] = []

    if (params.id) {
        selectedAssay = filteredAssays.find((a) => a.id === params.id)
        if (selectedAssay) {
            const detailResult = await fetchQCDetailData(params.id)
            if ('error' in detailResult) {
                console.error('Detail fetch failed:', detailResult.error)
            } else {
                qcDataPoints = detailResult.qcDataPoints
                recentHistory = detailResult.recentHistory
            }
        }
    }

    return (
        <div className="container mx-auto max-w-7xl space-y-6 p-6">
            <QCEntryHeader user={userData} />
            <SpecialtyFilter
                specialties={specialtiesWithCounts}
                activeSpecialty={params.specialty || null}
            />
            <QCAssayTable
                assays={filteredAssays}
                selectedId={params.id || null}
                qcResultsByDefinition={qcResultsByDefinition}
                activeSpecialty={params.specialty || null}
                page={page}
                pageSize={pageSize}
                totalPages={totalPages}
                totalCount={count}
            />
            {params.id && selectedAssay && (
                <QCDetailSheet
                    assay={selectedAssay}
                    qcDataPoints={qcDataPoints}
                    recentHistory={recentHistory}
                    activeSpecialty={params.specialty || null}
                    page={page}
                />
            )}
        </div>
    )
}

import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
}

interface Props {
    searchParams: Promise<SearchParams>
}

interface QCDefinitionWithRelations {
    id: string
    mean: number
    sd: number
    assay: { id: string; name: string; units: string; specialty_id: string }
    material: { name: string; level: string; lot_number: string; level_normalized: string }
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

    // Parallel fetch for independent queries
    const [
        { data: userData, error: userError },
        { data: specialties, error: specialtiesError },
        { data: assaysWithQC, error: assaysError },
        { data: activeSessions, error: sessionsError },
    ] = await Promise.all([
        supabase.from('users').select('full_name, role').eq('id', user.id).single(),
        supabase.from('lab_specialties').select('id, name').order('name'),
        supabase
            .from('qc_definitions')
            .select(`
                id,
                mean,
                sd,
                assay:assay_definitions!inner(id, name, units, specialty_id),
                material:qc_materials!inner(name, level, level_normalized, lot_number)
            `)
            .eq('is_active', true),
        supabase.from('qc_sessions').select('id, assay_id, qc_status').is('ended_at', null),
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
    if (assaysError) {
        console.error('Assays fetch failed:', assaysError)
        redirect('/error?message=Failed+to+load+assays')
    }
    if (sessionsError) {
        console.error('Sessions fetch failed:', sessionsError)
        redirect('/error?message=Failed+to+load+sessions')
    }

    if (!userData || userData.role !== 'analyst') {
        redirect('/manager')
    }

    // Fetch recent QC results
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const definitionIds = (assaysWithQC || []).map((d) => d.id)
    const { data: recentQCResults } =
        definitionIds.length > 0
            ? await supabase
                  .from('qc_results')
                  .select('id, definition_id, value, status, measured_at')
                  .in('definition_id', definitionIds)
                  .gte('measured_at', thirtyDaysAgo.toISOString())
                  .order('measured_at', { ascending: true })
            : { data: [] }

    // Group QC results by definition_id
    const qcResultsByDefinition: Record<string, MiniChartDataPoint[]> = {}
    for (const result of recentQCResults || []) {
        const defId = result.definition_id
        if (!qcResultsByDefinition[defId]) {
            qcResultsByDefinition[defId] = []
        }
        if (qcResultsByDefinition[defId].length < 15) {
            qcResultsByDefinition[defId].push({
                value: result.value,
                status: result.status,
            })
        }
    }

    // Build specialty map
    const specialtyMap = new Map<string, SpecialtyWithQC>()
    for (const spec of specialties || []) {
        specialtyMap.set(spec.id, { id: spec.id, name: spec.name, qc_count: 0 })
    }

    // Transform assays and count per specialty
    const assayList: AssayWithQC[] = []
    for (const def of assaysWithQC || []) {
        const rawAssay = def.assay as QCDefinitionWithRelations['assay'] | QCDefinitionWithRelations['assay'][]
        const assay = Array.isArray(rawAssay) ? rawAssay[0] : rawAssay
        const rawMaterial = def.material as QCDefinitionWithRelations['material'] | QCDefinitionWithRelations['material'][]
        const material = Array.isArray(rawMaterial) ? rawMaterial[0] : rawMaterial

        if (!assay || !material) continue

        const session = activeSessions?.find((s) => s.assay_id === assay.id)

        const level = material.level_normalized as 'L1' | 'L2'

        // Transform qc_status: null/pending/entered/approved
        const status = session?.qc_status === 'approved'
            ? 'approved'
            : session?.qc_status === 'entered'
              ? 'entered'
              : 'pending'

        assayList.push({
            id: def.id,
            name: assay.name,
            level,
            status,
            mean: def.mean,
            sd: def.sd,
            specialty_id: assay.specialty_id,
        })

        const spec = specialtyMap.get(assay.specialty_id)
        if (spec) spec.qc_count++
    }

    const specialtiesWithCounts = Array.from(specialtyMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name, 'vi')
    )

    // Filter assays by selected specialty
    const filteredAssays = params.specialty
        ? assayList.filter((a) => a.specialty_id === params.specialty)
        : assayList

    // Build detail sheet data if ID is selected
    let selectedAssay: AssayWithQC | undefined
    let qcDataPoints: Array<MiniChartDataPoint & { measuredAt: string }> = []
    let recentHistory: QCHistoryEntry[] = []

    if (params.id) {
        selectedAssay = assayList.find((a) => a.id === params.id)
        if (selectedAssay) {
            // Get full data points with timestamps for this definition
            const { data: resultsData, error: resultsError } = await supabase
                .from('qc_results')
                .select('value, status, measured_at')
                .eq('definition_id', params.id)
                .gte('measured_at', thirtyDaysAgo.toISOString())
                .order('measured_at', { ascending: false })
                .limit(15)

            if (resultsError) {
                console.error('QC results fetch failed:', resultsError)
                redirect('/error?message=Failed+to+load+QC+results')
            }

            qcDataPoints = (resultsData || []).map((r) => ({
                value: r.value,
                status: r.status,
                measuredAt: r.measured_at,
            }))

            recentHistory = qcDataPoints.slice(0, 5).map((dp) => ({
                date: new Date(dp.measuredAt).toLocaleDateString('vi-VN'),
                value: dp.value,
                status: dp.status,
            }))
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
            />
            {params.id && selectedAssay && (
                <QCDetailSheet
                    assay={selectedAssay}
                    qcDataPoints={qcDataPoints}
                    recentHistory={recentHistory}
                />
            )}
        </div>
    )
}

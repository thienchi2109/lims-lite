import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QCEntryPageClient } from '@/components/qc/qc-entry-page-client'
import type { MiniChartDataPoint } from '@/app/actions/qc-analytics'

export const metadata: Metadata = {
    title: 'Kiểm soát chất lượng nội bộ - CDC LIMS',
    description: 'Nhập kết quả kiểm soát chất lượng (IQC) theo xét nghiệm',
}

// Type for specialty with QC count
interface SpecialtyWithQC {
    id: string
    name: string
    qc_count: number
}

// Type for assay with QC definition data
interface AssayWithQC {
    id: string
    name: string
    units: string | null
    specialty_id: string
    definition_id: string
    mean: number
    sd: number
    material_name: string
    material_level: string
    lot_number: string
    session_id: string | null
    qc_status: string | null
}

export default async function QCEntryPage() {
    const supabase = await createClient()

    // Auth check
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Parallel fetch for independent queries (performance optimization)
    const [
        { data: userData },
        { data: specialties },
        { data: assaysWithQC },
        { data: activeSessions },
    ] = await Promise.all([
        // User role check
        supabase
            .from('users')
            .select('full_name, role')
            .eq('id', user.id)
            .single(),
        // All specialties for tab headers
        supabase
            .from('lab_specialties')
            .select('id, name')
            .order('name'),
        // Assays with active QC definitions
        supabase
            .from('qc_definitions')
            .select(`
                id,
                mean,
                sd,
                assay:assay_definitions!inner(
                    id,
                    name,
                    units,
                    specialty_id
                ),
                material:qc_materials!inner(
                    name,
                    level,
                    lot_number
                )
            `)
            .eq('is_active', true),
        // Active QC sessions for all assays
        supabase
            .from('qc_sessions')
            .select('id, assay_id, qc_status')
            .is('ended_at', null),
    ])

    // Role check - analyst only (after parallel fetch completes)
    if (!userData || userData.role !== 'analyst') {
        redirect('/manager')
    }

    // Sequential fetch - depends on assaysWithQC result
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const definitionIds = (assaysWithQC || []).map(d => d.id)
    const { data: recentQCResults } = definitionIds.length > 0
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
        // Keep max 15 points per definition
        if (qcResultsByDefinition[defId].length < 15) {
            qcResultsByDefinition[defId].push({
                id: result.id,
                value: result.value,
                status: result.status,
                measuredAt: result.measured_at,
            })
        }
    }

    // Build specialty data with QC counts
    const specialtyMap = new Map<string, SpecialtyWithQC>()

    for (const spec of specialties || []) {
        specialtyMap.set(spec.id, {
            id: spec.id,
            name: spec.name,
            qc_count: 0,
        })
    }

    // Transform assay data and count per specialty
    const assayList: AssayWithQC[] = []

    for (const def of assaysWithQC || []) {
        // Supabase !inner join returns single object, but TS infers array
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawAssay = def.assay as any
        const assay = Array.isArray(rawAssay) ? rawAssay[0] : rawAssay
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawMaterial = def.material as any
        const material = Array.isArray(rawMaterial) ? rawMaterial[0] : rawMaterial

        if (!assay || !material) continue

        // Find active session for this assay
        const session = activeSessions?.find(s => s.assay_id === assay.id)

        assayList.push({
            id: assay.id,
            name: assay.name,
            units: assay.units,
            specialty_id: assay.specialty_id,
            definition_id: def.id,
            mean: def.mean,
            sd: def.sd,
            material_name: material.name,
            material_level: material.level,
            lot_number: material.lot_number,
            session_id: session?.id ?? null,
            qc_status: session?.qc_status ?? null,
        })

        // Increment specialty QC count
        const spec = specialtyMap.get(assay.specialty_id)
        if (spec) {
            spec.qc_count++
        }
    }

    // Sort assays by name
    assayList.sort((a, b) => a.name.localeCompare(b.name, 'vi'))

    // Convert specialties to array, keeping all tabs (grayed if no QC)
    const specialtiesWithCounts = Array.from(specialtyMap.values())
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'))

    return (
        <div className="container mx-auto max-w-7xl space-y-6 p-6">
            <QCEntryPageClient
                user={userData}
                specialties={specialtiesWithCounts}
                assays={assayList}
                qcResultsByDefinition={qcResultsByDefinition}
            />
        </div>
    )
}

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { QCResultStatus } from '@/types/qc'
import { Button } from '@/components/ui/button'
import { DashboardHeader } from '@/components/dashboard-header'
import { ArrowLeft } from 'lucide-react'
import { QualityControlPageClient } from '@/components/qc/quality-control-page-client'
import { getQCMaterials, getQCDefinitionsPaginated, type GetQCMaterialsParams } from '@/app/actions/qc-setup'
import { getQCSessionsPaginated } from '@/app/actions/qc-sessions'

interface PageSearchParams {
    qc_days?: string
    // Materials tab pagination & filtering
    mat_page?: string
    mat_size?: string
    mat_search?: string
    mat_level?: string
    mat_status?: string
    // Sessions tab pagination & filtering
    sess_page?: string
    sess_size?: string
    sess_status?: string
    sess_mode?: string
    sess_assay?: string
    sess_specialty?: string
    sess_active?: string
    sess_search?: string
    // Definitions tab pagination
    def_page?: string
    def_size?: string
    def_status?: string
}

export default async function QualityControlPage({
    searchParams,
}: {
    searchParams: Promise<PageSearchParams>
}) {
    const params = await searchParams
    const { qc_days = '90' } = params
    const days = qc_days === 'all' ? null : parseInt(qc_days, 10)

    // Parse materials pagination/filter params with defaults
    const matPage = params.mat_page ? parseInt(params.mat_page, 10) : 1
    const matPageSize = params.mat_size ? parseInt(params.mat_size, 10) : 20
    const matSearch = params.mat_search || ''
    const matLevel = (params.mat_level as GetQCMaterialsParams['level']) || null
    const matStatus = (params.mat_status as GetQCMaterialsParams['status']) || null

    // Parse sessions pagination/filter params with defaults
    const sessPage = params.sess_page ? parseInt(params.sess_page, 10) : 1
    const sessPageSize = params.sess_size ? parseInt(params.sess_size, 10) : 20
    const sessStatus = params.sess_status as 'pending' | 'pass' | 'warning' | 'blocked' | 'resolved' | undefined
    const sessMode = params.sess_mode as 'daily' | 'batch' | 'shift' | undefined
    const sessAssay = params.sess_assay || undefined
    const sessSpecialty = params.sess_specialty || undefined
    const sessActiveOnly = params.sess_active === 'true'
    const sessSearch = params.sess_search || undefined

    // Parse definitions pagination params with defaults
    const defPage = params.def_page ? parseInt(params.def_page, 10) : 1
    const defPageSize = params.def_size ? parseInt(params.def_size, 10) : 20
    const defStatus = params.def_status as 'active' | 'inactive' | undefined

    const supabase = await createClient()

    // Auth check
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: userData } = await supabase
        .from('users')
        .select('id, full_name, role')
        .eq('id', user.id)
        .single()

    if (userData?.role !== 'manager') {
        redirect('/manager')
    }

    // Fetch lab specialties for filters
    const { data: specialties } = await supabase
        .from('lab_specialties')
        .select('id, name')
        .order('name', { ascending: true })

    // Fetch QC Materials with pagination and filtering
    const materialsResult = await getQCMaterials({
        page: matPage,
        pageSize: matPageSize,
        search: matSearch || undefined,
        level: matLevel,
        status: matStatus,
    })

    // Handle materials result
    const materialsData = 'error' in materialsResult ? [] : materialsResult.data
    const materialsTotal = 'error' in materialsResult ? 0 : (materialsResult.total ?? 0)

    // Transform materials to map DB field to UI field
    const transformedMaterials = materialsData.map(m => ({
        ...m,
        expiry_date: m.expiration_date, // Map DB field to expected UI field
    }))

    // Fetch QC Sessions with pagination and filtering
    const sessionsResult = await getQCSessionsPaginated({
        status: sessStatus,
        session_mode: sessMode,
        assay_id: sessAssay,
        specialty_id: sessSpecialty,
        active_only: sessActiveOnly,
        search: sessSearch,
        page: sessPage,
        page_size: sessPageSize,
    })

    // Handle sessions result
    const sessionsData = 'error' in sessionsResult ? [] : sessionsResult.data
    const sessionsTotal = 'error' in sessionsResult ? 0 : sessionsResult.total
    const sessionsTotalPages = 'error' in sessionsResult ? 0 : sessionsResult.total_pages

    // Fetch QC Definitions with pagination
    const definitionsResult = await getQCDefinitionsPaginated({
        page: defPage,
        page_size: defPageSize,
        status: defStatus || undefined,
    })

    // Handle definitions result
    const definitions = 'error' in definitionsResult ? [] : definitionsResult.data
    const definitionsTotal = 'error' in definitionsResult ? 0 : definitionsResult.total
    const definitionsActiveCount = 'error' in definitionsResult ? 0 : definitionsResult.active_count

    // Fetch TEa standards for sigma calculation
    const { data: teaStandards } = await supabase
        .from('qc_tea_standards')
        .select('assay_id, tea_percent')
        .is('deleted_at', null)

    // Create TEa lookup map
    const teaMap = new Map<string, number>()
    teaStandards?.forEach((tea) => {
        teaMap.set(tea.assay_id, tea.tea_percent)
    })

    // Fetch active sessions
    const { data: activeSessions } = await supabase
        .from('qc_sessions')
        .select(`
            id,
            assay_id,
            session_mode,
            qc_status,
            started_at,
            started_by,
            assay:assay_definitions!inner(id, name)
        `)
        .is('ended_at', null)
        .order('started_at', { ascending: false })

    // Fetch pending violations (unresolved)
    const { data: pendingViolations } = await supabase
        .from('qc_violations')
        .select(`
            id,
            rule_violated,
            z_score_at_violation,
            created_at,
            result:qc_results!inner(
                id,
                value,
                definition:qc_definitions!inner(
                    id,
                    mean,
                    sd,
                    assay:assay_definitions!inner(id, name, units),
                    material:qc_materials!inner(id, name, level)
                )
            ),
            session:qc_sessions!inner(id, session_mode)
        `)
        .is('resolved_at', null)
        .order('created_at', { ascending: false })

    // Fetch assays for session manager dropdown
    const { data: assays } = await supabase
        .from('assay_definitions')
        .select('id, name, units, specialty_id')
        .is('deleted_at', null)
        .order('name', { ascending: true })

    // Fetch QC results for analytics (based on qc_days param)
    const activeDefinitionIds = (definitions || [])
        .filter((d) => d.is_active)
        .map((d) => d.id)

    // Calculate cutoff date based on qc_days param
    const cutoffDate = days
        ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        : null

    const { data: qcResultsData } = await supabase
        .from('qc_results')
        .select('id, definition_id, value, z_score, status, measured_at, rule_violated')
        .in('definition_id', activeDefinitionIds.length > 0 ? activeDefinitionIds : [''])
        .gte('measured_at', cutoffDate ? cutoffDate.toISOString() : '1970-01-01T00:00:00Z')
        .order('measured_at', { ascending: true })

    // Group QC results by definition_id
    const qcResultsByDefinition: Record<string, Array<{
        id: string
        value: number
        z_score: number | null
        status: QCResultStatus
        measured_at: string
        rule_violated: string | null
    }>> = {}

    qcResultsData?.forEach((r) => {
        if (!qcResultsByDefinition[r.definition_id]) {
            qcResultsByDefinition[r.definition_id] = []
        }
        qcResultsByDefinition[r.definition_id].push({
            id: r.id,
            value: r.value,
            z_score: r.z_score,
            status: r.status as QCResultStatus,
            measured_at: r.measured_at,
            rule_violated: r.rule_violated,
        })
    })

    // Transform data for client component - normalize optional fields to null
    const transformedDefinitions = definitions.map(def => ({
        ...def,
        cv_percent: def.cv_percent ?? null,
        data_points_count: def.data_points_count ?? null,
    }))

    // Transform definitions for analytics (with TEa)
    const analyticsDefinitions = (definitions || [])
        .filter((d) => d.is_active)
        .map((def) => {
            return {
                id: def.id,
                mean: def.mean,
                sd: def.sd,
                cv_percent: def.cv_percent ?? null,
                assay_id: def.assay_id,
                assay_name: def.assay_name,
                assay_units: def.assay_units,
                material_id: def.material_id,
                material_name: def.material_name,
                material_level: def.material_level,
                material_lot: def.material_lot,
                tea_percent: teaMap.get(def.assay_id) ?? null,
            }
        })

    const transformedSessions = (activeSessions || []).map((session) => {
        const rawAssay = session.assay as any
        const assay = Array.isArray(rawAssay) ? rawAssay[0] : rawAssay

        return {
            id: session.id,
            assay_id: session.assay_id,
            assay_name: assay?.name || '',
            session_mode: session.session_mode,
            qc_status: session.qc_status,
            started_at: session.started_at,
        }
    })

    const transformedViolations = (pendingViolations || []).map((v) => {
        const rawResult = v.result as any
        const result = Array.isArray(rawResult) ? rawResult[0] : rawResult
        const rawDef = result?.definition as any
        const def = Array.isArray(rawDef) ? rawDef[0] : rawDef
        const rawAssay = def?.assay as any
        const rawMaterial = def?.material as any
        const assay = Array.isArray(rawAssay) ? rawAssay[0] : rawAssay
        const material = Array.isArray(rawMaterial) ? rawMaterial[0] : rawMaterial
        const rawSession = v.session as any
        const session = Array.isArray(rawSession) ? rawSession[0] : rawSession

        return {
            id: v.id,
            rule_violated: v.rule_violated,
            z_score: v.z_score_at_violation,
            value: result?.value || 0,
            mean: def?.mean || 0,
            sd: def?.sd || 0,
            assay_name: assay?.name || '',
            assay_units: assay?.units || null,
            material_name: material?.name || '',
            material_level: material?.level || '',
            session_mode: session?.session_mode || 'daily',
            created_at: v.created_at,
        }
    })

    // Summary stats
    const stats = {
        totalMaterials: materialsTotal,
        totalDefinitions: definitionsTotal,
        activeDefinitions: definitionsActiveCount,
        activeSessions: transformedSessions.length,
        pendingViolations: transformedViolations.length,
        blockedSessions: transformedSessions.filter(s => s.qc_status === 'blocked').length,
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <DashboardHeader
                subtitle="Quản lý kiểm soát chất lượng nội bộ (IQC)"
                user={userData}
            />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div>
                    <Link href="/manager">
                        <Button variant="ghost" size="sm" className="hover:bg-slate-100 dark:hover:bg-slate-800">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Quay lại
                        </Button>
                    </Link>
                </div>

                <QualityControlPageClient
                    stats={stats}
                    materials={transformedMaterials}
                    definitions={transformedDefinitions}
                    activeSessions={transformedSessions}
                    pendingViolations={transformedViolations}
                    assays={assays || []}
                    specialties={specialties || []}
                    analyticsDefinitions={analyticsDefinitions}
                    qcResults={qcResultsByDefinition}
                    qcDays={qc_days}
                    // Materials pagination props
                    materialsTotal={materialsTotal}
                    materialsPage={matPage}
                    materialsPageSize={matPageSize}
                    materialsSearch={matSearch}
                    materialsLevel={matLevel}
                    materialsStatus={matStatus}
                    // Sessions pagination props
                    sessionsData={sessionsData}
                    sessionsTotal={sessionsTotal}
                    sessionsTotalPages={sessionsTotalPages}
                    sessionsPage={sessPage}
                    sessionsPageSize={sessPageSize}
                    sessionsStatus={sessStatus}
                    sessionsMode={sessMode}
                    sessionsAssay={sessAssay}
                    sessionsSpecialty={sessSpecialty}
                    sessionsActiveOnly={sessActiveOnly}
                    sessionsSearch={sessSearch}
                    // Definitions pagination props
                    definitionsTotal={definitionsTotal}
                    definitionsPage={defPage}
                    definitionsPageSize={defPageSize}
                />
            </main>
        </div>
    )
}

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { DashboardHeader } from '@/components/dashboard-header'
import { ArrowLeft } from 'lucide-react'
import { QualityControlPageClient } from '@/components/qc/quality-control-page-client'

export default async function QualityControlPage() {
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

    // Fetch QC Materials with counts
    const { data: materials } = await supabase
        .from('qc_materials')
        .select('id, name, manufacturer, lot_number, level, expiry_date, created_at')
        .is('deleted_at', null)
        .order('name', { ascending: true })

    // Fetch QC Definitions with assay and material details
    const { data: definitions } = await supabase
        .from('qc_definitions')
        .select(`
            id,
            mean,
            sd,
            cv_percent,
            is_active,
            active_from,
            data_points_count,
            assay:assay_definitions!inner(id, name, units),
            material:qc_materials!inner(id, name, lot_number, level)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

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

    // Transform data for client component
    const transformedDefinitions = (definitions || []).map((def) => {
        const rawAssay = def.assay as any
        const rawMaterial = def.material as any
        const assay = Array.isArray(rawAssay) ? rawAssay[0] : rawAssay
        const material = Array.isArray(rawMaterial) ? rawMaterial[0] : rawMaterial

        return {
            id: def.id,
            mean: def.mean,
            sd: def.sd,
            cv_percent: def.cv_percent,
            is_active: def.is_active,
            active_from: def.active_from,
            data_points_count: def.data_points_count,
            assay_id: assay?.id || '',
            assay_name: assay?.name || '',
            assay_units: assay?.units || null,
            material_id: material?.id || '',
            material_name: material?.name || '',
            material_lot: material?.lot_number || '',
            material_level: material?.level || '',
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
        totalMaterials: materials?.length || 0,
        totalDefinitions: transformedDefinitions.length,
        activeDefinitions: transformedDefinitions.filter(d => d.is_active).length,
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
                    materials={materials || []}
                    definitions={transformedDefinitions}
                    activeSessions={transformedSessions}
                    pendingViolations={transformedViolations}
                    assays={assays || []}
                />
            </main>
        </div>
    )
}

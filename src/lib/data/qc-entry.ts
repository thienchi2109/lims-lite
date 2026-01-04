import { createClient } from '@/lib/supabase/server'
import { QCEntryParamsSchema, type QCEntryParams } from '@/types'
import type { AssayWithQC } from '@/components/qc-entry/qc-table-row'
import type { MiniChartDataPoint } from '@/components/qc-entry/qc-sparkline'
import type { QCHistoryEntry } from '@/components/qc-entry/qc-recent-history'

// ============================================================================
// TYPES
// ============================================================================

interface QCDefinitionRaw {
    id: string
    mean: number
    sd: number
    assay:
        | { id: string; name: string; units: string; specialty_id: string }
        | Array<{ id: string; name: string; units: string; specialty_id: string }>
    material:
        | { name: string; level: string; lot_number: string; level_normalized: string }
        | Array<{ name: string; level: string; lot_number: string; level_normalized: string }>
}

interface QCEntryResult {
    data: AssayWithQC[]
    qcResultsByDefinition: Record<string, MiniChartDataPoint[]>
    count: number
    page: number
    pageSize: number
    totalPages: number
}

interface QCDetailResult {
    qcDataPoints: Array<MiniChartDataPoint & { measuredAt: string }>
    recentHistory: QCHistoryEntry[]
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Transform raw DB response to AssayWithQC
 * Handles PostgREST array/object ambiguity
 */
function transformQCDefinition(
    def: QCDefinitionRaw,
    activeSessions: Array<{ assay_id: string; qc_status: string | null }>
): AssayWithQC | null {
    // Handle array/object ambiguity from PostgREST
    const rawAssay = Array.isArray(def.assay) ? def.assay[0] : def.assay
    const rawMaterial = Array.isArray(def.material) ? def.material[0] : def.material

    if (!rawAssay || !rawMaterial) return null

    const session = activeSessions.find((s) => s.assay_id === rawAssay.id)
    const level = rawMaterial.level_normalized as 'L1' | 'L2'
    const status =
        session?.qc_status === 'approved'
            ? 'approved'
            : session?.qc_status === 'entered'
              ? 'entered'
              : 'pending'

    return {
        id: def.id,
        name: rawAssay.name,
        level,
        status,
        mean: def.mean,
        sd: def.sd,
        specialty_id: rawAssay.specialty_id,
    }
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

/**
 * Fetch paginated QC entry data with server-side filtering
 *
 * @param params - Pagination and filter params (page, pageSize, specialty, id)
 * @returns Paginated QC definitions with sparkline data, or error object
 */
export async function fetchQCEntryData(
    params: QCEntryParams
): Promise<QCEntryResult | { error: string }> {
    const supabase = await createClient()

    // Validate params
    const validatedParams = QCEntryParamsSchema.parse(params)

    // Step 1: Get active sessions (small dataset, no pagination needed)
    const { data: activeSessions, error: sessionsError } = await supabase
        .from('qc_sessions')
        .select('id, assay_id, qc_status')
        .is('ended_at', null)

    if (sessionsError) {
        console.error('Sessions fetch failed:', sessionsError)
        return { error: 'Failed to load QC sessions' }
    }

    // Step 2: Build paginated QC definitions query with server-side filtering
    let query = supabase
        .from('qc_definitions')
        .select(
            `
                id,
                mean,
                sd,
                assay:assay_definitions!inner(id, name, units, specialty_id),
                material:qc_materials!inner(name, level, level_normalized, lot_number)
            `,
            { count: 'exact' }
        )
        .eq('is_active', true)

    // Apply specialty filter at database level (server-side filtering)
    if (validatedParams.specialty) {
        query = query.eq('assay.specialty_id', validatedParams.specialty)
    }

    // Sort by assay name then level
    query = query.order('assay(name)', { ascending: true })

    // Apply pagination
    const from = (validatedParams.page - 1) * validatedParams.pageSize
    const to = from + validatedParams.pageSize - 1
    query = query.range(from, to)

    const { data: assaysWithQC, error: assaysError, count } = await query

    if (assaysError) {
        console.error('Assays fetch failed:', assaysError)
        return { error: 'Failed to load QC definitions' }
    }

    // Step 3: Transform data
    const assayList: AssayWithQC[] = []
    for (const def of assaysWithQC || []) {
        const transformed = transformQCDefinition(def as QCDefinitionRaw, activeSessions || [])
        if (transformed) assayList.push(transformed)
    }

    // Sort assayList by name then level (client-side sort for L1/L2 grouping)
    assayList.sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name)
        if (nameCompare !== 0) return nameCompare
        return a.level.localeCompare(b.level)
    })

    // Step 4: Fetch recent QC results for sparklines (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const definitionIds = assayList.map((a) => a.id)
    const { data: recentQCResults } =
        definitionIds.length > 0
            ? await supabase
                  .from('qc_results')
                  .select('id, definition_id, value, status, measured_at')
                  .in('definition_id', definitionIds)
                  .gte('measured_at', thirtyDaysAgo.toISOString())
                  .order('measured_at', { ascending: true })
            : { data: [] }

    // Group results by definition_id (max 15 per definition for sparklines)
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

    return {
        data: assayList,
        qcResultsByDefinition,
        count: count || 0,
        page: validatedParams.page,
        pageSize: validatedParams.pageSize,
        totalPages: Math.ceil((count || 0) / validatedParams.pageSize),
    }
}

/**
 * Fetch detail data for a specific QC definition
 *
 * @param definitionId - QC definition ID
 * @returns QC data points and recent history, or error object
 */
export async function fetchQCDetailData(
    definitionId: string
): Promise<QCDetailResult | { error: string }> {
    const supabase = await createClient()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: resultsData, error: resultsError } = await supabase
        .from('qc_results')
        .select('value, status, measured_at')
        .eq('definition_id', definitionId)
        .gte('measured_at', thirtyDaysAgo.toISOString())
        .order('measured_at', { ascending: false })
        .limit(15)

    if (resultsError) {
        console.error('QC results fetch failed:', resultsError)
        return { error: 'Failed to load QC results' }
    }

    const qcDataPoints = (resultsData || []).map((r) => ({
        value: r.value,
        status: r.status,
        measuredAt: r.measured_at,
    }))

    const recentHistory = qcDataPoints.slice(0, 5).map((dp) => ({
        date: new Date(dp.measuredAt).toLocaleDateString('vi-VN'),
        value: dp.value,
        status: dp.status,
    }))

    return { qcDataPoints, recentHistory }
}

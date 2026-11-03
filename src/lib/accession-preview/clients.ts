// Phase 1 consumes canonical SQL decisions only; no profile writes, hashes or durable preview state.
import 'server-only'
import { resolveAccessionPreviewClientsV1 } from '@/lib/client-resolution/server'
import { localizeClientResolution } from '@/lib/client-resolution/messages'
import { workbookError, type WorkbookError, type WorkbookLocation } from '@/lib/accession-workbook/errors'
import type { ValidatedAccessionWorkbook } from '@/lib/accession-workbook/validate'
import { BUSINESS_HEADERS } from '@/lib/accession-template/contract'
import { PreviewClientRowSchema, type PreviewClientRow } from './client-contract'

export type PlannedClient = PreviewClientRow & {
    disposition: 'create' | 'reuse'
    clientId: string | null
    callerContext: ValidatedAccessionWorkbook['clients'][number]['callerContext']
}
type ClientPlan = { ok: true; clients: PlannedClient[] } | { ok: false; errors: WorkbookError[] }

export async function resolveAccessionPreviewClients(workbook: ValidatedAccessionWorkbook): Promise<ClientPlan> {
    const unavailable = (): ClientPlan => ({ ok: false, errors: [workbookError('CLIENT_RESOLUTION_UNAVAILABLE', {}, 'Không thể phân giải khách hàng. Vui lòng thử lại.')] })
    const inputs = new Map(workbook.clients.map(client => [client.callerContext.row, client]))
    if (!inputs.size || inputs.size !== workbook.clients.length) return unavailable()
    let response
    try { response = await resolveAccessionPreviewClientsV1(workbook.clients) }
    catch { return unavailable() }
    if ('error' in response || response.data.length !== inputs.size) return unavailable()
    const results: PreviewClientRow[] = [], seen = new Set<number>()
    for (const result of response.data) {
        const parsed = PreviewClientRowSchema.safeParse(result)
        if (!parsed.success || !inputs.has(parsed.data.row) || seen.has(parsed.data.row)
            || parsed.data.issues.some(issue => issue.relatedRows.some(row => !inputs.has(row) || row === parsed.data.row))) return unavailable()
        seen.add(parsed.data.row)
        results.push(parsed.data)
    }
    const location = (row: number, column = 'A'): WorkbookLocation => {
        const client = inputs.get(row)!
        return { ...client.callerContext, column, header: BUSINESS_HEADERS[0][column.charCodeAt(0) - 65] }
    }
    const errors: WorkbookError[] = [], clients: PlannedClient[] = []
    for (const result of results.sort((left, right) => left.row - right.row)) {
        const { resolution, input } = result
        if (resolution.outcome === 'conflict' || resolution.outcome === 'ambiguous') {
            errors.push(workbookError('CLIENT_CONFLICT', location(result.row), localizeClientResolution(resolution).message))
            continue
        }
        for (const issue of result.issues) errors.push({
            ...workbookError(issue.code, location(result.row), issue.code === 'CLIENT_DUPLICATE'
                ? 'Các dòng cùng chỉ đến một khách hàng. Hãy gom mẫu về một dòng khách hàng.'
                : localizeClientResolution({ outcome: 'conflict', created: false, clientId: null,
                    reasonCode: issue.reasonCode === 'same_uuid' || issue.reasonCode === 'same_trusted_identity' ? 'identity_conflict' : issue.reasonCode }).message),
            relatedLocations: issue.relatedRows.map(row => location(row)),
        })
        if (resolution.outcome === 'not_found') {
            if (input.gender == null) errors.push(workbookError('REQUIRED_VALUE_MISSING', location(result.row, 'F')))
            if (input.phone == null) errors.push(workbookError('REQUIRED_VALUE_MISSING', location(result.row, 'G')))
        }
        clients.push({ ...result, disposition: resolution.outcome === 'matched' ? 'reuse' : 'create',
            clientId: resolution.clientId, callerContext: inputs.get(result.row)!.callerContext })
    }
    return errors.length ? { ok: false, errors } : { ok: true, clients }
}

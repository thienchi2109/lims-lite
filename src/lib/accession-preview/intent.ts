// Canonical accession-intent-v1 bytes use SQL-normalized input and preserve the nested import graph.
import 'server-only'
import { createHash } from 'node:crypto'
import type { ValidatedAccessionWorkbook } from '@/lib/accession-workbook/validate'
import { isSupportedLiteral } from '@/lib/accession-workbook/strings'
import type { PlannedClient } from './clients'

function invalid(): never { throw new Error('ACCESSION_INTENT_INVALID') }
function text(value: unknown): string {
    if (typeof value !== 'string' || !value || !isSupportedLiteral(value)) invalid()
    return value
}
const optional = (value: unknown): string | null => value == null ? null : text(value)
function sortUtf8<T>(values: readonly T[], serialize: (value: T) => string): T[] {
    return values.map(value => ({ value, bytes: Buffer.from(serialize(value), 'utf8') }))
        .sort((left, right) => Buffer.compare(left.bytes, right.bytes)).map(entry => entry.value)
}

export function canonicalizeAccessionIntent(workbook: ValidatedAccessionWorkbook, resolvedClients: readonly PlannedClient[]) {
    type Sample = { code: string; assays: Set<string> }
    const clients = new Map<string, { source: typeof workbook.clients[number]; plan?: PlannedClient; samples: Sample[] }>()
    const rows = new Set<number>(), reusedIds = new Set<string>()
    if (!workbook.clients.length || workbook.clients.length !== resolvedClients.length) invalid()
    for (const source of workbook.clients) {
        const reference = text(source.temporaryReference), row = source.callerContext.row
        if (clients.has(reference) || rows.has(row) || !Number.isSafeInteger(row) || row <= 0
            || source.callerContext.temporaryReference !== reference) invalid()
        rows.add(row)
        clients.set(reference, { source, samples: [] })
    }
    for (const plan of resolvedClients) {
        const owner = clients.get(plan.callerContext.temporaryReference), resolution = plan.resolution
        if (!owner || owner.plan || plan.row !== owner.source.callerContext.row || plan.callerContext.row !== plan.row
            || plan.callerContext.sheet !== owner.source.callerContext.sheet || plan.issues.length || resolution.created) invalid()
        if (plan.disposition === 'reuse') {
            if (resolution.outcome !== 'matched' || !plan.clientId || plan.clientId !== resolution.clientId || reusedIds.has(plan.clientId)) invalid()
            reusedIds.add(plan.clientId)
        } else if (plan.disposition !== 'create' || resolution.outcome !== 'not_found' || plan.clientId !== null || resolution.clientId !== null) invalid()
        owner.plan = plan
    }
    const samples = new Map<string, Sample>()
    for (const source of workbook.samples) {
        const reference = text(source.temporaryReference), owner = clients.get(source.clientTemporaryReference)
        if (!owner || samples.has(reference)) invalid()
        const sample = { code: text(source.sampleTypeCode), assays: new Set<string>() }
        samples.set(reference, sample)
        owner.samples.push(sample)
    }
    for (const assignment of workbook.assignments) {
        const sample = samples.get(assignment.sampleTemporaryReference), code = text(assignment.assayCode)
        if (!sample || sample.assays.has(code)) invalid()
        sample.assays.add(code)
    }
    const tuples = [...clients.values()].map(owner => {
        if (!owner.plan || !owner.samples.length) invalid()
        const input = owner.plan.input
        return [text(input.name), text(input.dateOfBirth), optional(input.governmentIdentityType), optional(input.governmentIdentityValue),
            optional(input.gender), optional(input.phone), optional(input.address), optional(input.healthInsuranceNum), optional(input.expiryDate),
            sortUtf8(owner.samples.map(sample => {
                if (!sample.assays.size) invalid()
                return [sample.code, 'acceptable', sortUtf8([...sample.assays], code => code)]
            }), JSON.stringify)]
    })
    const canonicalJson = JSON.stringify(sortUtf8(tuples, JSON.stringify))
    return { canonicalJson, canonicalizationVersion: 'accession-intent-v1' as const,
        normalizedPayloadHash: createHash('sha256').update('lims-lite:bulk-accession:intent:v1\n', 'utf8').update(canonicalJson, 'utf8').digest('hex') }
}

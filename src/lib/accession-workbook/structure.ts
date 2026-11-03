// Structural references are case sensitive and workbook-local; no identity matching or writes.
import { BUSINESS_HEADERS, SHEET_NAMES } from '../accession-template/contract'
import type { WorkbookBudget } from './budget'
import { WorkbookErrors, type WorkbookLocation } from './errors'
import type { ParsedWorkbook } from './workbook'
import type { WorkbookRow } from './worksheet'

export type BusinessRow = WorkbookRow & { sheet: string }
const referencePattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/
export const rowLocation = (row: BusinessRow, column: number): WorkbookLocation => ({
    sheet: row.sheet, row: row.row, column: String.fromCharCode(65 + column),
    header: BUSINESS_HEADERS[SHEET_NAMES.indexOf(row.sheet as typeof SHEET_NAMES[number]) - 2][column], temporaryReference: row.values[0],
})

export async function normalizeBusinessRows(parsed: ParsedWorkbook, errors: WorkbookErrors): Promise<BusinessRow[][]> {
    const result: BusinessRow[][] = []
    for (const sheet of SHEET_NAMES.slice(2, 5)) {
        const rows: BusinessRow[] = [], source = parsed.sheets.get(sheet)!
        for (let index = 1; index < source.length; index++) {
            if (index % 128 === 0) await parsed.budget.yield()
            const original = source[index]
            parsed.budget.reserve(512 + original.values.reduce((bytes, value) => bytes + 64 + (value?.length ?? 0) * 4, 0))
            const values = original.values.map(value => value == null ? null : value.trim().normalize('NFC') || null)
            if (values.some(value => value != null)) rows.push({ sheet, row: original.row, values })
        }
        if (!rows.length) errors.add('REQUIRED_VALUE_MISSING', { sheet })
        result.push(rows)
    }
    return result
}

async function definitionIndex(rows: BusinessRow[], budget: WorkbookBudget, errors: WorkbookErrors): Promise<Map<string, BusinessRow[]>> {
    const index = new Map<string, BusinessRow[]>()
    for (let position = 0; position < rows.length; position++) {
        if (position % 128 === 0) await budget.yield()
        const row = rows[position], reference = row.values[0]
        if (!reference || !referencePattern.test(reference)) { errors.add(reference == null ? 'REQUIRED_VALUE_MISSING' : 'TEMP_REFERENCE_INVALID', rowLocation(row, 0)); continue }
        budget.reserve(512 + reference.length * 2)
        const definitions = index.get(reference) ?? []; definitions.push(row); index.set(reference, definitions)
    }
    for (const definitions of index.values()) if (definitions.length > 1) {
        budget.reserve(definitions.length * 512)
        const related = definitions.map(row => rowLocation(row, 0))
        for (const row of definitions) errors.add('TEMP_REFERENCE_DUPLICATE', rowLocation(row, 0), undefined, related)
        await budget.yield()
    }
    return index
}

export async function validateStructure(parsed: ParsedWorkbook, rows: BusinessRow[][], errors: WorkbookErrors): Promise<void> {
    const { budget, snapshot } = parsed
    const [clients, samples, assignments] = rows
    const clientIndex = await definitionIndex(clients, budget, errors), sampleIndex = await definitionIndex(samples, budget, errors)
    budget.reserve((snapshot.sampleTypes.length + snapshot.assays.length + snapshot.pairs.length + samples.length + assignments.length) * 512)
    const sampleCodes = new Map(snapshot.sampleTypes.map(value => [value.importCode, value.id])), assayCodes = new Map(snapshot.assays.map(value => [value.importCode, value.id]))
    const pairs = new Set(snapshot.pairs.map(value => value.sampleTypeId + ':' + value.assayDefinitionId))
    const usedClients = new Set<string>(), usedSamples = new Set<string>(), assignmentPairs = new Map<string, BusinessRow[]>()
    const reference = (row: BusinessRow, column: number, index: Map<string, BusinessRow[]>): BusinessRow | undefined => {
        const value = row.values[column]
        if (!value || !referencePattern.test(value)) { errors.add(value == null ? 'REQUIRED_VALUE_MISSING' : 'TEMP_REFERENCE_INVALID', rowLocation(row, column)); return }
        const matches = index.get(value)
        if (!matches) errors.add('TEMP_REFERENCE_NOT_FOUND', rowLocation(row, column))
        return matches?.length === 1 ? matches[0] : undefined
    }
    for (let position = 0; position < samples.length; position++) {
        if (position % 128 === 0) await budget.yield()
        const row = samples[position], client = reference(row, 1, clientIndex)
        if (client) usedClients.add(client.values[0]!)
        if (!row.values[2] || !sampleCodes.has(row.values[2])) errors.add(row.values[2] == null ? 'REQUIRED_VALUE_MISSING' : 'CATALOG_CODE_INVALID', rowLocation(row, 2))
    }
    for (let position = 0; position < assignments.length; position++) {
        if (position % 128 === 0) await budget.yield()
        const row = assignments[position], sample = reference(row, 0, sampleIndex), code = row.values[1]
        if (sample) usedSamples.add(sample.values[0]!)
        if (!code || !assayCodes.has(code)) errors.add(code == null ? 'REQUIRED_VALUE_MISSING' : 'CATALOG_CODE_INVALID', rowLocation(row, 1))
        const sampleId = sample?.values[2] ? sampleCodes.get(sample.values[2]) : undefined, assayId = code ? assayCodes.get(code) : undefined
        if (sampleId && assayId && !pairs.has(sampleId + ':' + assayId)) errors.add('COMPATIBILITY_INVALID', rowLocation(row, 1))
        if (row.values[0] && code) {
            const key = JSON.stringify([row.values[0], code]); budget.reserve(key.length * 2 + 256)
            const definitions = assignmentPairs.get(key) ?? []; definitions.push(row); assignmentPairs.set(key, definitions)
        }
    }
    for (const definitions of assignmentPairs.values()) if (definitions.length > 1) {
        budget.reserve(definitions.length * 512)
        const related = definitions.map(row => rowLocation(row, 1))
        for (const row of definitions) errors.add('ASSIGNMENT_DUPLICATE', rowLocation(row, 1), undefined, related)
        await budget.yield()
    }
    for (const [index, used] of [[clientIndex, usedClients], [sampleIndex, usedSamples]] as const) {
        let position = 0
        for (const [reference, definitions] of index) {
            if (position++ % 128 === 0) await budget.yield()
            if (definitions.length === 1 && !used.has(reference)) errors.add('ORPHAN_ROW', rowLocation(definitions[0], 0))
        }
    }
    budget.check()
}

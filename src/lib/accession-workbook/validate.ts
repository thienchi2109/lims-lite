// Public TASK-10 handoff: validated ephemeral rows or all safe errors, never partial output.
import 'server-only'
import type { TemplateClaims } from '../accession-template/binding'
import { validateClient, type ValidatedClient } from './clients'
import { WorkbookErrors, WorkbookFailure, workbookError } from './errors'
import { normalizeBusinessRows, validateStructure } from './structure'
import { parseAccessionWorkbook, type WorkbookOptions, type WorkbookResult } from './workbook'

type Source = { sheet: string; row: number; temporaryReference: string }
export type ValidatedSample = { temporaryReference: string; clientTemporaryReference: string; sampleTypeCode: string; callerContext: Source }
export type ValidatedAssignment = { sampleTemporaryReference: string; assayCode: string; callerContext: Source }
export type ValidatedAccessionWorkbook = { template: TemplateClaims; clients: ValidatedClient[]; samples: ValidatedSample[]; assignments: ValidatedAssignment[] }

export async function validateAccessionWorkbook(bytes: Uint8Array, options: WorkbookOptions): Promise<WorkbookResult<ValidatedAccessionWorkbook>> {
    const parsed = await parseAccessionWorkbook(bytes, options)
    if (!parsed.ok) return parsed
    const { budget } = parsed.value
    try {
        const errors = new WorkbookErrors(budget), rows = await normalizeBusinessRows(parsed.value, errors)
        const clients: ValidatedClient[] = [], samples: ValidatedSample[] = [], assignments: ValidatedAssignment[] = []
        for (let index = 0; index < rows[0].length; index++) {
            if (index % 128 === 0) await budget.yield()
            const row = rows[0][index]
            clients.push(validateClient(row.values, row.row, budget, errors))
        }
        await validateStructure(parsed.value, rows, errors)
        if (errors.errors.length) return { ok: false, errors: errors.sorted() }
        budget.reserve((rows[1].length + rows[2].length) * 1024)
        for (let index = 0; index < rows[1].length; index++) {
            if (index % 128 === 0) await budget.yield()
            const row = rows[1][index], [temporaryReference, clientTemporaryReference, sampleTypeCode] = row.values as string[]
            samples.push({ temporaryReference, clientTemporaryReference, sampleTypeCode, callerContext: { sheet: row.sheet, row: row.row, temporaryReference } })
        }
        for (let index = 0; index < rows[2].length; index++) {
            if (index % 128 === 0) await budget.yield()
            const row = rows[2][index], [sampleTemporaryReference, assayCode] = row.values as string[]
            assignments.push({ sampleTemporaryReference, assayCode, callerContext: { sheet: row.sheet, row: row.row, temporaryReference: sampleTemporaryReference } })
        }
        budget.check()
        return { ok: true, value: { template: parsed.value.template, clients, samples, assignments } }
    } catch (error) {
        if (error instanceof WorkbookFailure) return { ok: false, errors: [error.issue] }
        return { ok: false, errors: [workbookError(error instanceof Error && error.message === 'RESOURCE_LIMIT' ? 'RESOURCE_LIMIT' : 'WORKBOOK_FEATURE_UNSUPPORTED')] }
    }
}

// Read-only hostile XLSX parser. Consumers supply trusted resource policy and current server authority.
import 'server-only'
import { verifyTemplateBinding, type TemplateClaims } from '../accession-template/binding'
import { BUSINESS_HEADERS, CATALOG_HEADERS, METADATA_HEADERS, SHEET_NAMES, validateTemplateSnapshot, type TemplateSnapshot } from '../accession-template/contract'
import { GUIDE } from '../accession-template/workbook'
import { readAccessionArchive } from './archive'
import type { WorkbookBudget, WorkbookResources } from './budget'
import { inspectDecoration } from './decorations'
import { WorkbookErrors, WorkbookFailure, workbookError, type WorkbookError } from './errors'
import { part, releasePart } from './ooxml'
import { readPackageLayout } from './package'
import { isSupportedLiteral, readSharedStrings } from './strings'
import { readWorksheet, type WorkbookRow } from './worksheet'

export type WorkbookOptions = { snapshot: unknown; signingConfig: unknown; resources: WorkbookResources }
export type ParsedWorkbook = { template: TemplateClaims; snapshot: TemplateSnapshot; sheets: Map<string, WorkbookRow[]>; budget: WorkbookBudget }
export type WorkbookResult<T> = { ok: true; value: T } | { ok: false; errors: WorkbookError[] }

export async function parseAccessionWorkbook(bytes: Uint8Array, options: WorkbookOptions): Promise<WorkbookResult<ParsedWorkbook>> {
    try {
        const { entries, budget } = await readAccessionArchive(bytes, options.resources)
        const snapshot = validateTemplateSnapshot(options.snapshot)
        const errors = new WorkbookErrors(budget), layout = await readPackageLayout(entries, budget, errors)
        if (errors.errors.length) return { ok: false, errors: errors.sorted() }
        const strings = layout.sharedStrings ? await readSharedStrings(part(entries, layout.sharedStrings), budget) : []
        if (layout.sharedStrings) releasePart(entries, layout.sharedStrings, budget)
        const sheets = new Map<string, WorkbookRow[]>(), staticRanges = [...layout.names.values()]
        // Resolve by package relationships; workbook ordering never changes semantic sheet identity.
        for (const sheet of layout.sheets) {
            sheets.set(sheet.name, await readWorksheet(part(entries, sheet.path), sheet.name, strings, layout.names, budget, errors, staticRanges))
            releasePart(entries, sheet.path, budget)
        }
        for (const [path, data] of entries) {
            if (!['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/workbook.xml'].includes(path)) await inspectDecoration(data, path, budget)
            releasePart(entries, path, budget)
        }
        const matrices = SHEET_NAMES.map(name => sheets.get(name)!)
        for (let index = 0; index < matrices.length; index++) {
            const rows = matrices[index]
            const expected = index === 0 ? GUIDE[0] : index === 1 ? METADATA_HEADERS : index < 5 ? BUSINESS_HEADERS[index - 2] : CATALOG_HEADERS[index - 5]
            if (rows[0]?.row !== 1 || JSON.stringify(rows[0]?.values) !== JSON.stringify(expected)) errors.add('TEMPLATE_STRUCTURE_INVALID', { sheet: SHEET_NAMES[index], row: 1 })
            if ((index < 2 || index > 4) && rows.some((row, position) => row.row !== position + 1)) errors.add('TEMPLATE_STRUCTURE_INVALID', { sheet: SHEET_NAMES[index] })
        }
        if (JSON.stringify(matrices[0].map(row => row.values)) !== JSON.stringify(GUIDE)) errors.add('TEMPLATE_STRUCTURE_INVALID', { sheet: SHEET_NAMES[0] })
        if (errors.errors.length) return { ok: false, errors: errors.sorted() }
        for (let index = 0; index < strings.length; index++) {
            if (index % 128 === 0) await budget.yield()
            if (!isSupportedLiteral(strings[index])) throw new WorkbookFailure('CELL_VALUE_INVALID')
        }
        const matrix = (index: number) => matrices[index].map(row => row.values.map(value => value ?? ''))
        // The reused synchronous verifier creates Zod/JSON/digest working copies. Charge first.
        let verifierBytes = 0
        for (const index of [1, 5, 6, 7]) for (let row = 0; row < matrices[index].length; row++) {
            const bytes = 4096 + matrices[index][row].values.reduce((size, value) => size + (value?.length ?? 0) * 32, 0)
            budget.reserve(bytes); verifierBytes += bytes
            if (row % 128 === 0) await budget.yield()
        }
        let template: TemplateClaims
        try { template = verifyTemplateBinding(matrix(1), [matrix(5), matrix(6), matrix(7)], options.signingConfig, snapshot) }
        catch (error) {
            const code = error instanceof Error ? error.message : 'TEMPLATE_METADATA_INVALID'
            if (['ACCESSION_TEMPLATE_CONFIGURATION_UNAVAILABLE', 'ACCESSION_TEMPLATE_CATALOG_UNAVAILABLE'].includes(code)) throw new WorkbookFailure(code)
            const row = code === 'TEMPLATE_VERSION_UNSUPPORTED' ? 3 : code === 'CATALOG_STALE' ? 5 : 6
            throw new WorkbookFailure(['TEMPLATE_VERSION_UNSUPPORTED', 'CATALOG_STALE'].includes(code) ? code : 'TEMPLATE_METADATA_INVALID', { sheet: SHEET_NAMES[1], row, column: 'B', header: METADATA_HEADERS[1] })
        } finally { budget.release(verifierBytes) }
        await budget.yield()
        for (const range of staticRanges) {
            const [, sheet, column, end] = /^'([^']+)'!\$([A-C])\$[0-9]+:\$[A-C]\$([0-9]+)$/.exec(range)!
            if (Number(end) > sheets.get(sheet)!.at(-1)!.row || column.charCodeAt(0) - 65 >= CATALOG_HEADERS[SHEET_NAMES.indexOf(sheet as typeof SHEET_NAMES[number]) - 5].length) throw new WorkbookFailure('WORKBOOK_FEATURE_UNSUPPORTED')
        }
        budget.check()
        return { ok: true, value: { template, snapshot, sheets, budget } }
    } catch (error) {
        if (error instanceof WorkbookFailure) return { ok: false, errors: [error.issue] }
        const code = error instanceof Error ? error.message : ''
        const safe = ['ARCHIVE_INVALID', 'XML_INVALID', 'RESOURCE_LIMIT', 'RESOURCE_POLICY_INVALID', 'ACCESSION_TEMPLATE_FILE_TOO_LARGE', 'ACCESSION_TEMPLATE_CONFIGURATION_UNAVAILABLE', 'ACCESSION_TEMPLATE_CATALOG_UNAVAILABLE', 'TEMPLATE_VERSION_UNSUPPORTED', 'TEMPLATE_METADATA_INVALID', 'CATALOG_STALE']
        return { ok: false, errors: [workbookError(safe.includes(code) ? code : 'WORKBOOK_FEATURE_UNSUPPORTED')] }
    }
}

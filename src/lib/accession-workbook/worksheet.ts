// Sparse physical rows: validate every cell, including hidden rows and empty styled extra columns.
import { BUSINESS_HEADERS, CATALOG_HEADERS, METADATA_HEADERS, SHEET_NAMES } from '../accession-template/contract'
import type { WorkbookBudget } from './budget'
import { columnNumber, WorkbookErrors, WorkbookFailure } from './errors'
import { attribute, semanticXml, staticCatalogRange, unsupported } from './ooxml'
import { decodeOoxmlText, isSupportedLiteral, richGrammar } from './strings'

export type WorkbookRow = { row: number; values: (string | null)[] }
const widths = [1, 2, 10, 3, 2, 2, 3, 2]
const headers = [[], METADATA_HEADERS, ...BUSINESS_HEADERS, ...CATALOG_HEADERS]
const grammar: Record<string, string[]> = {
    '': ['worksheet'], worksheet: ['sheetPr', 'dimension', 'sheetViews', 'sheetFormatPr', 'cols', 'sheetData', 'autoFilter', 'sortState', 'dataValidations', 'mergeCells', 'printOptions', 'pageMargins', 'pageSetup', 'headerFooter', 'ignoredErrors'],
    sheetPr: ['tabColor', 'outlinePr', 'pageSetUpPr'], sheetViews: ['sheetView'], sheetView: ['pane', 'selection'], cols: ['col'], sheetData: ['row'], row: ['c'],
    c: ['v', 'is', 'f'], v: [], f: [], ...richGrammar,
    autoFilter: ['filterColumn', 'sortState'], filterColumn: ['filters', 'customFilters', 'dynamicFilter', 'top10', 'colorFilter', 'iconFilter'],
    filters: ['filter', 'dateGroupItem'], customFilters: ['customFilter'], sortState: ['sortCondition'],
    dataValidations: ['dataValidation'], dataValidation: ['formula1'], formula1: [], mergeCells: ['mergeCell'],
    headerFooter: ['oddHeader', 'oddFooter', 'evenHeader', 'evenFooter', 'firstHeader', 'firstFooter'],
    ignoredErrors: ['ignoredError'],
}
for (const name of ['tabColor', 'outlinePr', 'pageSetUpPr', 'dimension', 'sheetFormatPr', 'pane', 'selection', 'col', 'filter', 'dateGroupItem', 'customFilter', 'dynamicFilter', 'top10', 'colorFilter', 'iconFilter', 'sortCondition', 'mergeCell', 'printOptions', 'pageMargins', 'pageSetup', 'ignoredError', 'oddHeader', 'oddFooter', 'evenHeader', 'evenFooter', 'firstHeader', 'firstFooter']) grammar[name] = []

export async function readWorksheet(bytes: Buffer, sheet: string, strings: string[], names: Map<string, string>, budget: WorkbookBudget, errors: WorkbookErrors, staticRanges: string[]): Promise<WorkbookRow[]> {
    const sheetIndex = SHEET_NAMES.indexOf(sheet as typeof SHEET_NAMES[number]), width = widths[sheetIndex]
    const rows = new Map<number, WorkbookRow>(), cells = new Set<string>(), rowIds = new Set<number>()
    let row = 0, cell: { reference: string; column: string; index: number; type?: string; value: string; inline: string; formula: boolean; v: number; is: number } | undefined
    let textTarget = '', validation = ''
    const location = () => ({ sheet, row, column: cell?.column ?? null, header: cell ? headers[sheetIndex][cell.index] ?? null : null })
    const range = (value: string) => {
        for (const token of value.split(/[: ]/)) {
            const match = /^\$?([A-Z]{1,3})\$?([1-9][0-9]{0,6})$/.exec(token)
            if (!match || columnNumber(match[1]) > width || Number(match[2]) > 1048576) throw new WorkbookFailure('WORKBOOK_FEATURE_UNSUPPORTED', { sheet })
        }
    }
    await semanticXml(bytes, budget, grammar, {
        open(tag) {
            if (tag.local === 'row') {
                const value = attribute(tag, 'r')
                if (!value || !/^[1-9][0-9]{0,6}$/.test(value) || Number(value) > 1048576 || rowIds.has(Number(value))) unsupported()
                row = Number(value); budget.reserve(256 + width * 16); rowIds.add(row)
                rows.set(row, { row, values: Array<string | null>(width).fill(null) })
            }
            if (tag.local === 'c') {
                const reference = attribute(tag, 'r')!, match = /^([A-Z]+)([0-9]+)$/.exec(reference)!
                const index = columnNumber(match[1]) - 1
                if (Number(match[2]) !== row || cells.has(reference)) unsupported()
                budget.reserve(256 + reference.length * 2); cells.add(reference)
                cell = { reference, column: match[1], index, type: attribute(tag, 't'), value: '', inline: '', formula: false, v: 0, is: 0 }
                if (index >= width) errors.add('WORKBOOK_FEATURE_UNSUPPORTED', location())
            }
            if (tag.local === 'f' && cell) { cell.formula = true; textTarget = 'formula' }
            if (tag.local === 'v' && cell) { cell.v++; textTarget = 'value' }
            if (tag.local === 'is' && cell) cell.is++
            if (tag.local === 't' && cell) textTarget = 'inline'
            if (tag.local === 'mergeCells' && sheetIndex !== 0) throw new WorkbookFailure('WORKBOOK_FEATURE_UNSUPPORTED', { sheet })
            if (tag.local === 'dataValidation') {
                if (attribute(tag, 'type') !== 'list' || !attribute(tag, 'sqref')) unsupported()
                range(attribute(tag, 'sqref')!); validation = ''
            }
            if (tag.local === 'formula1') textTarget = 'validation'
            if (tag.local === 'dimension' || tag.local === 'autoFilter') {
                const ref = attribute(tag, 'ref'); if (ref) range(ref)
            }
            if (tag.local === 'col') {
                const min = Number(attribute(tag, 'min')), max = Number(attribute(tag, 'max'))
                if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > width) throw new WorkbookFailure('WORKBOOK_FEATURE_UNSUPPORTED', { sheet })
            }
        },
        text(value) {
            if (textTarget === 'value' && cell) cell.value += value
            else if (textTarget === 'inline' && cell) cell.inline += value
            else if (textTarget === 'validation') validation += value
            else if (textTarget !== 'formula' && value.trim()) unsupported()
        },
        close(tag) {
            if (['v', 't', 'f', 'formula1'].includes(tag.local)) textTarget = ''
            if (tag.local === 'dataValidation') {
                if (!names.has(validation) && !staticCatalogRange(validation)) unsupported()
                budget.reserve(validation.length * 2 + 256); staticRanges.push(names.get(validation) ?? validation)
            }
            if (tag.local !== 'c' || !cell) return
            let value: string | null = null
            if (cell.formula) errors.add('WORKBOOK_FEATURE_UNSUPPORTED', location())
            else if (cell.v > 1 || cell.is > 1 || (cell.v > 0 && cell.is > 0)) unsupported()
            else if (cell.v === 0 && cell.is === 0 && [undefined, 'n', 's', 'str', 'b', 'd', 'e', 'inlineStr'].includes(cell.type)) value = null
            else if (cell.type === 's' && cell.v === 1 && /^(0|[1-9][0-9]*)$/.test(cell.value) && Number.isSafeInteger(Number(cell.value)) && strings[Number(cell.value)] !== undefined) value = strings[Number(cell.value)]
            else if (cell.type === 'inlineStr' && cell.is === 1 && cell.v === 0) value = decodeOoxmlText(cell.inline)
            else if (cell.type == null && cell.v === 0 && cell.is === 0) value = null
            else errors.add('CELL_TYPE_INVALID', location())
            if (value != null && !isSupportedLiteral(value)) errors.add('CELL_VALUE_INVALID', location())
            if (cell.index < width) {
                budget.reserve((value?.length ?? 0) * 2 + 64)
                rows.get(row)!.values[cell.index] = value
            }
            cell = undefined
        },
    })
    budget.reserve(rows.size * 24)
    let comparisons = 0
    const sorted = [...rows.values()].sort((a, b) => {
        if (++comparisons % 1024 === 0) budget.check()
        return a.row - b.row
    })
    budget.check()
    return sorted
}

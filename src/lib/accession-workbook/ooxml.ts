// Shared semantic XML plumbing: namespace/parent checks and authenticated package part lookup.
import type { SaxesTagNS } from 'saxes'
import { parseAccessionXml, SPREADSHEET_NS, type XmlEvents } from './xml'
import type { WorkbookBudget } from './budget'
import { WorkbookFailure } from './errors'

export const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
export const DOC_REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
export const CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types'
export function unsupported(): never { throw new WorkbookFailure('WORKBOOK_FEATURE_UNSUPPORTED') }
export const attribute = (tag: SaxesTagNS, local: string, uri = ''): string | undefined => Object.values(tag.attributes).find(value => value.local === local && value.uri === uri)?.value
const repeatable: Record<string, string[]> = {
    Relationships: ['Relationship'], Types: ['Default', 'Override'], sheets: ['sheet'], bookViews: ['workbookView'], definedNames: ['definedName'],
    sst: ['si'], si: ['r'], is: ['r'], sheetViews: ['sheetView'], cols: ['col'], sheetData: ['row'], row: ['c'],
    autoFilter: ['filterColumn'], filters: ['filter', 'dateGroupItem'], customFilters: ['customFilter'], sortState: ['sortCondition'],
    dataValidations: ['dataValidation'], mergeCells: ['mergeCell'], ignoredErrors: ['ignoredError'],
}

export async function semanticXml(bytes: Buffer, budget: WorkbookBudget, grammar: Record<string, string[]>, events: XmlEvents = {}, namespaces = [SPREADSHEET_NS]): Promise<void> {
    const stack: { name: string; children: Set<string> }[] = []
    await parseAccessionXml(bytes, budget, {
        open(tag) {
            const frame = stack.at(-1), parent = frame?.name ?? ''
            if (!namespaces.includes(tag.uri) || !grammar[parent]?.includes(tag.local)) unsupported()
            if (frame?.children.has(tag.local) && !repeatable[parent]?.includes(tag.local)) unsupported()
            if (['si', 'is'].includes(parent) && ((tag.local === 't' && frame?.children.has('r')) || (tag.local === 'r' && frame?.children.has('t')))) unsupported()
            frame?.children.add(tag.local)
            stack.push({ name: tag.local, children: new Set() }); events.open?.(tag)
        },
        text(value) { events.text?.(value) },
        close(tag) { events.close?.(tag); stack.pop() },
    })
}

export function part(entries: Map<string, Buffer>, path: string): Buffer {
    const bytes = entries.get(path)
    if (!bytes) throw new WorkbookFailure('TEMPLATE_STRUCTURE_INVALID')
    return bytes
}
export function releasePart(entries: Map<string, Buffer>, path: string, budget: WorkbookBudget): void {
    const bytes = entries.get(path)
    if (bytes) { entries.delete(path); budget.release(bytes.length) }
}

export function staticCatalogRange(value: string): boolean {
    return /^'(Danh mục loại mẫu|Danh mục chỉ tiêu|Danh mục tương thích)'!\$([A-C])\$([1-9][0-9]{0,6}):\$\2\$([1-9][0-9]{0,6})$/.test(value)
        && (() => { const rows = value.match(/\$([1-9][0-9]*)/g)!; return Number(rows[0].slice(1)) >= 2 && Number(rows[1].slice(1)) >= Number(rows[0].slice(1)) && Number(rows[1].slice(1)) <= 1048576 })()
}

// Resolve OOXML package relationships; names, MIME defaults and sheet order are never authority.
import { posix } from 'node:path'
import { SHEET_NAMES } from '../accession-template/contract'
import type { WorkbookBudget } from './budget'
import { WorkbookFailure, type WorkbookErrors } from './errors'
import { attribute, CT_NS, DOC_REL_NS, part, REL_NS, semanticXml, staticCatalogRange, unsupported } from './ooxml'

type Relationship = { id: string; type: string; target: string }
export type PackageLayout = { sheets: { name: string; path: string }[]; sharedStrings?: string; names: Map<string, string> }
const spreadsheetMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.'
const packageMime = 'application/vnd.openxmlformats-package.'

async function relationships(entries: Map<string, Buffer>, path: string, base: string, budget: WorkbookBudget): Promise<Relationship[]> {
    const result: Relationship[] = [], ids = new Set<string>()
    await semanticXml(part(entries, path), budget, { '': ['Relationships'], Relationships: ['Relationship'], Relationship: [] }, { open(tag) {
        if (tag.local !== 'Relationship') return
        const id = attribute(tag, 'Id'), type = attribute(tag, 'Type'), target = attribute(tag, 'Target')
        if (!id || !type || !target || ids.has(id) || ![undefined, 'Internal'].includes(attribute(tag, 'TargetMode')) || /[\\:#?%]/.test(target) || target.startsWith('//')) unsupported()
        const resolved = posix.normalize(target.startsWith('/') ? target.slice(1) : posix.join(base, target))
        if (resolved.startsWith('../') || !entries.has(resolved)) unsupported()
        budget.reserve(1024 + (id.length + type.length + resolved.length) * 2)
        ids.add(id); result.push({ id, type, target: resolved })
    } }, [REL_NS])
    return result
}

export async function readPackageLayout(entries: Map<string, Buffer>, budget: WorkbookBudget, errors: WorkbookErrors): Promise<PackageLayout> {
    const root = await relationships(entries, '_rels/.rels', '', budget)
    const office = root.filter(rel => rel.type === DOC_REL_NS + '/officeDocument')
    if (office.length !== 1 || office[0].target !== 'xl/workbook.xml' || root.some(rel => ![DOC_REL_NS + '/officeDocument', DOC_REL_NS + '/extended-properties', REL_NS + '/metadata/core-properties'].includes(rel.type))) unsupported()
    const rels = await relationships(entries, 'xl/_rels/workbook.xml.rels', 'xl', budget)
    const known = ['worksheet', 'styles', 'theme', 'sharedStrings', 'sheetMetadata']
    if (rels.some(rel => !known.some(kind => rel.type === DOC_REL_NS + '/' + kind))) unsupported()
    for (const kind of known.slice(1)) if (rels.filter(rel => rel.type === DOC_REL_NS + '/' + kind).length > 1) unsupported()
    const allowed = new Set(['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', ...root.map(rel => rel.target), ...rels.map(rel => rel.target)])
    if ([...entries.keys()].some(path => !allowed.has(path))) unsupported()
    const defaults = new Map<string, string>(), overrides = new Map<string, string>()
    await semanticXml(part(entries, '[Content_Types].xml'), budget, { '': ['Types'], Types: ['Default', 'Override'], Default: [], Override: [] }, { open(tag) {
        if (tag.local === 'Types') return
        const key = attribute(tag, tag.local === 'Default' ? 'Extension' : 'PartName'), mime = attribute(tag, 'ContentType')
        const map = tag.local === 'Default' ? defaults : overrides
        if (!key || !mime || map.has(key)) unsupported()
        budget.reserve(1024 + (key.length + mime.length) * 2); map.set(key, mime)
    } }, [CT_NS])
    const expectedMime = new Map<string, string>([
        ['xl/workbook.xml', spreadsheetMime + 'sheet.main+xml'],
        ['_rels/.rels', packageMime + 'relationships+xml'], ['xl/_rels/workbook.xml.rels', packageMime + 'relationships+xml'],
    ])
    for (const rel of rels) {
        const kind = rel.type.slice(DOC_REL_NS.length + 1)
        expectedMime.set(rel.target, kind === 'theme' ? 'application/vnd.openxmlformats-officedocument.theme+xml' : spreadsheetMime + kind + '+xml')
    }
    for (const rel of root) if (rel.type !== DOC_REL_NS + '/officeDocument') expectedMime.set(rel.target, rel.type.endsWith('/core-properties') ? packageMime + 'core-properties+xml' : 'application/vnd.openxmlformats-officedocument.extended-properties+xml')
    for (const [path, expected] of expectedMime) if ((overrides.get('/' + path) ?? defaults.get(path.split('.').at(-1)!)) !== expected) unsupported()
    for (const path of overrides.keys()) if (!entries.has(path.slice(1))) unsupported()
    const sheets: PackageLayout['sheets'] = [], names = new Map<string, string>(), sheetIds = new Set<string>(), paths = new Set<string>()
    let definedName: string | undefined, range = ''
    await semanticXml(part(entries, 'xl/workbook.xml'), budget, {
        '': ['workbook'], workbook: ['fileVersion', 'workbookPr', 'bookViews', 'sheets', 'definedNames', 'calcPr'],
        bookViews: ['workbookView'], sheets: ['sheet'], definedNames: ['definedName'],
        fileVersion: [], workbookPr: [], workbookView: [], sheet: [], calcPr: [], definedName: [],
    }, {
        open(tag) {
            if (tag.local === 'sheet') {
                const name = attribute(tag, 'name'), id = attribute(tag, 'id', DOC_REL_NS), sheetId = attribute(tag, 'sheetId'), state = attribute(tag, 'state')
                const rel = rels.find(value => value.id === id && value.type === DOC_REL_NS + '/worksheet')
                if (!name || !SHEET_NAMES.includes(name as typeof SHEET_NAMES[number]) || sheets.some(sheet => sheet.name === name) || !rel || paths.has(rel.target) || !sheetId || sheetIds.has(sheetId) || (state != null && state !== 'visible')) unsupported()
                budget.reserve(1024); sheets.push({ name, path: rel.target }); paths.add(rel.target); sheetIds.add(sheetId)
            }
            if (tag.local === 'definedName') {
                definedName = attribute(tag, 'name'); range = ''
                if (!definedName || !/^[A-Za-z_][A-Za-z0-9_.]{0,127}$/.test(definedName) || names.has(definedName) || attribute(tag, 'hidden') === '1' || attribute(tag, 'localSheetId') != null) unsupported()
            }
        },
        text(value) { if (definedName != null) range += value; else if (value.trim()) unsupported() },
        close(tag) {
            if (tag.local === 'definedName') {
                if (!staticCatalogRange(range)) unsupported()
                budget.reserve(1024 + range.length * 2); names.set(definedName!, range); definedName = undefined
            }
        },
    })
    for (const name of SHEET_NAMES) if (!sheets.some(sheet => sheet.name === name)) errors.add('TEMPLATE_STRUCTURE_INVALID', { sheet: name })
    if (!errors.errors.length && rels.filter(rel => rel.type === DOC_REL_NS + '/worksheet').length !== 8) throw new WorkbookFailure('TEMPLATE_STRUCTURE_INVALID')
    return { sheets, names, sharedStrings: rels.find(rel => rel.type === DOC_REL_NS + '/sharedStrings')?.target }
}

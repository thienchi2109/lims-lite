// Inspect every non-data OOXML part; only inert style/theme/property/template metadata is supported.
import type { WorkbookBudget } from './budget'
import { parseAccessionXml, SPREADSHEET_NS } from './xml'
import { unsupported } from './ooxml'

const drawing = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const allowed: Record<string, string[]> = {
    [SPREADSHEET_NS]: 'styleSheet numFmts numFmt fonts font sz color name family charset scheme b i u strike outline shadow condense extend vertAlign fills fill patternFill fgColor bgColor gradientFill stop borders border left right top bottom diagonal vertical horizontal start end cellStyleXfs xf alignment protection cellXfs cellStyles cellStyle dxfs dxf tableStyles tableStyle tableStyleElement colors indexedColors rgbColor mruColors metadata metadataTypes metadataType futureMetadata bk extLst ext cellMetadata rc'.split(' '),
    [drawing]: 'theme themeElements clrScheme dk1 sysClr lt1 dk2 srgbClr lt2 accent1 accent2 accent3 accent4 accent5 accent6 hlink folHlink fontScheme majorFont latin ea cs font minorFont fmtScheme fillStyleLst solidFill schemeClr gradFill gsLst gs tint satMod lin shade lnStyleLst ln prstDash effectStyleLst effectStyle effectLst outerShdw alpha scene3d camera rot lightRig sp3d bevelT bgFillStyleLst path fillToRect objectDefaults spDef spPr bodyPr lstStyle style lnRef fillRef effectRef fontRef lnDef extraClrSchemeLst'.split(' '),
    'http://schemas.microsoft.com/office/spreadsheetml/2017/dynamicarray': ['dynamicArrayProperties'],
    'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties': 'Properties Application AppVersion Company Manager DocSecurity ScaleCrop HeadingPairs TitlesOfParts LinksUpToDate SharedDoc HyperlinksChanged TotalTime'.split(' '),
    'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes': ['vector', 'variant', 'lpstr', 'i4', 'bool'],
    'http://schemas.openxmlformats.org/package/2006/metadata/core-properties': ['coreProperties', 'lastModifiedBy', 'revision', 'lastPrinted', 'category', 'contentStatus', 'keywords', 'version'],
    'http://purl.org/dc/elements/1.1/': ['creator', 'title', 'subject', 'description', 'identifier', 'language'],
    'http://purl.org/dc/terms/': ['created', 'modified'],
}
export async function inspectDecoration(bytes: Buffer, path: string, budget: WorkbookBudget): Promise<void> {
    let root = true
    await parseAccessionXml(bytes, budget, { open(tag) {
        if (!allowed[tag.uri]?.includes(tag.local)) unsupported()
        if (root) {
            const expected = path.endsWith('styles.xml') ? 'styleSheet' : path.includes('/theme/') ? 'theme' : path.endsWith('metadata.xml') ? 'metadata' : path.endsWith('app.xml') ? 'Properties' : path.endsWith('core.xml') ? 'coreProperties' : ''
            if (tag.local !== expected) unsupported()
            root = false
        }
    } })
}

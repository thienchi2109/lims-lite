// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { signingFixture, snapshotFixture } from '../accession-template/test-fixtures'
import { resourceFixture } from './test-fixtures'
import { mutateWorkbook, workbookFixture } from './workbook-fixtures'

vi.mock('server-only', () => ({}))
const options = () => ({ snapshot: snapshotFixture(), signingConfig: signingFixture(), resources: resourceFixture() })

describe('exact literal accession workbook', () => {
    it('reads a signed template with shared and inline literal text and physical row coordinates', async () => {
        const { parseAccessionWorkbook } = await import('./workbook')
        const result = await parseAccessionWorkbook(workbookFixture(), options())
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.value.sheets.get('Khách hàng')?.[1]).toEqual({ row: 2, values: ['KH-01', 'Khách thử', '2000-02-29', 'CMND', '001234567', null, null, null, '000123', null] })
            expect(result.value.template.revision).toBe('9007199254740993')
        }
    })

    it('accepts reordered sheets and validates hidden/filter rows', async () => {
        const { parseAccessionWorkbook } = await import('./workbook')
        const bytes = mutateWorkbook(workbookFixture(), {
            '/xl/workbook.xml': xml => xml.replace(/<sheets>(.*?)<\/sheets>/s, (_, sheets: string) => '<sheets>' + sheets.match(/<sheet\b[^>]*\/>/g)!.reverse().join('') + '</sheets>'),
            '/xl/worksheets/sheet3.xml': xml => xml.replace('<row r="2">', '<row r="2" hidden="1">').replace('</worksheet>', '<autoFilter ref="A1:J2"/></worksheet>'),
        })
        const result = await parseAccessionWorkbook(bytes, options())
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.value.sheets.get('Khách hàng')?.[1].values[4]).toBe('001234567')
    })

    it('flattens rich inline text and accepts static catalog dropdown names', async () => {
        const { parseAccessionWorkbook } = await import('./workbook')
        const bytes = mutateWorkbook(workbookFixture(), {
            '/xl/workbook.xml': xml => xml.replace('</workbook>', '<definedNames><definedName name="LoaiMau">\'Danh mục loại mẫu\'!$A$2:$A$3</definedName></definedNames></workbook>'),
            '/xl/worksheets/sheet3.xml': xml => xml.replace('<t xml:space="preserve">Khách thử</t>', '<r><rPr><b/></rPr><t>Khách </t></r><r><t>thử</t></r>'),
            '/xl/worksheets/sheet4.xml': xml => xml.replace('</worksheet>', '<dataValidations count="1"><dataValidation type="list" sqref="C2:C1048576"><formula1>LoaiMau</formula1></dataValidation></dataValidations></worksheet>'),
        })
        const result = await parseAccessionWorkbook(bytes, options())
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.value.sheets.get('Khách hàng')?.[1].values[1]).toBe('Khách thử')
    })

    it.each([
        ['formula', '<c r="B2" t="str"><f>"cached"</f><v>cached</v></c>'],
        ['cached formula', '<c r="B2" t="str"><v>cached</v></c>'],
        ['number', '<c r="B2"><v>123</v></c>'],
        ['boolean', '<c r="B2" t="b"><v>1</v></c>'],
        ['native date', '<c r="B2" t="d"><v>2000-01-01</v></c>'],
        ['error', '<c r="B2" t="e"><v>#REF!</v></c>'],
    ])('rejects %s with real location and no payload', async (_, cell) => {
        const { parseAccessionWorkbook } = await import('./workbook')
        const bytes = mutateWorkbook(workbookFixture(), { '/xl/worksheets/sheet3.xml': xml => xml.replace(/<c r="B2"[\s\S]*?<\/c>/, cell) })
        const result = await parseAccessionWorkbook(bytes, options())
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ sheet: 'Khách hàng', row: 2, column: 'B' }))
        expect(result).not.toHaveProperty('value')
    })

    it.each(['hidden-sheet', 'extra-column', 'duplicate-cell', 'merge', 'external-link', 'macro-part', 'computed-name', 'wrong-namespace', 'nested-cell'])('rejects unsupported %s semantically', async kind => {
        const { parseAccessionWorkbook } = await import('./workbook')
        const changes: Record<string, (xml: string) => string> = {}
        if (kind === 'hidden-sheet') changes['/xl/workbook.xml'] = xml => xml.replace('name="Khách hàng"', 'state="hidden" name="Khách hàng"')
        if (kind === 'extra-column') changes['/xl/worksheets/sheet3.xml'] = xml => xml.replace('</sheetData>', '<row r="9"><c r="K9" t="inlineStr"><is><t>hidden</t></is></c></row></sheetData>')
        if (kind === 'duplicate-cell') changes['/xl/worksheets/sheet3.xml'] = xml => xml.replace('<row r="2">', '<row r="2"><c r="A2" t="inlineStr"><is><t>other</t></is></c>')
        if (kind === 'merge') changes['/xl/worksheets/sheet3.xml'] = xml => xml.replace('</worksheet>', '<mergeCells count="1"><mergeCell ref="A2:B2"/></mergeCells></worksheet>')
        if (kind === 'external-link') changes['/xl/_rels/workbook.xml.rels'] = xml => xml.replace('</Relationships>', '<Relationship Id="evil" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink" Target="https://example.invalid" TargetMode="External"/></Relationships>')
        if (kind === 'computed-name') changes['/xl/workbook.xml'] = xml => xml.replace('</workbook>', '<definedNames><definedName name="evil">SUM(A1:A2)</definedName></definedNames></workbook>')
        if (kind === 'wrong-namespace') changes['/xl/worksheets/sheet3.xml'] = xml => xml.replace('<sheetData>', '<sheetData xmlns="urn:fake">')
        if (kind === 'nested-cell') changes['/xl/worksheets/sheet3.xml'] = xml => xml.replace('<row r="2">', '<row r="2"><foo><c r="J2" t="inlineStr"><is><t>hidden</t></is></c></foo>')
        const result = await parseAccessionWorkbook(mutateWorkbook(workbookFixture(), changes, kind === 'macro-part' ? ['/xl/vbaProject.bin', 'macro'] : undefined), options())
        expect(result.ok).toBe(false)
    })

    it('verifies literal metadata/catalogs and current authority through TASK-8 verifier', async () => {
        const { parseAccessionWorkbook } = await import('./workbook')
        const bytes = workbookFixture()
        const badCatalog = mutateWorkbook(bytes, { '/xl/sharedStrings.xml': xml => xml.replace('=Loại mẫu', 'Changed') })
        const result = await parseAccessionWorkbook(badCatalog, options())
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.errors[0]).toMatchObject({ code: 'TEMPLATE_METADATA_INVALID', sheet: 'Thông tin template', row: 6, column: 'B' })
        const changed = options(); changed.snapshot.revisionNumber = '9007199254740994'
        const stale = await parseAccessionWorkbook(bytes, changed)
        expect(stale.ok).toBe(false)
        if (!stale.ok) expect(stale.errors[0]).toMatchObject({ code: 'CATALOG_STALE', sheet: 'Thông tin template', row: 5, column: 'B' })
    })

    it('accumulates independent unsafe cells in deterministic contract/row/column order', async () => {
        const { parseAccessionWorkbook } = await import('./workbook')
        const bytes = mutateWorkbook(workbookFixture(), {
            '/xl/workbook.xml': xml => xml.replace(/<sheets>(.*?)<\/sheets>/s, (_, sheets: string) => '<sheets>' + sheets.match(/<sheet\b[^>]*\/>/g)!.reverse().join('') + '</sheets>'),
            '/xl/worksheets/sheet3.xml': xml => xml.replace(/<c r="B2"[\s\S]*?<\/c>/, '<c r="B2"><v>123</v></c>').replace(/<c r="C2"[\s\S]*?<\/c>/, '<c r="C2" t="str"><f>""</f><v/></c>'),
            '/xl/worksheets/sheet5.xml': xml => xml.replace(/<c r="B2"[\s\S]*?<\/c>/, '<c r="B2" t="b"><v>1</v></c>'),
        })
        const result = await parseAccessionWorkbook(bytes, options())
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.errors.map(error => [error.sheet, error.row, error.column, error.code])).toEqual([
            ['Khách hàng', 2, 'B', 'CELL_TYPE_INVALID'], ['Khách hàng', 2, 'C', 'WORKBOOK_FEATURE_UNSUPPORTED'], ['Chỉ định', 2, 'B', 'CELL_TYPE_INVALID'],
        ])
    })

    it('accepts a styled empty numeric cell but still rejects a formula returning empty', async () => {
        const { parseAccessionWorkbook } = await import('./workbook')
        const bytes = mutateWorkbook(workbookFixture(), { '/xl/worksheets/sheet3.xml': xml => xml.replace('<row r="2">', '<row r="2"><c r="H2" s="1" t="n"/>') })
        expect((await parseAccessionWorkbook(bytes, options())).ok).toBe(true)
    })

    it('reports every missing sheet with the expected sheet name and no invented coordinates', async () => {
        const { parseAccessionWorkbook } = await import('./workbook')
        const bytes = mutateWorkbook(workbookFixture(), { '/xl/workbook.xml': xml => xml.replace(/<sheet name="(?:Mẫu|Chỉ định)"[^>]*\/>/g, '') })
        const result = await parseAccessionWorkbook(bytes, options())
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.errors).toEqual(['Mẫu', 'Chỉ định'].map(sheet => expect.objectContaining({ sheet, row: null, column: null, header: null })))
    })

    it.each(['guide', 'unused-sst-formula', 'extra-empty-column', 'external-hyperlink', 'dropdown-outside-catalog'])('rejects unsafe or read-only change %s', async kind => {
        const { parseAccessionWorkbook } = await import('./workbook')
        const changes: Record<string, (xml: string) => string> = {}
        if (kind === 'guide') changes['/xl/sharedStrings.xml'] = xml => xml.replace('Chỉ tiếp nhận mẫu mới', 'Nội dung sửa đổi')
        if (kind === 'unused-sst-formula') changes['/xl/sharedStrings.xml'] = xml => xml.replace('</sst>', '<si><f>1+1</f><t>unused</t></si></sst>')
        if (kind === 'extra-empty-column') changes['/xl/worksheets/sheet3.xml'] = xml => xml.replace('<row r="2">', '<row r="2"><c r="K2" s="1"/>')
        if (kind === 'external-hyperlink') changes['/xl/worksheets/sheet3.xml'] = xml => xml.replace('</worksheet>', '<hyperlinks><hyperlink ref="B2" location="https://example.invalid"/></hyperlinks></worksheet>')
        if (kind === 'dropdown-outside-catalog') changes['/xl/worksheets/sheet4.xml'] = xml => xml.replace('</worksheet>', '<dataValidations count="1"><dataValidation type="list" sqref="C2:C10"><formula1>\'Danh mục loại mẫu\'!$A$2:$A$999</formula1></dataValidation></dataValidations></worksheet>')
        expect((await parseAccessionWorkbook(mutateWorkbook(workbookFixture(), changes), options())).ok).toBe(false)
    })

    it('accepts namespace aliases and direct static internal catalog dropdown ranges', async () => {
        const { parseAccessionWorkbook } = await import('./workbook')
        const bytes = mutateWorkbook(workbookFixture(), {
            '/xl/worksheets/sheet4.xml': xml => xml.replace('</worksheet>', '<dataValidations count="1"><dataValidation type="list" sqref="C2:C10"><formula1>\'Danh mục loại mẫu\'!$A$2:$A$3</formula1></dataValidation></dataValidations></worksheet>')
                .replace('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', 'xmlns:s="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')
                .replace(/<(\/?)([A-Za-z][A-Za-z0-9]*)(?=[\s/>])/g, '<$1s:$2'),
        })
        expect((await parseAccessionWorkbook(bytes, options())).ok).toBe(true)
    })

    it('reports unavailable server signing/authority configuration without blaming workbook cells or leaking inputs', async () => {
        const { parseAccessionWorkbook } = await import('./workbook')
        const bytes = workbookFixture()
        for (const [change, code] of [
            [{ signingConfig: { secret: 'DO-NOT-ECHO' } }, 'ACCESSION_TEMPLATE_CONFIGURATION_UNAVAILABLE'],
            [{ snapshot: { secret: 'DO-NOT-ECHO' } }, 'ACCESSION_TEMPLATE_CATALOG_UNAVAILABLE'],
        ] as const) {
            const result = await parseAccessionWorkbook(bytes, { ...options(), ...change })
            expect(result.ok).toBe(false)
            if (!result.ok) expect(result.errors).toEqual([expect.objectContaining({ code, sheet: null, row: null, column: null, message: expect.stringContaining('chưa sẵn sàng') })])
            expect(JSON.stringify(result)).not.toContain('DO-NOT-ECHO')
        }
    })

    it.each(['split-sheets', 'duplicate-sheetData', 'duplicate-workbookPr', 'duplicate-definedNames', 'duplicate-dimension', 'duplicate-cols', 'duplicate-validation', 'duplicate-cell-is', 'duplicate-rich-text'])('rejects ambiguous singleton multiplicity: %s', async kind => {
        const { parseAccessionWorkbook } = await import('./workbook')
        const changes: Record<string, (xml: string) => string> = {}
        if (kind === 'split-sheets') changes['/xl/workbook.xml'] = xml => xml.replace(/(<sheet name="Khách hàng"[^>]*\/>)/, '</sheets><sheets>$1')
        if (kind === 'duplicate-sheetData') changes['/xl/worksheets/sheet3.xml'] = xml => xml.replace('</sheetData>', '</sheetData><sheetData><row r="99"><c r="B99" t="inlineStr"><is><t>Hidden additional data</t></is></c></row></sheetData>')
        if (kind === 'duplicate-workbookPr') changes['/xl/workbook.xml'] = xml => xml.replace('</workbook>', '<workbookPr/></workbook>')
        if (kind === 'duplicate-definedNames') changes['/xl/workbook.xml'] = xml => xml.replace('</workbook>', '<definedNames/><definedNames/></workbook>')
        if (kind === 'duplicate-dimension') changes['/xl/worksheets/sheet3.xml'] = xml => xml.replace('</worksheet>', '<dimension ref="A1"/></worksheet>')
        if (kind === 'duplicate-cols') changes['/xl/worksheets/sheet3.xml'] = xml => xml.replace('</worksheet>', '<cols/></worksheet>')
        if (kind === 'duplicate-validation') changes['/xl/worksheets/sheet3.xml'] = xml => xml.replace('</worksheet>', '<dataValidations/><dataValidations/></worksheet>')
        if (kind === 'duplicate-cell-is') changes['/xl/worksheets/sheet3.xml'] = xml => xml.replace('<t xml:space="preserve">Khách thử</t>', '<t>Khách</t><t>thử</t>')
        if (kind === 'duplicate-rich-text') changes['/xl/worksheets/sheet3.xml'] = xml => xml.replace('<t xml:space="preserve">Khách thử</t>', '<r><t>Khách</t><t>thử</t></r>')
        expect((await parseAccessionWorkbook(mutateWorkbook(workbookFixture(), changes), options())).ok).toBe(false)
    })

    it.each(['_x0000_', '_xD800_', '_xDC00_'])('rejects a literal that cannot be represented by downstream text: %s', async value => {
        const { parseAccessionWorkbook } = await import('./workbook')
        const bytes = mutateWorkbook(workbookFixture(), { '/xl/worksheets/sheet3.xml': xml => xml.replace('Khách thử', value) })
        const result = await parseAccessionWorkbook(bytes, options())
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ code: 'CELL_VALUE_INVALID', sheet: 'Khách hàng', row: 2, column: 'B' }))
    })

    it('preserves valid encoded surrogate pairs and escaped literal OOXML escape sequences', async () => {
        const { parseAccessionWorkbook } = await import('./workbook')
        const bytes = mutateWorkbook(workbookFixture(), { '/xl/worksheets/sheet3.xml': xml => xml.replace('Khách thử', '_xD83D__xDE00_ _x005F_x0041_') })
        const result = await parseAccessionWorkbook(bytes, options())
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.value.sheets.get('Khách hàng')?.[1].values[1]).toBe('😀 _x0041_')
    })

    it('rejects unrepresentable unused shared-string values too', async () => {
        const { parseAccessionWorkbook } = await import('./workbook')
        const bytes = mutateWorkbook(workbookFixture(), { '/xl/sharedStrings.xml': xml => xml.replace('</sst>', '<si><t>_x0000_</t></si></sst>') })
        expect((await parseAccessionWorkbook(bytes, options())).ok).toBe(false)
    })

    it('rejects unexpected literal content in package structural XML', async () => {
        const { parseAccessionWorkbook } = await import('./workbook')
        const bytes = mutateWorkbook(workbookFixture(), { '/xl/_rels/workbook.xml.rels': xml => xml.replace('</Relationships>', 'unexpected structural text</Relationships>') })
        expect((await parseAccessionWorkbook(bytes, options())).ok).toBe(false)
    })
})

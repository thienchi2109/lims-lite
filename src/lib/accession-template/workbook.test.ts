// @vitest-environment node
import * as XLSX from 'xlsx'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generatedAtFixture, signingFixture, snapshotFixture } from './test-fixtures'

vi.mock('server-only', () => ({}))
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
const names = ['Hướng dẫn', 'Thông tin template', 'Khách hàng', 'Mẫu', 'Chỉ định', 'Danh mục loại mẫu', 'Danh mục chỉ tiêu', 'Danh mục tương thích']
const headers = [
    ['Thuộc tính', 'Giá trị'],
    ['Mã khách hàng tạm', 'Họ và tên', 'Ngày sinh', 'Loại giấy tờ', 'Số giấy tờ', 'Giới tính', 'Số điện thoại', 'Địa chỉ', 'Số BHYT', 'Ngày hết hạn BHYT'],
    ['Mã mẫu tạm', 'Mã khách hàng tạm', 'Mã loại mẫu'], ['Mã mẫu tạm', 'Mã chỉ tiêu'],
    ['Mã loại mẫu', 'Tên loại mẫu'], ['Mã chỉ tiêu', 'Tên chỉ tiêu', 'Phương pháp'], ['Mã loại mẫu', 'Mã chỉ tiêu'],
]
const rows = (workbook: XLSX.WorkBook, name: string) => XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[name], { header: 1, raw: true, defval: '' })

describe('accession workbook XLSX round-trip', () => {
    it('physically encodes literal cells as shared strings instead of cached-formula string cells', async () => {
        const { generateAccessionTemplate } = await import('./workbook')
        const archive = XLSX.CFB.read(generateAccessionTemplate(snapshotFixture(), signingFixture()), { type: 'buffer' })
        expect(XLSX.CFB.find(archive, '/xl/sharedStrings.xml')).toBeTruthy()
        for (let index = 1; index <= 8; index++) {
            const xml = Buffer.from(XLSX.CFB.find(archive, `/xl/worksheets/sheet${index}.xml`).content).toString('utf8')
            expect(xml).not.toMatch(/<c\b[^>]*\bt="str"/)
            expect(xml).toMatch(/<c\b[^>]*\bt="s"/)
        }
    })

    it('emits exact eight visible sheets, literal headers/metadata/catalogs and no business rows', async () => {
        const { generateAccessionTemplate } = await import('./workbook')
        const { verifyTemplateBinding } = await import('./binding')
        vi.useFakeTimers(); vi.setSystemTime(new Date(generatedAtFixture))
        const data = generateAccessionTemplate(snapshotFixture(), signingFixture())
        expect(Buffer.isBuffer(data)).toBe(true)
        expect(data.length).toBeLessThan(10_000_000)
        const book = XLSX.read(data, { type: 'buffer', cellNF: true, cellStyles: true })
        expect(book.SheetNames).toEqual(names)
        expect(book.Workbook?.Sheets?.every(sheet => !sheet.Hidden)).toBe(true)
        names.slice(1).forEach((name, i) => expect(rows(book, name)[0]).toEqual(headers[i]))
        for (const name of names.slice(2, 5)) {
            expect(rows(book, name)).toHaveLength(1)
        }
        const archive = XLSX.CFB.read(data, { type: 'buffer' })
        const xml = (path: string) => Buffer.from(XLSX.CFB.find(archive, path).content).toString('utf8')
        const formats = [...xml('/xl/styles.xml').match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)![1].matchAll(/<xf\b[^>]*\/>/g)].map(match => match[0])
        for (let sheet = 3; sheet <= 5; sheet++) {
            const source = xml(`/xl/worksheets/sheet${sheet}.xml`)
            const columns = [...source.matchAll(/<col\b[^>]*\/>/g)].map(match => match[0])
            expect(columns).toHaveLength(headers[sheet - 2].length)
            columns.forEach((column, i) => {
                expect(column).toContain(`min="${i + 1}" max="${i + 1}"`)
                expect(formats[Number(column.match(/style="([0-9]+)"/)![1])]).toContain('numFmtId="49"')
            })
            expect([...source.matchAll(/<row r="([0-9]+)"/g)].map(match => match[1])).toEqual(['1'])
            expect(source).not.toMatch(/<c r="[A-Z]+[2-9][0-9]*"/)
        }
        for (const name of names.slice(1)) {
            for (const [address, cell] of Object.entries(book.Sheets[name])) {
                if (!address.startsWith('!')) { expect(cell.t).toBe('s'); expect(cell.f).toBeUndefined() }
            }
        }
        const meta = rows(book, names[1])
        expect(meta.map(row => row[0])).toEqual(['Thuộc tính', 'template_id', 'template_version', 'generated_at', 'compatibility_revision', 'catalog_binding'])
        expect(meta[1][1]).toBe('lims-bulk-accession'); expect(meta[2][1]).toBe('1')
        expect(meta[3][1]).toBe(generatedAtFixture); expect(meta[4][1]).toBe('9007199254740993')
        expect(rows(book, names[5])[1]).toEqual(['LM-000001', '=Loại mẫu'])
        expect(rows(book, names[6])[1]).toEqual(['CT-000001', '+Chỉ tiêu', '=Phương pháp'])
        expect(verifyTemplateBinding(meta, names.slice(5).map(name => rows(book, name)), signingFixture(), snapshotFixture())).toBeDefined()
    })

    it('teaches the approved Vietnamese input boundary with examples only in guide', async () => {
        const { generateAccessionTemplate } = await import('./workbook')
        const book = XLSX.read(generateAccessionTemplate(snapshotFixture(), signingFixture()), { type: 'buffer' })
        const guide = rows(book, names[0]).flat().join(' ')
        for (const text of ['đã lấy', 'chất lượng đạt', 'YYYY-MM-DD', '1900', '2100', 'CCCD', 'CMND', 'Giới tính', 'Số điện thoại', 'tạo mới', 'số 0 đầu', 'dán giá trị', '10.000.000', 'KH-001', 'M-001']) expect(guide).toContain(text)
        expect(guide).not.toMatch(/tối đa \d+ (khách|mẫu|chỉ định)/i)
    })

    it('rejects unavailable authority/configuration without emitting a workbook', async () => {
        const { generateAccessionTemplate } = await import('./workbook')
        for (const snapshot of [null, { ...snapshotFixture(), pairs: [] }]) expect(() => generateAccessionTemplate(snapshot, signingFixture())).toThrow()
        expect(() => generateAccessionTemplate(snapshotFixture(), {})).toThrow()
    })

    it('fails closed through the native writer on Excel grid overflow', async () => {
        const { generateAccessionTemplate } = await import('./workbook')
        const toSheet = XLSX.utils.aoa_to_sheet
        vi.spyOn(XLSX.utils, 'aoa_to_sheet').mockImplementationOnce((rows, options) => {
            const sheet = toSheet(rows, options)
            sheet['!ref'] = 'A1048577'
            return sheet
        })
        expect(() => generateAccessionTemplate(snapshotFixture(), signingFixture())).toThrow(/exceeds format limit/)
    })

    it('rejects output at the decimal file ceiling without truncation', async () => {
        const { assertTemplateFileSize, generateAccessionTemplate } = await import('./workbook')
        expect(() => assertTemplateFileSize(9_999_999)).not.toThrow()
        for (const bytes of [10_000_000, 10_000_001]) expect(() => assertTemplateFileSize(bytes)).toThrow()
        const write = XLSX.CFB.write
        vi.spyOn(XLSX.CFB, 'write').mockImplementationOnce(write).mockReturnValue(Buffer.alloc(10_000_000))
        expect(() => generateAccessionTemplate(snapshotFixture(), signingFixture())).toThrow('ACCESSION_TEMPLATE_FILE_TOO_LARGE')
    })
})

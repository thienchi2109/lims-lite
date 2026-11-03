// Physical OOXML fixtures: real signed template with literal inline business cells and ZIP mutations.
import * as XLSX from 'xlsx'
import { generateAccessionTemplate } from '../accession-template/workbook'
import { signingFixture, snapshotFixture } from '../accession-template/test-fixtures'

export const xmlEscape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!)
export function inlineRow(row: number, values: (string | null)[]): string {
    return `<row r="${row}">${values.map((value, index) => value == null ? '' : `<c r="${String.fromCharCode(65 + index)}${row}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`).join('')}</row>`
}

export function mutateWorkbook(bytes: Buffer, changes: Record<string, (xml: string) => string>, extra?: [string, string]): Buffer {
    const archive = XLSX.CFB.read(bytes, { type: 'buffer' })
    for (const [path, update] of Object.entries(changes)) XLSX.CFB.utils.cfb_add(archive, path, Buffer.from(update(Buffer.from(XLSX.CFB.find(archive, path).content).toString('utf8'))))
    if (extra) XLSX.CFB.utils.cfb_add(archive, extra[0], Buffer.from(extra[1]))
    return XLSX.CFB.write(archive, { type: 'buffer', fileType: 'zip', compression: true })
}

export function workbookFixture(rows?: (string | null)[][][]): Buffer {
    const bytes = generateAccessionTemplate(snapshotFixture(), signingFixture())
    const business = rows ?? [
        [['KH-01', 'Khách thử', '2000-02-29', 'CMND', '001234567', null, null, null, '000123', null]],
        [['M-01', 'KH-01', 'LM-000001']], [['M-01', 'CT-000001']],
    ]
    return mutateWorkbook(bytes, Object.fromEntries(business.map((matrix, index) => [`/xl/worksheets/sheet${index + 3}.xml`, (xml: string) => xml.replace('</sheetData>', matrix.map((values, row) => inlineRow(row + 2, values)).join('') + '</sheetData>')])))
}

// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { signingFixture, snapshotFixture } from '../accession-template/test-fixtures'
import { resourceFixture } from './test-fixtures'
import { inlineRow, mutateWorkbook, workbookFixture } from './workbook-fixtures'

vi.mock('server-only', () => ({}))
const options = () => ({ snapshot: snapshotFixture(), signingConfig: signingFixture(), resources: resourceFixture() })
const client = (reference = 'KH-01') => [reference, 'Khách thử', '2000-02-29', 'CMND', '001234567', null, null, null, '000123', null]

describe('all-or-nothing accession structural validation', () => {
    it('normalizes trim/NFC/null and shared canonical phone without losing leading zeros or literal placeholders', async () => {
        const { validateAccessionWorkbook } = await import('./validate')
        const values = client(); values[1] = '  Khách thử  '.normalize('NFD'); values[5] = 'Nữ'; values[6] = ' +84 987 654 321 '; values[7] = ' N/A '
        const result = await validateAccessionWorkbook(workbookFixture([[values], [['M-01', 'KH-01', 'LM-000001']], [['M-01', 'CT-000001']]]), options())
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.value.clients[0]).toMatchObject({ temporaryReference: 'KH-01', name: 'Khách thử', governmentIdentityType: 'cmnd', governmentIdentityValue: '001234567', phone: '0987654321', address: 'N/A', healthInsuranceNum: '000123', expiryDate: null, callerContext: { sheet: 'Khách hàng', row: 2 } })
            expect(result.value.samples).toHaveLength(1); expect(result.value.assignments).toHaveLength(1)
            expect(result.value).not.toHaveProperty('sheets'); expect(result.value).not.toHaveProperty('budget')
        }
    })

    it('allows missing create-only phone/gender, treats sentinel phone as null and does not deduplicate same name/DOB', async () => {
        const { validateAccessionWorkbook } = await import('./validate')
        const first = client(), second = client('KH-02'); second[4] = '001234568'; first[6] = '0000000000'
        const result = await validateAccessionWorkbook(workbookFixture([[first, second], [['M-01', 'KH-01', 'LM-000001'], ['M-02', 'KH-02', 'LM-000001']], [['M-01', 'CT-000001'], ['M-02', 'CT-000001']]]), options())
        expect(result.ok).toBe(true)
        if (result.ok) { expect(result.value.clients).toHaveLength(2); expect(result.value.clients[0]).toMatchObject({ gender: null, phone: null }) }
    })

    it('reads physical sparse/hidden rows and permits forward references', async () => {
        const { validateAccessionWorkbook } = await import('./validate')
        const bytes = mutateWorkbook(workbookFixture(), { '/xl/worksheets/sheet3.xml': xml => xml.replace(/<row r="2">[\s\S]*?<\/row>/, '<row r="3"/>' + inlineRow(17, client()).replace('<row r="17">', '<row r="17" hidden="1">')) })
        const result = await validateAccessionWorkbook(bytes, options())
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.value.clients[0].callerContext.row).toBe(17)
    })

    it('reports all duplicate reference and sample-assay pair rows with related physical locations', async () => {
        const { validateAccessionWorkbook } = await import('./validate')
        const result = await validateAccessionWorkbook(workbookFixture([[client(), client()], [['M-01', 'KH-01', 'LM-000001'], ['M-01', 'KH-01', 'LM-000001']], [['M-01', 'CT-000001'], ['M-01', 'CT-000001']]]), options())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.errors.filter(error => error.code === 'TEMP_REFERENCE_DUPLICATE')).toHaveLength(4)
            expect(result.errors.filter(error => error.code === 'ASSIGNMENT_DUPLICATE')).toHaveLength(2)
            expect(result.errors.filter(error => /DUPLICATE/.test(error.code)).every(error => error.relatedLocations?.length === 2)).toBe(true)
        }
    })

    it('accumulates case-sensitive missing references, invalid codes, typed IDs, dates and optional fields without exposing profile values', async () => {
        const { validateAccessionWorkbook } = await import('./validate')
        const values = client(); values[1] = 'PRIVATE-NAME'; values[2] = '2025-02-29'; values[3] = null; values[5] = 'nu'; values[6] = 'bad-phone'; values[9] = '2101-01-01'
        const result = await validateAccessionWorkbook(workbookFixture([[values], [['M-01', 'kh-01', 'LM-999999']], [['m-01', 'CT-999999']]]), options())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            for (const code of ['DATE_INVALID', 'IDENTITY_INVALID', 'VALUE_INVALID', 'TEMP_REFERENCE_NOT_FOUND', 'CATALOG_CODE_INVALID']) expect(result.errors.some(error => error.code === code)).toBe(true)
            expect(result.errors.some(error => error.code === 'COMPATIBILITY_INVALID')).toBe(false)
            expect(result.errors.some(error => error.sheet === 'Khách hàng' && error.column === 'J')).toBe(true)
        }
        expect(JSON.stringify(result)).not.toContain('PRIVATE-NAME'); expect(result).not.toHaveProperty('value')
    })

    it.each([['1900-02-29', false], ['2000-02-29', true], ['2100-02-29', false], ['1900-01-01', true], ['2100-12-31', true], ['01/01/2000', false], ['2000-01-01T00:00:00Z', false]])('validates strict calendar date %s', async (date, accepted) => {
        const { validateAccessionWorkbook } = await import('./validate')
        const values = client(); values[2] = date as string
        const result = await validateAccessionWorkbook(workbookFixture([[values], [['M-01', 'KH-01', 'LM-000001']], [['M-01', 'CT-000001']]]), options())
        expect(result.ok).toBe(accepted)
    })

    it('detects orphans and real catalog incompatibility, preserving independent errors', async () => {
        const { validateAccessionWorkbook } = await import('./validate')
        const result = await validateAccessionWorkbook(workbookFixture([[client(), client('KH-02')], [['M-01', 'KH-01', 'LM-000001'], ['M-02', 'KH-01', 'LM-000001']], [['M-01', 'CT-000002']]]), options())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.errors.filter(error => error.code === 'ORPHAN_ROW')).toHaveLength(2)
            expect(result.errors.some(error => error.code === 'COMPATIBILITY_INVALID' && error.sheet === 'Chỉ định' && error.column === 'B')).toBe(true)
        }
    })

    it('validates required, length and temporary-reference syntax after normalization', async () => {
        const { validateAccessionWorkbook } = await import('./validate')
        const values = client('bad ref'); values[1] = '   '; values[6] = '+84' + ' '.repeat(30) + '987654321'; values[7] = 'x'.repeat(501); values[8] = 'x'.repeat(81)
        const result = await validateAccessionWorkbook(workbookFixture([[values], [['M-01', 'bad ref', 'LM-000001']], [['M-01', 'CT-000001']]]), options())
        expect(result.ok).toBe(false)
        if (!result.ok) for (const column of ['A', 'B', 'G', 'H', 'I']) expect(result.errors.some(error => error.sheet === 'Khách hàng' && error.column === column)).toBe(true)
    })

    it('requires at least one row in each business sheet without inventing a row zero', async () => {
        const { validateAccessionWorkbook } = await import('./validate')
        const result = await validateAccessionWorkbook(workbookFixture([[], [], []]), options())
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.errors).toHaveLength(3)
    })

    it.each([
        ['CCCD', '001234567890', true], ['CMND', '001234567', true],
        ['CCCD', '00123456789', false], ['CMND', '001234567890', false],
        ['cccd', '001234567890', false], ['CCCD', '００１２３４５６７８９０', false],
        ['CCCD', null, false], [null, '001234567890', false], [null, null, true],
    ])('validates exact typed identity %s / %s', async (type, value, accepted) => {
        const { validateAccessionWorkbook } = await import('./validate')
        const values = client(); values[3] = type; values[4] = value
        const result = await validateAccessionWorkbook(workbookFixture([[values], [['M-01', 'KH-01', 'LM-000001']], [['M-01', 'CT-000001']]]), options())
        expect(result.ok).toBe(accepted)
        if (!accepted && !result.ok) expect(result.errors.some(error => error.code === 'IDENTITY_INVALID')).toBe(true)
    })

    it('accepts different case-sensitive client/sample namespaces and exact optional field length boundaries', async () => {
        const { validateAccessionWorkbook } = await import('./validate')
        const values = client('same'); values[1] = 'x'.repeat(200); values[7] = 'x'.repeat(500); values[8] = '0'.repeat(80); values[9] = '2100-12-31'
        const result = await validateAccessionWorkbook(workbookFixture([[values], [['same', 'same', 'LM-000001']], [['same', 'CT-000001']]]), options())
        expect(result.ok).toBe(true)
    })

    it('reports a single diagnostic per cell/code for phone length and unknown identity type', async () => {
        const { validateAccessionWorkbook } = await import('./validate')
        const values = client(); values[3] = 'PASSPORT'; values[6] = '0'.repeat(31)
        const result = await validateAccessionWorkbook(workbookFixture([[values], [['M-01', 'KH-01', 'LM-000001']], [['M-01', 'CT-000001']]]), options())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.errors.filter(error => error.sheet === 'Khách hàng' && error.column === 'D' && error.code === 'IDENTITY_INVALID')).toHaveLength(1)
            expect(result.errors.filter(error => error.sheet === 'Khách hàng' && error.column === 'G' && error.code === 'VALUE_INVALID')).toHaveLength(1)
        }
    })
})

describe('former business caps do not truncate source validation', () => {
    it.each([[501, 501], [1, 1001], [1, 20001]])('processes %i clients and %i samples/assignments; invalid final cell has no partial output', async (clients, count) => {
        const { validateAccessionWorkbook } = await import('./validate')
        const customers = Array.from({ length: clients }, (_, index) => { const values = client('KH-' + index); values[3] = null; values[4] = null; return values })
        const samples = Array.from({ length: count }, (_, index) => ['M-' + index, 'KH-' + (index % clients), 'LM-000001'])
        const assignments = Array.from({ length: count }, (_, index) => ['M-' + index, 'CT-000001'])
        const bytes = workbookFixture([customers, samples, assignments])
        const config = { ...options(), resources: { ...resourceFixture(), maxRetainedBytes: 1024 * 1024 * 1024 } }
        const result = await validateAccessionWorkbook(bytes, config)
        expect(result.ok).toBe(true)
        if (result.ok) { expect(result.value.clients).toHaveLength(clients); expect(result.value.assignments).toHaveLength(count) }
        if (count === 20001) {
            const bad = mutateWorkbook(bytes, { '/xl/worksheets/sheet5.xml': xml => xml.replace(new RegExp(`(<c r="B${count + 1}"[^>]*><is><t[^>]*>)CT-000001`), '$1CT-999999') })
            const invalid = await validateAccessionWorkbook(bad, config)
            expect(invalid.ok).toBe(false); expect(invalid).not.toHaveProperty('value')
            if (!invalid.ok) expect(invalid.errors).toContainEqual(expect.objectContaining({ sheet: 'Chỉ định', row: count + 1, column: 'B', code: 'CATALOG_CODE_INVALID' }))
        }
    }, 30_000)
})

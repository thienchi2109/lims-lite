// accession-intent-v1 vectors also appear in tests/accession-preview-canonicalization.sql.
// These application tests do not execute SQL or prove cross-runtime normalization parity.
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { ValidatedAccessionWorkbook } from '@/lib/accession-workbook/validate'
import type { PlannedClient } from './clients'
import { canonicalizeAccessionIntent } from './intent'

vi.mock('server-only', () => ({}))
const goldenJson = '[["an","2000-01-01",null,null,"Nam","0901234567",null,null,null,[["ST-DEMO","acceptable",["CT-000001"]]]]]'
const goldenHash = '090da05ce3b97394845d98b5d3fde180f150b3d452b5f067155466859a4e908e'
const fields = { name: 'an', dateOfBirth: '2000-01-01', governmentIdentityType: null, governmentIdentityValue: null,
    gender: 'Nam' as const, phone: '0901234567', address: null, healthInsuranceNum: null, expiryDate: null }
function client(reference = 'C1', row = 4, patch = {}): PlannedClient {
    return { row, input: { ...fields, ...patch }, resolution: { outcome: 'not_found', reasonCode: 'identity_not_found', clientId: null, created: false },
        disposition: 'create', clientId: null, trustedIdentity: null, displayValues: null, issues: [],
        callerContext: { sheet: 'Khách hàng', row, temporaryReference: reference } }
}
function fixture(clients = [client()]) {
    const workbook = { template: {}, clients: clients.map(value => ({ ...value.input, temporaryReference: value.callerContext.temporaryReference, callerContext: value.callerContext })),
        samples: clients.map((value, index) => ({ temporaryReference: `S${index + 1}`, clientTemporaryReference: value.callerContext.temporaryReference,
            sampleTypeCode: index ? 'ST-OTHER' : 'ST-DEMO', callerContext: { sheet: 'Mẫu', row: index + 4, temporaryReference: `S${index + 1}` } })),
        assignments: clients.map((_, index) => ({ sampleTemporaryReference: `S${index + 1}`, assayCode: index ? 'CT-000002' : 'CT-000001',
            callerContext: { sheet: 'Chỉ định', row: index + 4, temporaryReference: `S${index + 1}` } })) } as unknown as ValidatedAccessionWorkbook
    return { workbook, clients }
}
async function run(value: ReturnType<typeof fixture>) {
    return canonicalizeAccessionIntent(value.workbook, value.clients)
}

describe('accession-intent-v1', () => {
    it('matches exact golden bytes and domain-separated SHA-256', async () => {
        expect(await run(fixture())).toEqual({ canonicalJson: goldenJson, canonicalizationVersion: 'accession-intent-v1', normalizedPayloadHash: goldenHash })
        expect(createHash('sha256').update('lims-lite:bulk-accession:intent:v1\n' + goldenJson, 'utf8').digest('hex')).toBe(goldenHash)
    })

    it('hashes Phase 1 normalized input, keeping optional input significant on reuse', async () => {
        const value = fixture(), before = await run(value)
        value.clients[0] = { ...value.clients[0], disposition: 'reuse', clientId: '11111111-1111-4111-8111-111111111111',
            resolution: { outcome: 'matched', reasonCode: 'name_dob_match', clientId: '11111111-1111-4111-8111-111111111111', created: false },
            displayValues: { ...fields, name: 'EXISTING DISPLAY', address: 'Existing address' } }
        expect(await run(value)).toEqual(before)
        value.clients[0].input.address = 'Supplied address'
        expect((await run(value)).normalizedPayloadHash).not.toBe(before.normalizedPayloadHash)
    })

    it('preserves literal normalized Unicode/control characters and uses UTF-8 byte order', async () => {
        // SQL vector unicode-control: E000 sorts before U+10000 by UTF-8, opposite UTF-16 default sort.
        const value = fixture([client('C1', 4, { name: '\u{10000}', address: '"\\\b\f\n\r\t\u0001\u2028\u2029' }), client('C2', 8, { name: '\uE000', phone: '0901234568' })])
        const result = await run(value), tuples = JSON.parse(result.canonicalJson)
        expect(tuples.map((tuple: string[]) => tuple[0])).toEqual(['\uE000', '\u{10000}'])
        expect(result.canonicalJson).toBe(JSON.stringify([
            ['\uE000', '2000-01-01', null, null, 'Nam', '0901234568', null, null, null, [['ST-OTHER', 'acceptable', ['CT-000002']]]],
            ['\u{10000}', '2000-01-01', null, null, 'Nam', '0901234567', '"\\\b\f\n\r\t\u0001\u2028\u2029', null, null, [['ST-DEMO', 'acceptable', ['CT-000001']]]],
        ]))
        expect(result.canonicalJson).not.toMatch(/^\uFEFF|\n$/)
        expect(result.canonicalJson).toContain('\u{10000}')
        expect(Buffer.byteLength(result.canonicalJson, 'utf8')).toBe(239)
        expect(result.normalizedPayloadHash).toBe('6ef396284f59ca65aa652936439faffc4406111fb34f3fa99de59a8bbfc72b5d')
    })

    it('does not approximate SQL normalization or discard leading zeros', async () => {
        const value = fixture([client('C1', 4, { name: 'nguyễn thị an', governmentIdentityType: 'cccd', governmentIdentityValue: '001234567890',
            phone: '0901234567', healthInsuranceNum: '000ABC' })])
        expect(JSON.parse((await run(value)).canonicalJson)[0].slice(0, 9)).toEqual(['nguyễn thị an', '2000-01-01', 'cccd', '001234567890', 'Nam', '0901234567', null, '000ABC', null])
    })

    it('represents absent optional scalars by JSON null', async () => {
        const value = fixture()
        Reflect.deleteProperty(value.clients[0].input, 'address')
        Reflect.set(value.clients[0].input, 'healthInsuranceNum', undefined)
        expect((await run(value)).canonicalJson).toBe(goldenJson)
    })

    it('sorts assignment codes and serialized samples without mutating source arrays', async () => {
        const value = fixture()
        value.workbook.samples.push({ ...value.workbook.samples[0], temporaryReference: 'S2', sampleTypeCode: 'ST-AA' })
        value.workbook.assignments.push({ ...value.workbook.assignments[0], assayCode: 'CT-000003' },
            { ...value.workbook.assignments[0], sampleTemporaryReference: 'S2', assayCode: 'CT-000002' })
        value.workbook.assignments.reverse()
        const snapshot = structuredClone(value)
        const tuples = JSON.parse((await run(value)).canonicalJson)
        expect(tuples[0][9]).toEqual([['ST-AA', 'acceptable', ['CT-000002']], ['ST-DEMO', 'acceptable', ['CT-000001', 'CT-000003']]])
        expect(value).toEqual(snapshot)
    })

    it('excludes refs, row/plan order, filename and authority/actor metadata', async () => {
        const value = fixture([client(), client('C2', 8, { name: 'binh', phone: '0901234568' })]), before = await run(value)
        value.workbook.clients.forEach((entry, index) => {
            const previous = entry.temporaryReference, next = `RENAMED-C-${index}`
            entry.temporaryReference = next; entry.callerContext = { ...entry.callerContext, row: entry.callerContext.row + 40, temporaryReference: next }
            value.clients[index].row += 40; value.clients[index].callerContext = entry.callerContext
            value.workbook.samples.forEach(sample => { if (sample.clientTemporaryReference === previous) sample.clientTemporaryReference = next })
        })
        value.workbook.samples.forEach((sample, index) => {
            const previous = sample.temporaryReference; sample.temporaryReference = `RENAMED-S-${index}`
            value.workbook.assignments.forEach(assignment => { if (assignment.sampleTemporaryReference === previous) assignment.sampleTemporaryReference = sample.temporaryReference })
        })
        value.workbook.clients.reverse(); value.workbook.samples.reverse(); value.workbook.assignments.reverse(); value.clients.reverse()
        Reflect.set(value.workbook, 'filename', 'renamed.xlsx'); Reflect.set(value.workbook, 'actorId', 'another-actor')
        Reflect.set(value.workbook, 'batchId', 'another-batch'); Reflect.set(value.workbook, 'received_at', 'later')
        Reflect.set(value.workbook, 'template', { version: 'future', revision: 'other', generations: [], labels: ['changed'] })
        expect(await run(value)).toEqual(before)
    })

    it('preserves identical sample multiplicity and ignores permutation of indistinguishable nodes', async () => {
        const value = fixture(), before = await run(value)
        value.workbook.samples.push({ ...value.workbook.samples[0], temporaryReference: 'S2' })
        value.workbook.assignments.push({ ...value.workbook.assignments[0], sampleTemporaryReference: 'S2' })
        const doubled = await run(value)
        expect(JSON.parse(doubled.canonicalJson)[0][9]).toHaveLength(2)
        expect(doubled.normalizedPayloadHash).not.toBe(before.normalizedPayloadHash)
        value.workbook.samples.reverse(); value.workbook.assignments.reverse()
        expect(await run(value)).toEqual(doubled)
    })

    it('changes hash when distinct samples or assignments are rebound in the normalized graph', async () => {
        const value = fixture([client(), client('C2', 8, { name: 'binh', phone: '0901234568' })]), before = await run(value)
        value.workbook.samples[0].clientTemporaryReference = 'C2'; value.workbook.samples[1].clientTemporaryReference = 'C1'
        expect((await run(value)).normalizedPayloadHash).not.toBe(before.normalizedPayloadHash)
        value.workbook.samples[0].clientTemporaryReference = 'C1'; value.workbook.samples[1].clientTemporaryReference = 'C2'
        value.workbook.assignments[0].sampleTemporaryReference = 'S2'; value.workbook.assignments[1].sampleTemporaryReference = 'S1'
        expect((await run(value)).normalizedPayloadHash).not.toBe(before.normalizedPayloadHash)
    })

    it.each(['\uD800', '\uDC00', 'x\uD800y'])('rejects unpaired surrogate input %j without a hash', async invalid => {
        await expect(run(fixture([client('C1', 4, { address: invalid })]))).rejects.toThrow('ACCESSION_INTENT_INVALID')
    })

    it.each([
        (value: ReturnType<typeof fixture>) => { value.clients = [] },
        (value: ReturnType<typeof fixture>) => { value.clients.push(value.clients[0]) },
        (value: ReturnType<typeof fixture>) => { value.clients[0].callerContext = { ...value.clients[0].callerContext, temporaryReference: 'OTHER' } },
        (value: ReturnType<typeof fixture>) => { value.clients[0].issues = [{ code: 'CLIENT_DUPLICATE', reasonCode: 'same_uuid', relatedRows: [7] }] },
        (value: ReturnType<typeof fixture>) => { value.clients[0].resolution = { outcome: 'conflict', reasonCode: 'identity_conflict', clientId: null, created: false } },
        (value: ReturnType<typeof fixture>) => { value.clients[0].disposition = 'reuse' },
        (value: ReturnType<typeof fixture>) => { value.workbook.samples[0].clientTemporaryReference = 'MISSING' },
        (value: ReturnType<typeof fixture>) => { value.workbook.samples.push(value.workbook.samples[0]) },
        (value: ReturnType<typeof fixture>) => { value.workbook.assignments[0].sampleTemporaryReference = 'MISSING' },
        (value: ReturnType<typeof fixture>) => { value.workbook.assignments.push(value.workbook.assignments[0]) },
        (value: ReturnType<typeof fixture>) => { value.workbook.assignments = [] },
        (value: ReturnType<typeof fixture>) => { value.workbook.samples = []; value.workbook.assignments = [] },
    ])('fails closed on graph/plan inconsistency %#', async change => {
        const value = fixture(); change(value)
        await expect(run(value)).rejects.toThrow('ACCESSION_INTENT_INVALID')
    })
})

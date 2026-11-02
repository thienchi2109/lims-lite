// @vitest-environment node
import { createHash, createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { catalogFixture, generatedAtFixture, signingFixture, snapshotFixture } from './test-fixtures'

vi.mock('server-only', () => ({}))

// Dynamic import keeps every RED assertion runnable before the module exists.
const binding = () => import('./binding')
async function issued() {
    const api = await binding()
    const snapshot = snapshotFixture()
    const config = signingFixture()
    const metadata = api.createTemplateBinding(snapshot, config, generatedAtFixture)
    return { api, snapshot, config, metadata, catalogs: catalogFixture() }
}

describe('authenticated accession template binding', () => {
    it('signs bounded claims and preserves lossless BIGINT authority', async () => {
        const { api, snapshot, config, metadata, catalogs } = await issued()
        const claims = api.verifyTemplateBinding(metadata, catalogs, config, snapshot)
        expect(claims.revision).toBe('9007199254740993')
        expect(metadata[5][1].length).toBeLessThan(2048)
        const payload = JSON.parse(Buffer.from(metadata[5][1].split('.')[1], 'base64url').toString())
        expect(payload).toEqual(['accession-template-binding', 1, 'lims-bulk-accession', '1', generatedAtFixture, snapshot.revisionNumber, expect.stringMatching(/^[a-f0-9]{64}$/), expect.stringMatching(/^[a-f0-9]{64}$/)])
        const canonical = ['accession-authority', 1, [snapshot.revisionId, snapshot.revisionNumber], snapshot.sampleTypes.map(x => [x.importCode, x.id, x.compatibilityGeneration]), snapshot.assays.map(x => [x.importCode, x.id, x.compatibilityGeneration]), [['LM-000001', 'CT-000001'], ['LM-000002', 'CT-000002']]]
        expect(claims.authorityDigest).toBe(createHash('sha256').update(JSON.stringify(canonical)).digest('hex'))
        expect(claims.catalogDigest).toBe(createHash('sha256').update(JSON.stringify(['accession-catalog', 1, catalogs])).digest('hex'))
    })

    it('verifies independently after module restart with no generated-at TTL', async () => {
        const { snapshot, config, metadata, catalogs } = await issued()
        vi.resetModules()
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2099-01-01T00:00:00.000Z'))
        try { expect((await binding()).verifyTemplateBinding(metadata, catalogs, config, snapshot).revision).toBe(snapshot.revisionNumber) }
        finally { vi.useRealTimers() }
    })

    it('canonicalizes row/property order without normalizing original literal labels', async () => {
        const { api, snapshot, config, metadata, catalogs } = await issued()
        snapshot.sampleTypes.reverse(); snapshot.assays.reverse(); snapshot.pairs.reverse()
        const reordered = catalogs.map(rows => [rows[0], ...rows.slice(1).reverse()])
        const reorderedProperties = Object.fromEntries(Object.entries(snapshot).reverse())
        reorderedProperties.sampleTypes = snapshot.sampleTypes.map(entity => Object.fromEntries(Object.entries(entity).reverse()))
        expect(api.createTemplateBinding(reorderedProperties, config, generatedAtFixture)).toEqual(metadata)
        expect(api.verifyTemplateBinding(metadata, reordered, config, snapshot)).toBeDefined()
    })

    it.each([[0, 1, 1], [1, 1, 1], [1, 1, 2], [0, 1, 0], [2, 1, 1], [1, 0, 2]])('rejects catalog tampering at %i/%i/%i', async (sheet, row, column) => {
        const { api, snapshot, config, metadata, catalogs } = await issued()
        catalogs[sheet][row][column] += 'x'
        expect(() => api.verifyTemplateBinding(metadata, catalogs, config, snapshot)).toThrow()
    })

    it.each([1, 2, 3, 4, 5])('rejects changed signed metadata row %i', async row => {
        const { api, snapshot, config, metadata, catalogs } = await issued()
        metadata[row][1] += 'x'
        expect(() => api.verifyTemplateBinding(metadata, catalogs, config, snapshot)).toThrow()
    })

    it('rejects duplicate, unknown, missing or nonliteral metadata', async () => {
        const { api, snapshot, config, metadata, catalogs } = await issued()
        for (const rows of [metadata.slice(0, -1), [...metadata, metadata[1]], [...metadata, ['extra', 'x']], metadata.map((r, i) => i === 2 ? [r[0], 1] : r)]) {
            expect(() => api.verifyTemplateBinding(rows, catalogs, config, snapshot)).toThrow()
        }
    })

    it.each(['', 'x', 'a.b.c', 'unknown.e30.AA', '__proto__.e30.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'])('rejects malformed/unknown descriptor %j', async token => {
        const { api, snapshot, config, metadata, catalogs } = await issued()
        metadata[5][1] = token
        expect(() => api.verifyTemplateBinding(metadata, catalogs, config, snapshot)).toThrow()
        metadata[5][1] = 'x'.repeat(32768)
        expect(() => api.verifyTemplateBinding(metadata, catalogs, config, snapshot)).toThrow()
    })

    it('rejects MAC tampering, retired key and different secret', async () => {
        const { api, snapshot, config, metadata, catalogs } = await issued()
        expect(() => api.verifyTemplateBinding(metadata, catalogs, { ...config, keys: { replacement: 'b2'.repeat(32) }, activeKeyId: 'replacement' }, snapshot)).toThrow()
        expect(() => api.verifyTemplateBinding(metadata, catalogs, { ...config, keys: { 'synthetic-1': 'b2'.repeat(32) } }, snapshot)).toThrow()
        metadata[5][1] = metadata[5][1].slice(0, -2) + 'AA'
        expect(() => api.verifyTemplateBinding(metadata, catalogs, config, snapshot)).toThrow()
    })

    it('rejects valid-MAC claims with unsupported version or malformed schema', async () => {
        const { api, snapshot, config, metadata, catalogs } = await issued()
        const original = JSON.parse(Buffer.from(metadata[5][1].split('.')[1], 'base64url').toString())
        const unsupported = [...original]; unsupported[3] = '2'
        for (const claims of [unsupported, [...original, 'extra'], ['accession-template-binding', 2], { unsupported: true }]) {
            const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
            const content = `synthetic-1.${payload}`
            metadata[5][1] = `${content}.${createHmac('sha256', Buffer.from(config.keys['synthetic-1'], 'hex')).update(content).digest('base64url')}`
            expect(() => api.verifyTemplateBinding(metadata, catalogs, config, snapshot)).toThrow()
        }
    })

    it('allows independent current label/method rename while rejecting original workbook edits', async () => {
        const { api, snapshot, config, metadata, catalogs } = await issued()
        snapshot.sampleTypes[0].name = 'Tên mới'
        snapshot.assays[0].name = 'Nhãn mới'; snapshot.assays[0].methodName = 'Hiển thị mới'
        expect(api.verifyTemplateBinding(metadata, catalogs, config, snapshot)).toBeDefined()
        catalogs[0][1][1] = 'Tên mới'
        expect(() => api.verifyTemplateBinding(metadata, catalogs, config, snapshot)).toThrow()
    })

    it.each(['revisionNumber', 'revisionId', 'uuid', 'generation', 'code', 'pair'])('rejects current authority %s drift', async kind => {
        const { api, snapshot, config, metadata, catalogs } = await issued()
        if (kind === 'revisionNumber') snapshot.revisionNumber = '9007199254740994'
        if (kind === 'revisionId') snapshot.revisionId = '10000000-0000-4000-8000-000000000002'
        if (kind === 'uuid') { snapshot.sampleTypes[0].id = '20000000-0000-4000-8000-000000000003'; snapshot.pairs[0].sampleTypeId = snapshot.sampleTypes[0].id }
        if (kind === 'generation') snapshot.sampleTypes[0].compatibilityGeneration = '9007199254740994'
        if (kind === 'code') snapshot.sampleTypes[0].importCode = 'LM-000003'
        if (kind === 'pair') snapshot.pairs.forEach((pair, index) => { pair.assayDefinitionId = snapshot.assays[1 - index].id })
        expect(() => api.verifyTemplateBinding(metadata, catalogs, config, snapshot)).toThrow()
    })

    it('keeps the descriptor bounded independently of catalog cardinality and rejects valid eligibility removal', async () => {
        const { api, snapshot, config, metadata, catalogs } = await issued()
        const reduced = { ...snapshot, sampleTypes: snapshot.sampleTypes.slice(0, 1), assays: snapshot.assays.slice(0, 1), pairs: snapshot.pairs.slice(0, 1) }
        expect(api.createTemplateBinding(reduced, config, generatedAtFixture)[5][1].length).toBe(metadata[5][1].length)
        expect(() => api.verifyTemplateBinding(metadata, catalogs, config, reduced)).toThrow('CATALOG_STALE')
    })

    it('fails closed on incomplete/duplicate/orphan authority and invalid config', async () => {
        const { api, snapshot, config } = await issued()
        const variants = [null, { ...snapshot, pairs: [] }, { ...snapshot, revisionNumber: '01' }, { ...snapshot, revisionNumber: 1 }, { ...snapshot, sampleTypes: [...snapshot.sampleTypes, snapshot.sampleTypes[0]] }, { ...snapshot, pairs: [...snapshot.pairs, snapshot.pairs[0]] }, { ...snapshot, pairs: [snapshot.pairs[0]] }, { ...snapshot, revisionNumber: '9223372036854775808' }]
        for (const value of variants) expect(() => api.createTemplateBinding(value, config, generatedAtFixture)).toThrow()
        for (const value of [null, {}, { ...config, activeKeyId: 'missing' }, { ...config, keys: { 'synthetic-1': 'short' } }]) expect(() => api.createTemplateBinding(snapshot, value, generatedAtFixture)).toThrow()
        for (const timestamp of ['2026-02-30T07:00:00.123Z', '2026-11-02T07:00:00Z']) expect(() => api.createTemplateBinding(snapshot, config, timestamp)).toThrow()
    })

    it('rejects malformed decimal claims with bounded safe errors', async () => {
        const api = await binding()
        for (const value of ['invalid-generation', '9'.repeat(20000), '-1', '1e3']) {
            const snapshot = snapshotFixture()
            snapshot.sampleTypes[0].compatibilityGeneration = value
            expect(() => api.createTemplateBinding(snapshot, signingFixture(), generatedAtFixture)).toThrow('ACCESSION_TEMPLATE_CATALOG_UNAVAILABLE')
            snapshot.revisionNumber = value
            expect(() => api.createTemplateBinding(snapshot, signingFixture(), generatedAtFixture)).toThrow('ACCESSION_TEMPLATE_CATALOG_UNAVAILABLE')
        }
    })

    it('reads a minimal validated environment boundary without returning secrets in errors', async () => {
        const api = await binding()
        expect(api.readTemplateSigningConfig({ ACCESSION_TEMPLATE_SIGNING_KEY_ID: 'synthetic-1', ACCESSION_TEMPLATE_SIGNING_KEYS: JSON.stringify(signingFixture().keys) })).toEqual(signingFixture())
        const secret = 'sensitive-invalid-secret'
        expect(() => api.readTemplateSigningConfig({ ACCESSION_TEMPLATE_SIGNING_KEYS: secret })).toThrowError(new Error('ACCESSION_TEMPLATE_CONFIGURATION_UNAVAILABLE'))
    })
})

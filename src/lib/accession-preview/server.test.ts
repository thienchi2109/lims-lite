// @vitest-environment node
// Trust-boundary checks use the real parser/planner and mock only authenticated SQL transports.
import { createHash, createHmac } from 'node:crypto'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { snapshotFixture, signingFixture } from '@/lib/accession-template/test-fixtures'
import { resourceFixture } from '@/lib/accession-workbook/test-fixtures'
import { workbookFixture } from '@/lib/accession-workbook/workbook-fixtures'
import { validateAccessionWorkbook } from '@/lib/accession-workbook/validate'
import * as server from './server'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), admin: vi.fn(), user: vi.fn(), resolve: vi.fn(), rpc: vi.fn(), userRpc: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth-helpers', () => ({ requireRole: mocks.auth, isAuthError: (x: object) => 'error' in x }))
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: mocks.admin, createClient: mocks.user }))
vi.mock('@/lib/client-resolution/server', () => ({ resolveAccessionPreviewClientsV1: mocks.resolve }))
const key = { activeKeyId: 'v1', keys: { v1: 'ab'.repeat(32) } }
const batch = '11111111-1111-4111-8111-111111111111'
const row = { row: 2, input: { name: 'an', dateOfBirth: '2000-01-01', governmentIdentityType: null, governmentIdentityValue: null, gender: null, phone: null, address: null, healthInsuranceNum: null, expiryDate: null }, resolution: { outcome: 'not_found', reasonCode: 'identity_not_found', clientId: null, created: false }, trustedIdentity: null, displayValues: null, issues: [] }
const display = { ...row.input }

describe('accession preview server commitment', () => {
    beforeEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs() })
    afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })
    it('uses exact HMAC domain with batch/row/outcome/UUID, normalized decision fields and display presence', () => {
        const tuple = [batch, 2, 'not_found', null, Object.keys(row.input).sort().map(k => [k, row.input[k as keyof typeof row.input]]), null]
        const expected = createHmac('sha256', Buffer.from(key.keys.v1, 'hex')).update('lims-lite:bulk-accession:client-binding:v1\n' + JSON.stringify(tuple)).digest('hex')
        expect(server.fingerprintClientBinding(batch, row, key)).toEqual({ keyVersion: 'v1', fingerprint: expected })
    })
    it('covers all canonical decision/display fields and rejects incomplete display', () => {
        const matched = { ...row, resolution: { ...row.resolution, outcome: 'matched', reasonCode: 'name_dob_match', clientId: batch }, displayValues: display }
        const first = server.fingerprintClientBinding(batch, matched, key)
        expect(server.fingerprintClientBinding(batch, { ...matched, displayValues: { ...display, phone: '0987654321' } }, key)).not.toEqual(first)
        expect(server.fingerprintClientBinding(batch, { ...matched, input: { ...row.input, address: 'changed' } }, key)).not.toEqual(first)
        expect(() => server.fingerprintClientBinding(batch, { ...matched, displayValues: { name: 'an' } }, key)).toThrow()
    })
    it('fails closed without dedicated active key and measured lease/admission policy', () => {
        expect(() => server.readPreviewConfiguration({})).toThrow('ACCESSION_PREVIEW_CONFIGURATION_UNAVAILABLE')
        expect(() => server.readPreviewConfiguration({ ACCESSION_PREVIEW_BINDING_KEY_ID: 'v2', ACCESSION_PREVIEW_BINDING_KEYS: JSON.stringify(key.keys) })).toThrow('ACCESSION_PREVIEW_CONFIGURATION_UNAVAILABLE')
    })
    it('retains configured old key versions and rejects unmeasured/invalid lease policy', () => {
        configure()
        vi.stubEnv('ACCESSION_PREVIEW_BINDING_KEY_ID','v2')
        vi.stubEnv('ACCESSION_PREVIEW_BINDING_KEYS',JSON.stringify({ ...key.keys,v2:'bc'.repeat(32) }))
        expect(server.readPreviewConfiguration().keys.v1).toBe(key.keys.v1)
        expect(server.readPreviewConfiguration().activeKeyId).toBe('v2')
        for (const policy of [{ leaseMs:60000,heartbeatMs:100 },{ evidenceId:'test',leaseMs:100,heartbeatMs:100,resources:resourceFixture() }]) {
            vi.stubEnv('ACCESSION_PREVIEW_POLICY',JSON.stringify(policy))
            expect(() => server.readPreviewConfiguration()).toThrow('ACCESSION_PREVIEW_CONFIGURATION_UNAVAILABLE')
        }
    })
    it('checks analyst authorization before parsing/configuration or privileged allocation', async () => {
        mocks.auth.mockResolvedValue({ error: 'forbidden' })
        await expect(server.prepareAccessionPreview(new Uint8Array([1]))).rejects.toThrow('ACCESSION_PREVIEW_FORBIDDEN')
        expect(mocks.auth).toHaveBeenCalledWith('analyst')
        expect(mocks.admin).not.toHaveBeenCalled()
    })
    it('full binding set digest preserves graph and multiplicity, excludes ordering', () => {
        const a = ['sample', 2, 3, 'LM-000001'], b = ['assignment', 2, 2, 'CT-000001']
        expect(server.digestBindingSet([a, b])).toEqual(server.digestBindingSet([b, a]))
        expect(server.digestBindingSet([a, b, b])).not.toEqual(server.digestBindingSet([a, b]))
        expect(server.digestBindingSet([a, ['assignment', 2, 4, 'CT-000001']])).not.toEqual(server.digestBindingSet([a, b]))
    })

    function configure(heartbeatMs = 10000) {
        vi.stubEnv('ACCESSION_PREVIEW_BINDING_KEY_ID', key.activeKeyId)
        vi.stubEnv('ACCESSION_PREVIEW_BINDING_KEYS', JSON.stringify(key.keys))
        vi.stubEnv('ACCESSION_PREVIEW_POLICY', JSON.stringify({ evidenceId: 'synthetic-test-only', leaseMs: 60000, heartbeatMs, resources: resourceFixture() }))
        vi.stubEnv('ACCESSION_TEMPLATE_SIGNING_KEY_ID', signingFixture().activeKeyId)
        vi.stubEnv('ACCESSION_TEMPLATE_SIGNING_KEYS', JSON.stringify(signingFixture().keys))
        mocks.auth.mockResolvedValue({ id: batch, role: 'analyst' })
        mocks.admin.mockReturnValue({ rpc: mocks.rpc }); mocks.user.mockResolvedValue({ rpc: mocks.userRpc })
        mocks.userRpc.mockResolvedValue({ data: snapshotFixture(), error: null })
        mocks.resolve.mockResolvedValue({ data: [{ ...row, input: { ...row.input, name: 'khách thử', dateOfBirth: '2000-02-29',
            governmentIdentityType: 'cmnd', governmentIdentityValue: '001234567', healthInsuranceNum: '000123' },
            resolution: { outcome: 'matched', reasonCode: 'trusted_identity_match', clientId: batch, created: false }, displayValues: { ...display, name: 'Khách thử' } }] })
        mocks.rpc.mockImplementation(async (name: string) => name === 'start_accession_preview'
            ? { data: { id: batch, lease_token: batch, lease_generation: 1, preview_created_at: null, expires_at: null }, error: null }
            : name === 'seal_accession_preview'
                ? { data: { id: batch, preview_created_at: '2026-11-04T01:00:00Z', expires_at: '2026-11-04T01:30:00Z' }, error: null }
                : { data: null, error: null })
    }

    it('seals a real workbook with source digest, graph/counts, auth actor and database deadline', async () => {
        configure()
        const bytes = workbookFixture(), result = await server.prepareAccessionPreview(bytes)
        expect(result).toMatchObject({ ok: true, batchId: batch, expiresAt: '2026-11-04T01:30:00Z', counts: { clients: 1, samples: 1, assignments: 1 } })
        const [name, args] = mocks.rpc.mock.calls.find(([name]) => name === 'seal_accession_preview')!
        expect(name).toBe('seal_accession_preview')
        expect(args).toMatchObject({ p_actor: batch, p_token: batch, p_generation: 1,
            p_metadata: { source_sha256: createHash('sha256').update(bytes).digest('hex'), source_size: bytes.length, create_count: 0, reuse_count: 1 } })
        const bindings = JSON.parse(args.p_bindings_text)
        expect(bindings).toHaveLength(3)
        expect(args.p_metadata.binding_set_digest).toBe(server.digestBindingSet(bindings).digest)
        const parsed = await validateAccessionWorkbook(bytes, { snapshot: snapshotFixture(), signingConfig: signingFixture(), resources: resourceFixture() })
        expect(parsed.ok).toBe(true)
        if (!parsed.ok) throw new Error('synthetic workbook must validate')
        expect(args.p_metadata.template_claims_digest).toBe(createHash('sha256').update(JSON.stringify(parsed.value.template)).digest('hex'))
        expect(args.p_metadata).not.toHaveProperty('descriptor_digest')
        expect(args.p_metadata).not.toHaveProperty('expires_at')
        for (const forbidden of ['KH-01','M-01','001234567','Khách thử']) expect(JSON.stringify([args.p_metadata, bindings])).not.toContain(forbidden)
        expect(args.p_expected_clients[0].displayValues).toEqual({ ...display, name: 'Khách thử' }) // transient atomic authority recheck only
        expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(['start_accession_preview', 'heartbeat_accession_preview', 'seal_accession_preview'])
    })

    it.each(['snapshot', 'client', 'seal'])('rejects stale %s authority and fences safe failure without business RPCs', async boundary => {
        configure()
        if (boundary === 'snapshot') mocks.userRpc.mockResolvedValue({ error: { message: 'sensitive raw DB error' } })
        if (boundary === 'client') mocks.resolve.mockResolvedValue({ error: 'sensitive client error' })
        if (boundary === 'seal') mocks.rpc.mockImplementation(async (name: string) => name === 'start_accession_preview'
            ? { data: { id: batch, lease_token: batch, lease_generation: 1, preview_created_at: null, expires_at: null } }
            : name === 'seal_accession_preview' ? { error: { message: 'sensitive client drift' } } : { error: null })
        if (boundary === 'client') expect(await server.prepareAccessionPreview(workbookFixture())).toMatchObject({ ok: false, batchId: batch })
        else await expect(server.prepareAccessionPreview(workbookFixture())).rejects.toThrow('ACCESSION_PREVIEW_UNAVAILABLE')
        const cleanup = mocks.rpc.mock.calls.find(([name]) => name === 'finish_accession_preview')!
        expect(cleanup[1]).toMatchObject({ p_actor: batch, p_batch: batch, p_token: batch, p_generation: 1,
            p_state: boundary === 'client' ? 'rejected' : 'failed', p_reason: boundary === 'client' ? 'CLIENT_INVALID' : 'PREPARATION_FAILED' })
        expect(JSON.stringify(cleanup)).not.toContain('sensitive')
        expect(mocks.rpc.mock.calls.every(([name]) => /^(start|seal|finish|heartbeat)_accession_preview$/.test(name))).toBe(true)
    })

    it('rejects manager and a deactivated DB analyst before workbook parsing', async () => {
        configure()
        mocks.auth.mockResolvedValue({ id: batch, role: 'manager' })
        await expect(server.prepareAccessionPreview(workbookFixture())).rejects.toThrow('ACCESSION_PREVIEW_FORBIDDEN')
        expect(mocks.admin).not.toHaveBeenCalled()
        mocks.auth.mockResolvedValue({ id: batch, role: 'analyst' })
        mocks.rpc.mockResolvedValue({ error: { code: '42501' } }) // DB current nondeleted analyst gate
        await expect(server.prepareAccessionPreview(workbookFixture())).rejects.toThrow('ACCESSION_PREVIEW_UNAVAILABLE')
        expect(mocks.userRpc).not.toHaveBeenCalled()
        expect(mocks.resolve).not.toHaveBeenCalled()
    })

    it('sends heartbeat exact token/generation and stops before a seal', async () => {
        configure(100)
        const bytes = workbookFixture()
        vi.useFakeTimers()
        let resolveSnapshot!: (value: object) => void
        mocks.userRpc.mockImplementation(() => new Promise(resolve => { resolveSnapshot = resolve }))
        const preparing = server.prepareAccessionPreview(bytes)
        await vi.advanceTimersByTimeAsync(100)
        expect(mocks.rpc).toHaveBeenCalledWith('heartbeat_accession_preview', { p_actor: batch, p_batch: batch, p_token: batch, p_generation: 1 })
        resolveSnapshot({ data: snapshotFixture(), error: null })
        await preparing
        const heartbeats = mocks.rpc.mock.calls.filter(([name]) => name === 'heartbeat_accession_preview').length
        await vi.advanceTimersByTimeAsync(1000)
        expect(mocks.rpc.mock.calls.filter(([name]) => name === 'heartbeat_accession_preview')).toHaveLength(heartbeats)
    })
})

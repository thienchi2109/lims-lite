// @vitest-environment node
// SOURCE ONLY: real parser/planner, mocked transport. SQL locks/RLS remain a runtime gate.
import { createHash } from 'node:crypto'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { snapshotFixture, signingFixture } from '@/lib/accession-template/test-fixtures'
import { resourceFixture } from '@/lib/accession-workbook/test-fixtures'
import { workbookFixture } from '@/lib/accession-workbook/workbook-fixtures'
import { validateAccessionWorkbook } from '@/lib/accession-workbook/validate'
import { resolveAccessionPreviewClients } from './clients'
import { canonicalizeAccessionIntent } from './intent'
import * as preview from './server'
import { authorityDigest, catalogDigest, snapshotCatalogs } from '@/lib/accession-template/contract'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), admin: vi.fn(), user: vi.fn(), rpc: vi.fn(), userRpc: vi.fn(), resolve: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth-helpers', () => ({ requireRole: mocks.auth, isAuthError: (x: object) => 'error' in x }))
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: mocks.admin, createClient: mocks.user }))
vi.mock('@/lib/client-resolution/server', () => ({ resolveAccessionPreviewClientsV1: mocks.resolve }))
const id = '11111111-1111-4111-8111-111111111111'
const keys = { activeKeyId: 'v1', keys: { v1: 'ab'.repeat(32), v2: 'bc'.repeat(32) } }
const sha = (input: string | Uint8Array) => createHash('sha256').update(input).digest('hex')
const prepare = async (...args: unknown[]) => {
    const confirmation = await import('./confirmation')
    return confirmation.prepareAccessionConfirmation(...args as Parameters<typeof confirmation.prepareAccessionConfirmation>)
}
let bytes: Uint8Array, loaded: { batch: Record<string, unknown>; bindings: unknown[][] }

beforeEach(async () => {
    vi.resetAllMocks(); vi.unstubAllEnvs()
    vi.stubEnv('ACCESSION_PREVIEW_BINDING_KEY_ID', 'v2')
    vi.stubEnv('ACCESSION_PREVIEW_BINDING_KEYS', JSON.stringify(keys.keys))
    vi.stubEnv('ACCESSION_PREVIEW_POLICY', JSON.stringify({ evidenceId: 'synthetic-test-only', leaseMs: 60000,
        heartbeatMs: 10000, resources: resourceFixture(), request: { maxBytes: 10002000, maxResponseBytes: 100000, timeoutMs: 10000 } }))
    vi.stubEnv('ACCESSION_TEMPLATE_SIGNING_KEY_ID', signingFixture().activeKeyId)
    vi.stubEnv('ACCESSION_TEMPLATE_SIGNING_KEYS', JSON.stringify(signingFixture().keys))
    mocks.auth.mockResolvedValue({ id, role: 'analyst' })
    mocks.admin.mockReturnValue({ rpc: mocks.rpc }); mocks.user.mockResolvedValue({ rpc: mocks.userRpc })
    mocks.userRpc.mockResolvedValue({ data: snapshotFixture() })
    mocks.resolve.mockResolvedValue({ data: [{ row: 2,
        input: { name: 'khách thử', dateOfBirth: '2000-02-29', governmentIdentityType: 'cmnd', governmentIdentityValue: '001234567',
            gender: 'Nam', phone: '0987654321', address: null, healthInsuranceNum: '000123', expiryDate: null },
        resolution: { outcome: 'not_found', reasonCode: 'identity_not_found', clientId: null, created: false },
        trustedIdentity: null, displayValues: null, issues: [] }] })
    bytes = workbookFixture()
    const parsed = await validateAccessionWorkbook(bytes, { snapshot: snapshotFixture(), signingConfig: signingFixture(), resources: resourceFixture() })
    if (!parsed.ok) throw new Error('fixture invalid')
    const plan = await resolveAccessionPreviewClients(parsed.value)
    if (!plan.ok) throw new Error('fixture plan invalid')
    const { row, input, resolution, trustedIdentity, displayValues, issues } = plan.clients[0]
    const fp = preview.fingerprintClientBinding(id, { row, input, resolution, trustedIdentity, displayValues, issues }, keys)
    const snapshot = snapshotFixture(), sample = snapshot.sampleTypes[0], assay = snapshot.assays[0]
    const bindings = preview.digestBindingSet([
        ['client', 2, null, null, null, null, null, 'not_found', null, fp.keyVersion, fp.fingerprint],
        ['sample', 2, 2, sample.importCode, sample.id, sample.compatibilityGeneration, null, null, null, null, null],
        ['assignment', 2, 2, assay.importCode, assay.id, assay.compatibilityGeneration, assay.methodName, null, null, null, null],
    ])
    loaded = { batch: { id, owner_id: id, state: 'preview_ready', expires_at: '2099-01-01T00:00:00Z',
        source_sha256: sha(bytes), source_size: bytes.length, normalized_payload_hash: canonicalizeAccessionIntent(parsed.value, plan.clients).normalizedPayloadHash,
        canonicalization_version: 'accession-intent-v1', template_version: '1', template_digest: authorityDigest(snapshot),
        template_claims_digest: sha(JSON.stringify(parsed.value.template)), catalog_digest: catalogDigest(snapshotCatalogs(snapshot)),
        revision: snapshot.revisionNumber, validation_version: 'accession-workbook-v1', resolver_version: 'accession-preview-clients-v1',
        binding_set_digest: bindings.digest, client_count: 1, sample_count: 1, assignment_count: 1, create_count: 1, reuse_count: 0 },
    bindings: JSON.parse(bindings.canonical) }
    mocks.rpc.mockResolvedValue({ data: loaded })
    mocks.resolve.mockClear()
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('trusted confirmation preparation', () => {
    it('requires analyst and UUID before privileged reads', async () => {
        mocks.auth.mockResolvedValue({ error: 'forbidden' })
        await expect(prepare(id, bytes, true)).rejects.toThrow('ACCESSION_CONFIRMATION_FORBIDDEN')
        expect(mocks.admin).not.toHaveBeenCalled()
        mocks.auth.mockResolvedValue({ id, role: 'analyst' })
        await expect(prepare('bad', bytes, true)).rejects.toThrow()
        expect(mocks.admin).not.toHaveBeenCalled()
    })
    it('returns authorized succeeded receipt before source, attestation, config, keys or expiry', async () => {
        vi.unstubAllEnvs()
        const receipt = { batch_id: id, owner_id: id, confirmation_received_at: '2026-11-05T00:00:00Z',
            client_count: 1, sample_count: 1, assignment_count: 1, create_count: 1, reuse_count: 0 }
        mocks.rpc.mockResolvedValue({ data: { receipt } })
        expect(await prepare(id)).toEqual({ kind: 'receipt', receipt })
        expect(mocks.user).not.toHaveBeenCalled(); expect(mocks.resolve).not.toHaveBeenCalled()
        expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('get_accession_confirmation_preparation', { p_actor: id, p_batch: id })
    })
    it.each(['wrong owner', 'withdrawn role', 'terminal'])('fails closed on %s', async state => {
        if (state === 'wrong owner') loaded.batch.owner_id = '22222222-2222-4222-8222-222222222222'
        if (state === 'withdrawn role') mocks.rpc.mockResolvedValue({ error: { message: 'sensitive' } })
        if (state === 'terminal') loaded.batch.state = 'failed'
        await expect(prepare(id, bytes, true)).rejects.toThrow('ACCESSION_CONFIRMATION_UNAVAILABLE')
        expect(mocks.resolve).not.toHaveBeenCalled()
    })
    it.each([undefined, false, 'true', {}])('requires explicit acceptable-quality attestation %j', async attestation => {
        await expect(prepare(id, bytes, attestation)).rejects.toThrow('ACCESSION_CONFIRMATION_ATTESTATION_REQUIRED')
    })
    it.each([undefined, new Uint8Array(), new Uint8Array(10000000)])('rejects invalid original source', async source => {
        await expect(prepare(id, source, true)).rejects.toThrow('ACCESSION_CONFIRMATION_SOURCE_INVALID')
    })
    it('tags only owner-verified controlled rejection for safe atomic terminal handling', async () => {
        const { ConfirmationPreparationFailure } = await import('./confirmation')
        const failure = await prepare(id, undefined, true).catch(error => error)
        expect(failure).toBeInstanceOf(ConfirmationPreparationFailure)
        expect(failure).toMatchObject({ actorId: id, batchId: id, reasonCode: 'PREVIEW_CONTENT_CHANGED' })
        expect(Object.keys(failure).sort()).toEqual(['actorId','batchId','reasonCode'])
        loaded.batch.owner_id = '22222222-2222-4222-8222-222222222222'
        expect(await prepare(id, undefined, true).catch(error => error)).not.toBeInstanceOf(ConfirmationPreparationFailure)
    })
    it('reuses retained key v1 after rotation and yields only transient handoff', async () => {
        const result = await prepare(id, bytes, true)
        expect(result).toMatchObject({ kind: 'prepared', actorId: id, batchId: id, attested: true,
            metadata: { binding_set_digest: loaded.batch.binding_set_digest }, workbook: { clients: [{ temporaryReference: 'KH-01' }] } })
        expect(result).not.toHaveProperty('confirmationReceivedAt')
        expect(result).not.toHaveProperty('sampleId')
        expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(['get_accession_confirmation_preparation'])
    })
    it.each(['source_sha256', 'source_size', 'normalized_payload_hash', 'template_digest', 'template_claims_digest',
        'catalog_digest', 'revision', 'validation_version', 'resolver_version', 'client_count', 'sample_count', 'assignment_count', 'create_count', 'reuse_count',
        'binding_set_digest'])('rejects sealed %s drift', async field => {
        loaded.batch[field] = typeof loaded.batch[field] === 'number' ? 999 : 'changed'
        await expect(prepare(id, bytes, true)).rejects.toThrow('ACCESSION_CONFIRMATION_UNAVAILABLE')
    })
    it.each(['key', 'hmac', 'parent', 'duplicate'])('rejects typed binding %s drift', async drift => {
        const client = loaded.bindings.find(row => row[0] === 'client')!
        if (drift === 'key') client[9] = 'unknown'
        if (drift === 'hmac') client[10] = '00'.repeat(32)
        if (drift === 'parent') loaded.bindings.find(row => row[0] === 'sample')![2] = 99
        if (drift === 'duplicate') loaded.bindings.push(client)
        await expect(prepare(id, bytes, true)).rejects.toThrow('ACCESSION_CONFIRMATION_UNAVAILABLE')
    })
    it.each(['configuration', 'workbook', 'snapshot', 'resolver', 'rows'])('rejects invalid %s authority', async drift => {
        if (drift === 'configuration') vi.stubEnv('ACCESSION_PREVIEW_BINDING_KEYS', '{}')
        if (drift === 'workbook') { bytes = new Uint8Array([1, 2]); loaded.batch.source_sha256 = sha(bytes); loaded.batch.source_size = bytes.length }
        if (drift === 'snapshot') mocks.userRpc.mockResolvedValue({ error: { message: 'private' } })
        if (drift === 'resolver') mocks.resolve.mockResolvedValue({ data: [] })
        if (drift === 'rows') mocks.resolve.mockResolvedValue({ data: [{ row: 99 }] })
        await expect(prepare(id, bytes, true)).rejects.toThrow('ACCESSION_CONFIRMATION_UNAVAILABLE')
    })
})

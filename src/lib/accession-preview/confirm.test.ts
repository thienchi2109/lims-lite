// @vitest-environment node
// Atomic adapter trust-boundary checks; PostgreSQL behavior is retained separately, NOT RUN.
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ prepare: vi.fn(), rpc: vi.fn(), admin: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: mocks.admin }))
vi.mock('./confirmation', async importOriginal => ({ ...await importOriginal<typeof import('./confirmation')>(), prepareAccessionConfirmation: mocks.prepare }))
const id = '11111111-1111-4111-8111-111111111111'
const receipt = { batch_id: id, owner_id: id, confirmation_received_at: '2026-11-05T00:00:00Z',
    client_count: 1, sample_count: 1, assignment_count: 1, create_count: 1, reuse_count: 0 }
const handoff = { kind: 'prepared', actorId: id, batchId: id, attested: true, workbook: { ephemeral: 'source' },
    snapshot: {}, clients: [], expectedClients: [], canonicalIntent: '[]', bindingsText: '[]', metadata: {} }
const confirm = async (...args: unknown[]) => {
    const entry = await import('./confirm')
    return entry.confirmAccession(...args as Parameters<typeof entry.confirmAccession>)
}
beforeEach(() => { vi.resetAllMocks(); mocks.admin.mockReturnValue({ rpc: mocks.rpc }); mocks.prepare.mockResolvedValue(handoff)
    mocks.rpc.mockResolvedValue({ data: { state: 'succeeded', receipt } }) })
describe('one atomic confirmation handoff', () => {
    it('returns the authorized same receipt without any atomic write call', async () => {
        mocks.prepare.mockResolvedValue({ kind: 'receipt', receipt })
        expect(await confirm(id)).toEqual({ state: 'succeeded', receipt })
        expect(mocks.admin).not.toHaveBeenCalled()
    })
    it('sends exactly one prepared service RPC and trusts database received time', async () => {
        expect(await confirm(id, new Uint8Array([1]), true)).toEqual({ state: 'succeeded', receipt })
        expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('confirm_accession_import', {
            p_actor: id, p_batch: id, p_attested: true, p_workbook: handoff.workbook, p_snapshot: {},
            p_clients: [], p_expected_clients: [], p_canonical_intent: '[]', p_bindings_text: '[]', p_metadata: {}, p_preparation_failure: null })
    })
    it('persists only a safe controlled preparation failure after the verified owner gate', async () => {
        const { ConfirmationPreparationFailure } = await import('./confirmation')
        mocks.prepare.mockRejectedValue(new ConfirmationPreparationFailure(id,id,'PREVIEW_CONTENT_CHANGED','ACCESSION_CONFIRMATION_UNAVAILABLE'))
        mocks.rpc.mockResolvedValue({ data: { state: 'failed', batchId: id, reasonCode: 'PREVIEW_CONTENT_CHANGED' } })
        expect(await confirm(id)).toEqual({ state: 'failed', batchId: id, reasonCode: 'PREVIEW_CONTENT_CHANGED' })
        expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('confirm_accession_import', {
            p_actor:id,p_batch:id,p_attested:false,p_workbook:null,p_snapshot:null,p_clients:null,p_expected_clients:null,
            p_canonical_intent:null,p_bindings_text:null,p_metadata:null,p_preparation_failure:'PREVIEW_CONTENT_CHANGED' })
    })
    it('does not terminalize unverified owner/caller/terminal preparation rejection', async () => {
        mocks.prepare.mockRejectedValue(new Error('ACCESSION_CONFIRMATION_UNAVAILABLE'))
        await expect(confirm(id)).rejects.toThrow('ACCESSION_CONFIRMATION_UNAVAILABLE')
        expect(mocks.rpc).not.toHaveBeenCalled()
    })
    it.each(['ALREADY_IMPORTED','AUTHORITY_CHANGED','CONFIRMATION_FAILED','PREVIEW_CONTENT_CHANGED','ATTESTATION_REQUIRED','CONFIGURATION_UNAVAILABLE'])('returns safe failure %s without winner details', async reasonCode => {
        mocks.rpc.mockResolvedValue({ data: { state:'failed',batchId:id,reasonCode } })
        expect(await confirm(id)).toEqual({ state:'failed',batchId:id,reasonCode })
    })
    it('accepts only the fixed expired outcome', async () => {
        mocks.rpc.mockResolvedValue({ data: { state:'expired',batchId:id,reasonCode:'EXPIRED' } })
        expect(await confirm(id)).toEqual({ state:'expired',batchId:id,reasonCode:'EXPIRED' })
    })
    it.each(['error','reject','invalid','foreign','counts','winner'])('keeps %s atomic outcome unknown with no retry or fabricated failure', async state => {
        if (state==='error') mocks.rpc.mockResolvedValue({ error:{message:'private SQL detail'} })
        if (state==='reject') mocks.rpc.mockRejectedValue(new Error('private transport'))
        if (state==='invalid') mocks.rpc.mockResolvedValue({ data:{state:'succeeded'} })
        if (state==='foreign') mocks.rpc.mockResolvedValue({ data:{state:'succeeded',receipt:{...receipt,owner_id:'22222222-2222-4222-8222-222222222222'}} })
        if (state==='counts') mocks.rpc.mockResolvedValue({ data:{state:'succeeded',receipt:{...receipt,create_count:0}} })
        if (state==='winner') mocks.rpc.mockResolvedValue({ data:{state:'failed',batchId:id,reasonCode:'ALREADY_IMPORTED',receipt} })
        await expect(confirm(id)).rejects.toThrow('ACCESSION_CONFIRMATION_OUTCOME_UNKNOWN')
        expect(mocks.rpc).toHaveBeenCalledTimes(1)
    })
})

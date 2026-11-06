// @vitest-environment node
// Source-only transport checks; lock/role/confidentiality behavior is retained in SQL fixtures.
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth-helpers', () => ({ requireRole: mocks.auth, isAuthError: (x: object) => 'error' in x }))
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))
const batchId = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222'
const receipt = { batch_id: batchId, owner_id: batchId, confirmation_received_at: '2026-11-06T01:00:00Z', client_count: 1,
    sample_count: 2, assignment_count: 2, create_count: 0, reuse_count: 1 }
const lookup = async (id = batchId) => (await import('./status')).getAccessionConfirmationStatus(id)
describe('protected accession status adapter', () => {
    beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: batchId, role: 'analyst' }); mocks.rpc.mockResolvedValue({ data: { state: 'preview_ready', batchId } }) })
    it('derives actor from analyst session, validates ID and calls only status RPC', async () => {
        expect(await lookup()).toEqual({ state: 'preview_ready', batchId })
        expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('get_accession_import_status', { p_actor: batchId, p_batch: batchId })
        await expect(lookup('invalid')).rejects.toThrow(); expect(mocks.rpc).toHaveBeenCalledOnce()
    })
    it.each([{ error: 'unauthenticated' }, { id: batchId, role: 'manager' }])('denies invalid actor before RPC', async actor => {
        mocks.auth.mockResolvedValue(actor); await expect(lookup()).rejects.toThrow('ACCESSION_CONFIRMATION_FORBIDDEN'); expect(mocks.rpc).not.toHaveBeenCalled()
    })
    it('conceals missing/nonowner/withdrawn actor SQL denial', async () => {
        mocks.rpc.mockResolvedValue({ error: { code: '42501', message: 'RAW_DENIAL' } })
        await expect(lookup()).rejects.toThrow('ACCESSION_CONFIRMATION_FORBIDDEN')
    })
    it.each(['preparing', 'preview_ready', 'processing', 'rejected', 'failed', 'expired'])('allows strict %s state only', async state => {
        mocks.rpc.mockResolvedValue({ data: { state, batchId } }); expect(await lookup()).toEqual({ state, batchId })
    })
    it('returns validated receipt without source or confirmation configuration', async () => {
        mocks.rpc.mockResolvedValue({ data: { state: 'succeeded', receipt } }); expect(await lookup()).toEqual({ state: 'succeeded', receipt })
    })
    it.each([{ ...receipt, owner_id: other }, { ...receipt, batch_id: other }, { ...receipt, create_count: 1 }, { ...receipt, extra: 'RAW_CELL' }])('fails closed for forged receipt %j', async bad => {
        mocks.rpc.mockResolvedValue({ data: { state: 'succeeded', receipt: bad } }); expect(await lookup()).toEqual({ state: 'unknown', batchId })
    })
    it.each([{ state: 'processing', batchId, receipt }, { state: 'expired', batchId: other }, { state: 'failed', batchId, reasonCode: 'RAW_CELL' }, null])('fails closed for unsafe response %j', async data => {
        mocks.rpc.mockResolvedValue({ data }); expect(await lookup()).toEqual({ state: 'unknown', batchId })
    })
    it('preserves uncertainty on RPC error or thrown transport failure', async () => {
        mocks.rpc.mockResolvedValue({ error: { code: '08006', message: 'RAW_DB' } }); expect(await lookup()).toEqual({ state: 'unknown', batchId })
        mocks.rpc.mockRejectedValue(new Error('RAW_TRANSPORT')); expect(await lookup()).toEqual({ state: 'unknown', batchId })
    })
})

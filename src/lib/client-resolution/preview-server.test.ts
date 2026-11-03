// Typed read-only SQL bridge trust boundary; existing v2 behavior stays covered separately.
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), requireRole: vi.fn(), createClient: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/auth-helpers', () => ({ requireRole: mocks.requireRole, isAuthError: (value: object) => 'error' in value }))
import { resolveAccessionPreviewClientsV1 } from './server'
import type { ValidatedClient } from '@/lib/accession-workbook/clients'

const fields = { name: 'Nguyễn An', dateOfBirth: '2000-01-01', governmentIdentityType: null, governmentIdentityValue: null, gender: null, phone: null, address: null, healthInsuranceNum: null, expiryDate: null }
const input = { ...fields, temporaryReference: 'KH-A', callerContext: { sheet: 'Khách hàng', row: 4, temporaryReference: 'KH-A' } }
const row = { row: 4, input: { ...fields, name: 'nguyễn an' }, resolution: { outcome: 'matched', reasonCode: 'name_dob_match', clientId: '11111111-1111-4111-8111-111111111111', created: false }, trustedIdentity: { type: 'cccd', value: '012345678901', trusted: true }, displayValues: { ...fields, name: 'nguyễn an' }, issues: [] }
async function run(values: unknown[] = [input]) {
    return resolveAccessionPreviewClientsV1(values as ValidatedClient[])
}

describe('preview resolver server boundary', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.requireRole.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', role: 'analyst' })
        mocks.createClient.mockResolvedValue({ rpc: mocks.rpc })
        mocks.rpc.mockResolvedValue({ data: [row], error: null })
    })

    it('calls only the analyst-only read bridge with explicit input fields and row locator', async () => {
        expect(await run()).toEqual({ data: [row] })
        expect(mocks.requireRole).toHaveBeenCalledWith('analyst')
        expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('resolve_accession_preview_clients_v1', { p_clients: [{ ...fields, row: 4 }] })
        expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain('KH-A')
    })

    it('rejects manager/unauthenticated callers before opening a database connection', async () => {
        mocks.requireRole.mockResolvedValue({ error: 'Forbidden' })
        expect(await run()).toHaveProperty('error')
        expect(mocks.createClient).not.toHaveBeenCalled()
    })

    it.each([
        { gender: 'khác' }, { phone: '123' }, { address: 'x'.repeat(501) },
        { expiryDate: '2000-02-30' }, { governmentIdentityType: 'cccd' },
        { name: '\uD800' }, { healthInsuranceNum: '\u0000' },
    ])('validates supplied optional fields even on reuse %#', async patch => {
        expect(await run([{ ...input, ...patch }])).toHaveProperty('error')
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it.each([
        [], [row, row], [{ ...row, row: 8 }], [{ ...row, unexpected: true }],
        [{ ...row, resolution: { ...row.resolution, created: true } }],
        [{ ...row, resolution: { outcome: 'not_found', reasonCode: 'identity_not_found', clientId: null, created: false } }],
        [{ ...row, issues: [{ code: 'CLIENT_DUPLICATE', reasonCode: 'same_uuid', relatedRows: [99] }] }],
    ])('rejects malformed/incomplete/out-of-scope RPC output %#', async data => {
        mocks.rpc.mockResolvedValue({ data, error: null })
        expect(await run()).toHaveProperty('error')
    })

    it('sanitizes RPC rejection and PostgreSQL details', async () => {
        mocks.rpc.mockRejectedValue(new Error('012345678901 private SQL details'))
        const result = await run()
        expect(result).toHaveProperty('error')
        expect(JSON.stringify(result)).not.toMatch(/012345678901|private SQL/)
    })
})

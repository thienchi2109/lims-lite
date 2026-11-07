// @vitest-environment node
// SOURCE ONLY: guard delegation/session query behavior, not execution of deployed RLS.
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), status: vi.fn(), session: vi.fn(), admin: vi.fn(),
    from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(), page: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/accession-preview/http', () => ({
    AdmissionError: class extends Error { constructor(readonly status: number, message: string) { super(message) } },
    authorizeAccessionRequest: mocks.authorize,
}))
vi.mock('@/lib/accession-preview/status', () => ({ getAccessionConfirmationStatus: mocks.status }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.session, createAdminClient: mocks.admin }))
import { AdmissionError } from '@/lib/accession-preview/http'

const batchId = '11111111-1111-4111-8111-111111111111'
const receipt = { batch_id: batchId, owner_id: batchId, confirmation_received_at: '2026-11-07T00:00:00Z',
    client_count: 1, sample_count: 1, assignment_count: 1, create_count: 1, reuse_count: 0 }
function row(index = 0) { return { row_number: index + 2, sample_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    official_sample_identifier: `CDC-2026-${String(index + 1).padStart(6, '0')}` } }
const context = { params: Promise.resolve({ batchId }) }
async function invoke(id = batchId) {
    return (await import('./route')).GET(new Request(`http://localhost/api/accession-confirmation/${id}/samples`),
        id === batchId ? context : { params: Promise.resolve({ batchId: id }) })
}
async function response(expected: number, id = batchId) {
    const result = await invoke(id)
    expect(result.status).toBe(expected)
    expect(result.headers.get('Cache-Control')).toBe('private, no-store')
    const body = await result.json()
    expect(JSON.stringify(body)).not.toMatch(/RAW_|private-name|client_id|owner_id|temporary/)
    return body
}

describe('owner-authorized committed sample ID GET', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        const query = { select: mocks.select, eq: mocks.eq, order: mocks.order, range: mocks.range, abortSignal: mocks.page }
        for (const method of [mocks.select, mocks.eq, mocks.order, mocks.range]) method.mockReturnValue(query)
        mocks.from.mockReturnValue(query)
        mocks.session.mockResolvedValue({ from: mocks.from })
        mocks.authorize.mockResolvedValue(undefined)
        mocks.status.mockResolvedValue({ state: 'succeeded', receipt })
        mocks.page.mockResolvedValue({ data: [row()], error: null })
    })

    it('reads only committed sample IDs through session RLS after existing guards, without a source file', async () => {
        expect(await response(200)).toEqual({ batchId, samples: [{ row: 2, sampleId: row().sample_id,
            officialSampleIdentifier: row().official_sample_identifier }] })
        expect(mocks.authorize).toHaveBeenCalledOnce()
        expect(mocks.status).toHaveBeenCalledExactlyOnceWith(batchId)
        expect(mocks.from).toHaveBeenCalledExactlyOnceWith('accession_import_mappings')
        expect(mocks.select).toHaveBeenCalledExactlyOnceWith('row_number,sample_id,official_sample_identifier')
        expect(mocks.eq.mock.calls).toEqual([['batch_id', batchId], ['kind', 'sample']])
        expect(mocks.order).toHaveBeenCalledWith('row_number', { ascending: true })
        expect(mocks.range).toHaveBeenCalledWith(0, 0)
        expect(mocks.admin).not.toHaveBeenCalled()
        expect(mocks.authorize.mock.invocationCallOrder[0]).toBeLessThan(mocks.status.mock.invocationCallOrder[0])
        expect(mocks.status.mock.invocationCallOrder[0]).toBeLessThan(mocks.from.mock.invocationCallOrder[0])
    })

    it('rejects malformed UUID before guards or table reads', async () => {
        await response(400, 'invalid')
        expect(mocks.authorize).not.toHaveBeenCalled()
        expect(mocks.status).not.toHaveBeenCalled()
        expect(mocks.from).not.toHaveBeenCalled()
    })

    it.each([['anonymous', 401], ['inactive analyst', 403], ['withdrawn role', 403], ['step-up required', 403]] as const)(
        'retains existing admission denial for %s before status/mappings', async (_, status) => {
            mocks.authorize.mockRejectedValue(new AdmissionError(status, 'RAW_GUARD'))
            await response(status)
            expect(mocks.status).not.toHaveBeenCalled()
            expect(mocks.from).not.toHaveBeenCalled()
        })

    it.each(['missing', 'nonowner', 'confidential denial'])('conceals existing protected-status %s', async () => {
        mocks.status.mockRejectedValue(new Error('ACCESSION_CONFIRMATION_FORBIDDEN'))
        await response(403)
        expect(mocks.from).not.toHaveBeenCalled()
    })

    it.each(['preparing', 'preview_ready', 'processing', 'unknown', 'failed', 'rejected', 'expired'])(
        'does not read mappings for %s', async state => {
            mocks.status.mockResolvedValue({ state, batchId })
            await response(state === 'unknown' ? 503 : 409)
            expect(mocks.from).not.toHaveBeenCalled()
        })

    it('reads all 1,201 samples across native page limits without imposing a sample cap', async () => {
        const rows = Array.from({ length: 1201 }, (_, index) => row(index))
        mocks.status.mockResolvedValue({ state: 'succeeded', receipt: { ...receipt, sample_count: rows.length } })
        mocks.page.mockResolvedValueOnce({ data: rows.slice(0, 1000), error: null }).mockResolvedValueOnce({ data: rows.slice(1000), error: null })
        expect((await response(200)).samples).toHaveLength(1201)
        expect(mocks.range.mock.calls).toEqual([[0, 999], [1000, 1200]])
    })

    it('continues after a server page shorter than the requested range', async () => {
        mocks.status.mockResolvedValue({ state: 'succeeded', receipt: { ...receipt, sample_count: 3 } })
        mocks.page.mockResolvedValueOnce({ data: [row(0)], error: null }).mockResolvedValueOnce({ data: [row(1), row(2)], error: null })
        expect((await response(200)).samples).toHaveLength(3)
        expect(mocks.range.mock.calls).toEqual([[0, 2], [1, 2]])
    })

    it.each([
        [], null, [{ ...row(), sample_id: 'invalid' }], [{ ...row(), row_number: 0 }],
        [{ ...row(), official_sample_identifier: '' }], [{ ...row(), official_sample_identifier: null }],
    ])('fails closed for hidden/partial/malformed mapping data %#', async data => {
        mocks.page.mockResolvedValue({ data, error: null })
        await response(503)
    })

    it.each(['row', 'id', 'identifier'])('fails closed for duplicate %s mappings', async key => {
        const second = row(1)
        if (key === 'row') second.row_number = row().row_number
        if (key === 'id') second.sample_id = row().sample_id
        if (key === 'identifier') second.official_sample_identifier = row().official_sample_identifier
        mocks.status.mockResolvedValue({ state: 'succeeded', receipt: { ...receipt, sample_count: 2 } })
        mocks.page.mockResolvedValue({ data: [row(), second], error: null })
        await response(503)
    })

    it('returns no partial IDs if a later RLS page is empty or the database fails', async () => {
        mocks.status.mockResolvedValue({ state: 'succeeded', receipt: { ...receipt, sample_count: 2 } })
        mocks.page.mockResolvedValueOnce({ data: [row()], error: null }).mockResolvedValueOnce({ data: [], error: null })
        const body = await response(503)
        expect(body.samples).toBeUndefined()
        mocks.page.mockResolvedValue({ data: null, error: { code: '42501', message: 'RAW_DB' } })
        await response(503)
    })

    it('conceals thrown transport failures and never uses a privileged fallback', async () => {
        mocks.page.mockRejectedValue(new Error('RAW_CONNECTION'))
        await response(503)
        expect(mocks.admin).not.toHaveBeenCalled()
    })
})

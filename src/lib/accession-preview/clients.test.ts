// Phase 1 behavior: canonical SQL decisions drive a read-only, all-or-nothing plan.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ValidatedAccessionWorkbook } from '@/lib/accession-workbook/validate'
import { resolveAccessionPreviewClients } from './clients'

const mocks = vi.hoisted(() => ({ resolve: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/client-resolution/server', () => ({ resolveAccessionPreviewClientsV1: mocks.resolve }))

const normalized = {
    name: 'nguyễn an', dateOfBirth: '2000-01-01', governmentIdentityType: null, governmentIdentityValue: null,
    gender: null, phone: null, address: null, healthInsuranceNum: null, expiryDate: null,
}
const clientId = '11111111-1111-4111-8111-111111111111'
const input = (row = 4, patch = {}) => ({ ...normalized, name: 'Nguyễn An', ...patch, temporaryReference: `KH-${row}`, callerContext: { sheet: 'Khách hàng', row, temporaryReference: `KH-${row}` } })
const workbook = (...clients: ReturnType<typeof input>[]) => ({ clients, samples: [], assignments: [], template: {} }) as unknown as ValidatedAccessionWorkbook
const matched = (row = 4, patch = {}) => ({ row, input: normalized, resolution: { outcome: 'matched', reasonCode: 'name_dob_match', clientId, created: false }, trustedIdentity: null, displayValues: normalized, issues: [], ...patch })

async function run(value: ValidatedAccessionWorkbook) {
    return resolveAccessionPreviewClients(value)
}

describe('canonical accession preview client plan', () => {
    beforeEach(() => vi.clearAllMocks())

    it('reuses SQL-normalized input without filling optional existing fields', async () => {
        mocks.resolve.mockResolvedValue({ data: [matched()] })
        const result = await run(workbook(input()))
        expect(mocks.resolve).toHaveBeenCalledWith([input()])
        expect(result).toMatchObject({ ok: true, clients: [{ input: normalized, disposition: 'reuse', clientId, callerContext: input().callerContext }] })
        expect(JSON.stringify(result)).not.toContain('client_created')
    })

    it('requires gender and valid phone only after a not_found decision', async () => {
        mocks.resolve.mockResolvedValue({ data: [matched(4, { resolution: { outcome: 'not_found', reasonCode: 'identity_not_found', clientId: null, created: false }, displayValues: null })] })
        const result = await run(workbook(input()))
        expect(result).toMatchObject({ ok: false, errors: [{ code: 'REQUIRED_VALUE_MISSING', row: 4, column: 'F' }, { code: 'REQUIRED_VALUE_MISSING', row: 4, column: 'G' }] })
        expect(result).not.toHaveProperty('clients')
    })

    it('creates a plan for valid not_found rows without creating a client', async () => {
        const fields = { ...normalized, gender: 'Nam', phone: '0901234567' }
        mocks.resolve.mockResolvedValue({ data: [matched(4, { input: fields, resolution: { outcome: 'not_found', reasonCode: 'identity_not_found', clientId: null, created: false }, displayValues: null })] })
        expect(await run(workbook(input(4, fields)))).toMatchObject({ ok: true, clients: [{ disposition: 'create', clientId: null, input: fields }] })
        expect(mocks.resolve).toHaveBeenCalledTimes(1)
    })

    it('reports canonical batch guards at every row with related safe coordinates', async () => {
        mocks.resolve.mockResolvedValue({ data: [
            matched(4, { issues: [{ code: 'CLIENT_DUPLICATE', reasonCode: 'same_uuid', relatedRows: [7] }] }),
            matched(7, { issues: [{ code: 'CLIENT_DUPLICATE', reasonCode: 'same_uuid', relatedRows: [4] }] }),
        ] })
        const result = await run(workbook(input(7), input()))
        expect(result).toMatchObject({ ok: false, errors: [
            { code: 'CLIENT_DUPLICATE', row: 4, column: 'A', relatedLocations: [{ row: 7 }] },
            { code: 'CLIENT_DUPLICATE', row: 7, column: 'A', relatedLocations: [{ row: 4 }] },
        ] })
        expect(result).not.toHaveProperty('clients')
    })

    it.each(['conflict', 'ambiguous'] as const)('rejects %s without profile disclosure', async outcome => {
        mocks.resolve.mockResolvedValue({ data: [matched(4, { resolution: { outcome, reasonCode: outcome === 'conflict' ? 'identity_conflict' : 'name_dob_ambiguous', clientId: null, created: false }, trustedIdentity: null, displayValues: null })] })
        const result = await run(workbook(input()))
        expect(result).toMatchObject({ ok: false, errors: [{ code: 'CLIENT_CONFLICT', row: 4 }] })
        expect(JSON.stringify(result)).not.toMatch(/Nguyễn|nguyễn|2000-01-01|11111111/)
    })

    it('keeps canonical-permitted different UUIDs distinct despite equal name and DOB', async () => {
        mocks.resolve.mockResolvedValue({ data: [matched(), matched(7, { resolution: { ...matched().resolution, clientId: '22222222-2222-4222-8222-222222222222' } })] })
        expect(await run(workbook(input(), input(7)))).toMatchObject({ ok: true, clients: [{ disposition: 'reuse' }, { disposition: 'reuse' }] })
    })

    it('reuses canonical Vietnamese reason messages for phone conflict and ambiguity', async () => {
        mocks.resolve.mockResolvedValue({ data: [
            matched(4, { resolution: { outcome: 'conflict', reasonCode: 'phone_conflict', clientId: null, created: false }, displayValues: null }),
            matched(7, { resolution: { outcome: 'ambiguous', reasonCode: 'name_dob_ambiguous', clientId: null, created: false }, displayValues: null }),
        ] })
        expect(await run(workbook(input(), input(7)))).toMatchObject({ ok: false, errors: [
            { row: 4, message: 'Số điện thoại đang gắn với hồ sơ khác và không thể dùng để tạo mới.' },
            { row: 7, message: 'Họ tên và ngày sinh khớp với nhiều hồ sơ. Cần quản lý xử lý trước.' },
        ] })
    })

    it.each([
        { error: 'Không thể phân giải khách hàng. Vui lòng thử lại.' },
        { data: [] },
        { data: [matched(), matched()] },
        { data: [matched(99)] },
        { data: [matched(4, { resolution: { ...matched().resolution, created: true } })] },
    ])('fails closed on unavailable or inconsistent bridge result %#', async response => {
        mocks.resolve.mockResolvedValue(response)
        expect(await run(workbook(input()))).toMatchObject({ ok: false, errors: [{ code: 'CLIENT_RESOLUTION_UNAVAILABLE' }] })
    })
})

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    requireRole: vi.fn(),
    getMetadata: vi.fn(),
    listProvinces: vi.fn(),
    listCommunes: vi.fn(),
    searchSuggestions: vi.fn(),
    toHttpError: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({
    requireRole: mocks.requireRole,
    isAuthError: (value: unknown) => (
        typeof value === 'object'
        && value !== null
        && 'error' in value
    ),
}))

vi.mock('@/lib/vietnamese-address/server', () => ({
    getVietnameseAddressMetadata: mocks.getMetadata,
    listVietnameseAddressProvinces: mocks.listProvinces,
    listVietnameseAddressCommunes: mocks.listCommunes,
    searchVietnameseAddressSuggestions: mocks.searchSuggestions,
    toVietnameseAddressHttpError: mocks.toHttpError,
}))

import { GET } from './route'

function request(query: string) {
    return new Request(`http://localhost/api/vietnamese-address${query}`)
}

describe('Vietnamese address API route', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.requireRole.mockResolvedValue({ id: 'user-1', role: 'analyst' })
        mocks.toHttpError.mockReturnValue({
            status: 503,
            code: 'service_unavailable',
            message: 'Gợi ý địa chỉ hiện không khả dụng',
        })
    })

    it('rejects anonymous callers before contacting the private service', async () => {
        mocks.requireRole.mockResolvedValue({ error: 'Unauthorized' })

        const response = await GET(request('?operation=search&q=Ba%20Dinh'))

        expect(response.status).toBe(401)
        expect(mocks.searchSuggestions).not.toHaveBeenCalled()
    })

    it('rejects unauthorized roles before contacting the private service', async () => {
        mocks.requireRole.mockResolvedValue({
            error: 'Only analyst or manager can perform this action',
        })

        const response = await GET(request('?operation=provinces'))

        expect(response.status).toBe(403)
        expect(mocks.listProvinces).not.toHaveBeenCalled()
    })

    it('routes bounded metadata, province, commune, and search requests', async () => {
        mocks.getMetadata.mockResolvedValue({ service_version: 's2' })
        mocks.listProvinces.mockResolvedValue({ provinces: [] })
        mocks.listCommunes.mockResolvedValue({ communes: [] })
        mocks.searchSuggestions.mockResolvedValue({ suggestions: [] })

        const metadata = await GET(request('?operation=meta'))
        const provinces = await GET(request('?operation=provinces'))
        const communes = await GET(
            request('?operation=communes&province_code=01'),
        )
        const search = await GET(
            request('?operation=search&q=Ba%20Dinh&province_code=01&limit=8'),
        )

        expect(metadata.status).toBe(200)
        expect(provinces.status).toBe(200)
        expect(communes.status).toBe(200)
        expect(search.status).toBe(200)
        expect(mocks.requireRole).toHaveBeenCalledWith(['analyst', 'manager'])
        expect(mocks.listCommunes).toHaveBeenCalledWith('01')
        expect(mocks.searchSuggestions).toHaveBeenCalledWith('Ba Dinh', '01', 8)
    })

    it('rejects unbounded or personal-address search input locally', async () => {
        const response = await GET(
            request('?operation=search&q=12%20Nguyen%20Trai%2C%20Ha%20Noi&limit=25'),
        )

        expect(response.status).toBe(400)
        expect(mocks.searchSuggestions).not.toHaveBeenCalled()
    })

    it('rejects word-only complete addresses before contacting the service', async () => {
        mocks.searchSuggestions.mockResolvedValue({ suggestions: [] })

        const response = await GET(request(
            '?operation=search&q=So%20Muoi%20Hai%20Nguyen%20Trai%20Ha%20Noi',
        ))

        expect(response.status).toBe(400)
        expect(mocks.searchSuggestions).not.toHaveBeenCalled()
    })

    it('accepts long names with an explicit administrative prefix', async () => {
        mocks.searchSuggestions.mockResolvedValue({ suggestions: [] })

        const response = await GET(request(
            '?operation=search&q=Thanh%20pho%20Ho%20Chi%20Minh',
        ))

        expect(response.status).toBe(200)
        expect(mocks.searchSuggestions).toHaveBeenCalledWith(
            'Thanh pho Ho Chi Minh',
            undefined,
            8,
        )
    })

    it('preserves the redacted adapter error code for client fallback policy', async () => {
        mocks.searchSuggestions.mockRejectedValue(new Error('private upstream error'))
        mocks.toHttpError.mockReturnValue({
            status: 503,
            code: 'timeout',
            message: 'Gợi ý địa chỉ hiện không khả dụng',
        })

        const response = await GET(request('?operation=search&q=Ba%20Dinh'))

        expect(response.status).toBe(503)
        await expect(response.json()).resolves.toEqual({
            error: 'Gợi ý địa chỉ hiện không khả dụng',
            code: 'timeout',
        })
    })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchVietnameseAddressClient } from './client'

function errorResponse(code: string) {
    return new Response(JSON.stringify({
        error: 'Gợi ý địa chỉ hiện không khả dụng',
        code,
    }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
    })
}

afterEach(() => {
    vi.restoreAllMocks()
})

describe('Vietnamese address browser client', () => {
    it.each([
        'Văn Miếu - Quốc Tử Giám',
        "Ea H'Leo",
        'Ea H’Leo',
    ])('accepts punctuation used by administrative names: %s', async (query) => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            errorResponse('timeout'),
        )

        await searchVietnameseAddressClient(query)

        expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('keeps transient failures retryable', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            errorResponse('timeout'),
        )

        await expect(
            searchVietnameseAddressClient('Ba Dinh'),
        ).resolves.toMatchObject({
            unavailable: true,
            disabled: false,
        })
    })

    it('marks missing server configuration as disabled', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            errorResponse('disabled'),
        )

        await expect(
            searchVietnameseAddressClient('Ba Dinh'),
        ).resolves.toMatchObject({
            unavailable: false,
            disabled: true,
        })
    })
})

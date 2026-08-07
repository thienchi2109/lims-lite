// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    getVietnameseAddressConfig,
    getVietnameseAddressMetadata,
    listVietnameseAddressCommunes,
    listVietnameseAddressProvinces,
    searchVietnameseAddressSuggestions,
} from './server'

const SERVICE_URL = 'http://100.93.19.42:8091'

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    })
}

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
})

describe('Vietnamese address server adapter', () => {
    it('is disabled when the server-only service URL is absent', async () => {
        vi.stubEnv('VIETNAMESE_ADDRESS_SERVICE_URL', '')
        const fetchSpy = vi.spyOn(globalThis, 'fetch')

        expect(getVietnameseAddressConfig()).toBeNull()
        await expect(getVietnameseAddressMetadata()).rejects.toMatchObject({
            code: 'disabled',
        })
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('validates metadata, province, commune, and search contracts', async () => {
        vi.stubEnv('VIETNAMESE_ADDRESS_SERVICE_URL', `${SERVICE_URL}/`)
        vi.stubEnv('VIETNAMESE_ADDRESS_SERVICE_TIMEOUT_MS', '900')
        vi.spyOn(console, 'info').mockImplementation(() => undefined)
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(jsonResponse({
                service_version: 's2',
                dataset: {
                    version: '2026-07',
                    schema_version: '1',
                    effective_date: '2026-07-01',
                    province_count: 34,
                    commune_count: 3321,
                },
            }))
            .mockResolvedValueOnce(jsonResponse({
                dataset_version: '2026-07',
                provinces: [{
                    code: '01',
                    name: 'Hà Nội',
                    full_name: 'Thành phố Hà Nội',
                    kind: 'municipality',
                }],
            }))
            .mockResolvedValueOnce(jsonResponse({
                dataset_version: '2026-07',
                province: {
                    code: '01',
                    name: 'Hà Nội',
                    full_name: 'Thành phố Hà Nội',
                    kind: 'municipality',
                },
                communes: [{
                    code: '00001',
                    name: 'Ba Đình',
                    full_name: 'Phường Ba Đình',
                    kind: 'ward',
                    province_code: '01',
                }],
            }))
            .mockResolvedValueOnce(jsonResponse({
                dataset_version: '2026-07',
                result_count: 1,
                results: [{
                    code: '00001',
                    name: 'Ba Đình',
                    full_name: 'Phường Ba Đình',
                    kind: 'ward',
                    level: 'commune',
                    province_code: '01',
                }],
            }))
            .mockResolvedValueOnce(jsonResponse({
                dataset_version: '2026-07',
                provinces: [{
                    code: '01',
                    name: 'Hà Nội',
                    full_name: 'Thành phố Hà Nội',
                    kind: 'municipality',
                }],
            }))

        await expect(getVietnameseAddressMetadata()).resolves.toMatchObject({
            dataset: { version: '2026-07' },
        })
        await expect(listVietnameseAddressProvinces()).resolves.toMatchObject({
            provinces: [{ code: '01' }],
        })
        await expect(listVietnameseAddressCommunes('01')).resolves.toMatchObject({
            communes: [{ code: '00001' }],
        })
        await expect(
            searchVietnameseAddressSuggestions('Ba Dinh', undefined, 8),
        ).resolves.toEqual({
            dataset_version: '2026-07',
            suggestions: [{
                code: '00001',
                name: 'Ba Đình',
                full_name: 'Phường Ba Đình',
                kind: 'ward',
                level: 'commune',
                province_code: '01',
                province_full_name: 'Thành phố Hà Nội',
                formatted_address: 'Phường Ba Đình, Thành phố Hà Nội',
            }],
        })

        expect(fetchSpy.mock.calls.map(([url]) => String(url))).toEqual([
            `${SERVICE_URL}/v1/meta`,
            `${SERVICE_URL}/v1/provinces`,
            `${SERVICE_URL}/v1/provinces/01/communes`,
            `${SERVICE_URL}/v1/search?q=Ba+Dinh&limit=8`,
            `${SERVICE_URL}/v1/provinces`,
        ])
    })

    it('aborts requests at the configured timeout', async () => {
        vi.stubEnv('VIETNAMESE_ADDRESS_SERVICE_URL', SERVICE_URL)
        vi.stubEnv('VIETNAMESE_ADDRESS_SERVICE_TIMEOUT_MS', '750')
        vi.spyOn(console, 'info').mockImplementation(() => undefined)

        let triggerTimeout: (() => void) | undefined
        let capturedSignal: AbortSignal | undefined
        const timeoutHandle = {} as ReturnType<typeof setTimeout>
        vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback, delay) => {
            expect(delay).toBe(750)
            triggerTimeout = () => callback()
            return timeoutHandle
        })
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
            capturedSignal = init?.signal ?? undefined
            return new Promise((_resolve, reject) => {
                capturedSignal?.addEventListener(
                    'abort',
                    () => reject(new DOMException('aborted', 'AbortError')),
                    { once: true },
                )
            })
        })

        const request = getVietnameseAddressMetadata()
        while (fetchSpy.mock.calls.length === 0) {
            await new Promise<void>((resolve) => setImmediate(resolve))
        }
        triggerTimeout?.()

        await expect(request).rejects.toMatchObject({ code: 'timeout' })
        expect(capturedSignal?.aborted).toBe(true)
        expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutHandle)
    })

    it('fails closed on invalid upstream JSON', async () => {
        vi.stubEnv('VIETNAMESE_ADDRESS_SERVICE_URL', SERVICE_URL)
        vi.spyOn(console, 'info').mockImplementation(() => undefined)
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse({ dataset_version: '2026-07', provinces: 'invalid' }),
        )

        await expect(listVietnameseAddressProvinces()).rejects.toMatchObject({
            code: 'invalid_response',
        })
    })

    it('cancels a rejected upstream response body', async () => {
        vi.stubEnv('VIETNAMESE_ADDRESS_SERVICE_URL', SERVICE_URL)
        vi.spyOn(console, 'info').mockImplementation(() => undefined)
        const cancel = vi.fn()
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('upstream failure'))
            },
            cancel,
        })
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(body, { status: 503 }),
        )

        await expect(getVietnameseAddressMetadata()).rejects.toMatchObject({
            code: 'upstream_rejected',
        })
        expect(cancel).toHaveBeenCalledTimes(1)
    })

    it('cancels an oversized chunked response before buffering the full body', async () => {
        vi.stubEnv('VIETNAMESE_ADDRESS_SERVICE_URL', SERVICE_URL)
        vi.spyOn(console, 'info').mockImplementation(() => undefined)
        const cancel = vi.fn()
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('x'.repeat(65 * 1024)))
            },
            cancel,
        })
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body))

        await expect(getVietnameseAddressMetadata()).rejects.toMatchObject({
            code: 'invalid_response',
        })
        expect(cancel).toHaveBeenCalledTimes(1)
    })

    it('rejects commune lists owned by a different province', async () => {
        vi.stubEnv('VIETNAMESE_ADDRESS_SERVICE_URL', SERVICE_URL)
        vi.spyOn(console, 'info').mockImplementation(() => undefined)
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
            dataset_version: '2026-07',
            province: {
                code: '79',
                name: 'Hồ Chí Minh',
                full_name: 'Thành phố Hồ Chí Minh',
                kind: 'municipality',
            },
            communes: [{
                code: '26734',
                name: 'Bến Nghé',
                full_name: 'Phường Bến Nghé',
                kind: 'ward',
                province_code: '79',
            }],
        }))

        await expect(
            listVietnameseAddressCommunes('01'),
        ).rejects.toMatchObject({ code: 'invalid_response' })
    })

    it('rejects search results without an explicit administrative level', async () => {
        vi.stubEnv('VIETNAMESE_ADDRESS_SERVICE_URL', SERVICE_URL)
        vi.spyOn(console, 'info').mockImplementation(() => undefined)
        vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(jsonResponse({
                dataset_version: '2026-07',
                result_count: 1,
                results: [{
                    code: '00001',
                    name: 'Ba Đình',
                    full_name: 'Phường Ba Đình',
                    kind: 'ward',
                }],
            }))
            .mockResolvedValueOnce(jsonResponse({
                dataset_version: '2026-07',
                provinces: [],
            }))

        await expect(
            searchVietnameseAddressSuggestions('Ba Dinh', undefined, 8),
        ).rejects.toMatchObject({ code: 'invalid_response' })
    })

    it('rejects search responses that exceed the requested result limit', async () => {
        vi.stubEnv('VIETNAMESE_ADDRESS_SERVICE_URL', SERVICE_URL)
        vi.spyOn(console, 'info').mockImplementation(() => undefined)
        vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(jsonResponse({
                dataset_version: '2026-07',
                result_count: 2,
                results: [
                    {
                        code: '01',
                        name: 'Hà Nội',
                        full_name: 'Thành phố Hà Nội',
                        kind: 'municipality',
                        level: 'province',
                    },
                    {
                        code: '79',
                        name: 'Hồ Chí Minh',
                        full_name: 'Thành phố Hồ Chí Minh',
                        kind: 'municipality',
                        level: 'province',
                    },
                ],
            }))
            .mockResolvedValueOnce(jsonResponse({
                dataset_version: '2026-07',
                provinces: [],
            }))

        await expect(
            searchVietnameseAddressSuggestions('Thanh pho', undefined, 1),
        ).rejects.toMatchObject({ code: 'invalid_response' })
    })

    it('rejects filtered search results owned by another province', async () => {
        vi.stubEnv('VIETNAMESE_ADDRESS_SERVICE_URL', SERVICE_URL)
        vi.spyOn(console, 'info').mockImplementation(() => undefined)
        vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(jsonResponse({
                dataset_version: '2026-07',
                result_count: 1,
                results: [{
                    code: '26734',
                    name: 'Bến Nghé',
                    full_name: 'Phường Bến Nghé',
                    kind: 'ward',
                    level: 'commune',
                    province_code: '79',
                }],
            }))
            .mockResolvedValueOnce(jsonResponse({
                dataset_version: '2026-07',
                provinces: [{
                    code: '79',
                    name: 'Hồ Chí Minh',
                    full_name: 'Thành phố Hồ Chí Minh',
                    kind: 'municipality',
                }],
            }))

        await expect(
            searchVietnameseAddressSuggestions('Ben Nghe', '01', 8),
        ).rejects.toMatchObject({ code: 'invalid_response' })
    })
})

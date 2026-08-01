import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    fetchAssayDefinitionsClient,
    fetchMethodNameSuggestionsClient,
    fetchSamplesForApprovalCountClient,
} from './api-client'

describe('callClientAction', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('does not throw when a successful 200 response includes a falsy error field', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ error: null, data: 3 }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            }),
        )

        await expect(fetchSamplesForApprovalCountClient()).resolves.toEqual({
            error: null,
            data: 3,
        })
    })

    it('requests assay method name suggestions from the client-action bridge', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ data: ['CLIA'] }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            }),
        )

        await expect(fetchMethodNameSuggestionsClient()).resolves.toEqual({ data: ['CLIA'] })
        expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
            action: 'getMethodNameSuggestions',
        })
    })

    it('passes an assay request AbortSignal through to fetch', async () => {
        const controller = new AbortController()
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ data: [] }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            }),
        )

        await fetchAssayDefinitionsClient({ search: 'HIV' }, { signal: controller.signal })

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/client-actions',
            expect.objectContaining({ signal: controller.signal }),
        )
    })
})

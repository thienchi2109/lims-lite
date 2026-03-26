import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSamplesForApprovalCountClient } from './api-client'

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
})

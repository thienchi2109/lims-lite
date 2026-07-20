import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    accessionAndAssignTestsClient,
    createSampleClient,
} from './api-client'

function successfulResponse() {
    return new Response(JSON.stringify({ data: { id: 'sample-1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
}

describe('sample quality client-action contract', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('forwards acceptable quality through createSampleClient', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(successfulResponse())
        const payload = {
            client_id: '11111111-1111-4111-8111-111111111111',
            client_name: 'Nguyen Van A',
            type: 'Máu',
            sample_quality: true,
        } as Parameters<typeof createSampleClient>[0]

        await createSampleClient(payload)

        expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
            action: 'createSample',
            payload,
        })
    })

    it('forwards unacceptable quality through accessionAndAssignTestsClient', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(successfulResponse())
        const payload = {
            client_id: '11111111-1111-4111-8111-111111111111',
            client_name: 'Nguyen Van A',
            type: 'Máu',
            sample_quality: false,
            tests: [{
                assayId: '22222222-2222-4222-8222-222222222222',
                methodId: null,
            }],
        } as Parameters<typeof accessionAndAssignTestsClient>[0]

        await accessionAndAssignTestsClient(payload)

        expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
            action: 'accessionAndAssignTests',
            payload,
        })
    })
})

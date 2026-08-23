import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    assignQrAccessionTestsClient,
    accessionAndAssignTestsClient,
    createManualAccessionSampleClient,
    createSampleClient,
    prepareManualAccessionClientClient,
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
            sampleTypeId: '33333333-3333-4333-8333-333333333333',
            sampleTypeCode: 'LM-000001',
            expectedRevisionNumber: 7,
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
            sampleTypeId: '33333333-3333-4333-8333-333333333333',
            sampleTypeCode: 'LM-000001',
            expectedRevisionNumber: 7,
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

    it('binds manual client preparation to its fixed server action', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(successfulResponse())
        const payload = {
            id_card_num: '086094006827',
            name: 'Nguyen Van A',
            date_of_birth: '1994-09-21',
            gender: 'Nam' as const,
            phone: '0901234567',
            address: 'Can Tho',
        }

        await prepareManualAccessionClientClient(payload)

        expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
            action: 'prepareManualAccessionClient',
            payload,
        })
    })

    it('binds no-test sample creation to the fixed manual action', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(successfulResponse())
        const payload = {
            type: 'Máu' as const,
            sampleTypeId: '33333333-3333-4333-8333-333333333333',
            sampleTypeCode: 'LM-000001',
            expectedRevisionNumber: 7,
            sample_quality: true,
            client_resolution: {
                kind: 'existing' as const,
                governmentIdentityType: 'cccd' as const,
                governmentIdentityValue: '086094006827',
                name: 'Nguyen Van A',
                dateOfBirth: '1994-09-21',
                phone: '0901234567',
            },
        }

        await createManualAccessionSampleClient(payload)

        expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
            action: 'createManualAccessionSample',
            payload,
        })
    })

    it('binds assigned-test accession to the fixed QR action', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(successfulResponse())
        const payload = {
            type: 'Máu' as const,
            sampleTypeId: '33333333-3333-4333-8333-333333333333',
            sampleTypeCode: 'LM-000001',
            expectedRevisionNumber: 7,
            sample_quality: true,
            tests: [{
                assayId: '22222222-2222-4222-8222-222222222222',
                methodId: null,
            }],
            client_resolution: {
                kind: 'draft' as const,
                governmentIdentityType: 'cccd' as const,
                governmentIdentityValue: '086094006827',
                name: 'Nguyen Van A',
                dateOfBirth: '1994-09-21',
                gender: 'Nam' as const,
                phone: '0901234567',
                address: 'Can Tho',
            },
        }

        await assignQrAccessionTestsClient(payload)

        expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
            action: 'assignQrAccessionTests',
            payload,
        })
    })
})

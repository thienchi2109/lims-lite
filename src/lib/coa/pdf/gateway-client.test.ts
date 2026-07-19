// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
    startGatewayTestSystem,
    validGatewayToken,
} from '../../../../tests/helpers/pdf-gateway-test-harness'
import * as gatewayClient from './gateway-client'

const VALID_GATEWAY_REQUEST_ID = '8c3f5a28-9310-4eb2-9ff0-d20a8dcf6556'
const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\nslice-4a')

let temporaryDirectory = ''
let tokenFile = ''
let originalGatewayUrl: string | undefined
let originalTokenFile: string | undefined
const gatewaySystems: Array<
    Awaited<ReturnType<typeof startGatewayTestSystem>>
> = []

beforeEach(async () => {
    originalGatewayUrl = process.env.GOTENBERG_URL
    originalTokenFile = process.env.PDF_GATEWAY_TOKEN_FILE
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'coa-pdf-gateway-'))

    tokenFile = join(temporaryDirectory, 'gateway-token')
    await writeFile(tokenFile, 'lims.slice-4a-token\n', 'utf8')

    process.env.GOTENBERG_URL =
        'http://pdf-gateway:8080/ignored-base-path?ignored=true'
    process.env.PDF_GATEWAY_TOKEN_FILE = tokenFile
})

afterEach(async () => {
    await Promise.all(gatewaySystems.splice(0).map((system) => system.close()))
    vi.restoreAllMocks()

    if (originalGatewayUrl === undefined) {
        delete process.env.GOTENBERG_URL
    } else {
        process.env.GOTENBERG_URL = originalGatewayUrl
    }

    if (originalTokenFile === undefined) {
        delete process.env.PDF_GATEWAY_TOKEN_FILE
    } else {
        process.env.PDF_GATEWAY_TOKEN_FILE = originalTokenFile
    }

    await rm(temporaryDirectory, { force: true, recursive: true })
})

function createGatewayResponse(options: {
    contentType?: string
    pdfBytes?: Uint8Array
    requestId?: string | null
    status?: number
} = {}): Response {
    const headers = new Headers({
        'content-type': options.contentType ?? 'application/pdf',
    })
    const requestId =
        options.requestId === undefined
            ? VALID_GATEWAY_REQUEST_ID
            : options.requestId

    if (requestId !== null) {
        headers.set('x-request-id', requestId)
    }

    return new Response(options.pdfBytes ?? PDF_BYTES, {
        status: options.status ?? 200,
        headers,
    })
}

describe('convertHtmlToPdf', () => {
    test('exposes only the authorized HTML as caller-controlled input', () => {
        expect(Object.keys(gatewayClient)).toEqual(['convertHtmlToPdf'])
        expect(gatewayClient.convertHtmlToPdf).toHaveLength(1)
    })

    test('submits the exact authenticated multipart contract', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(createGatewayResponse())
        const html = '<html><body>Released CoA</body></html>'
        const convertWithIgnoredTransportInput =
            gatewayClient.convertHtmlToPdf as (
                releasedHtml: string,
                ignoredTransportInput: {
                    headers: Headers
                    url: string
                }
            ) => ReturnType<typeof gatewayClient.convertHtmlToPdf>

        await convertWithIgnoredTransportInput(html, {
            headers: new Headers({
                Authorization: 'Bearer incoming-session',
                Cookie: 'session=must-not-forward',
            }),
            url: 'http://gotenberg:3000/forms/chromium/convert/html',
        })

        expect(fetchSpy).toHaveBeenCalledTimes(1)
        const [url, request] = fetchSpy.mock.calls[0]
        expect(url).toBe('http://pdf-gateway:8080/v1/convert/html')
        expect(request).toMatchObject({
            method: 'POST',
            redirect: 'error',
        })

        const headers = new Headers(request?.headers)
        expect([...headers.entries()]).toEqual([
            ['authorization', 'Bearer lims.slice-4a-token'],
        ])
        expect(headers.has('content-type')).toBe(false)

        const form = request?.body
        expect(form).toBeInstanceOf(FormData)
        const entries = [...(form as FormData).entries()]
        expect(entries.map(([name]) => name)).toEqual([
            'files',
            'emulatedMediaType',
            'printBackground',
            'preferCssPageSize',
            'skipNetworkIdleEvent',
            'failOnResourceLoadingFailed',
            'failOnResourceHttpStatusCodes',
        ])

        const file = entries[0][1]
        expect(file).toBeInstanceOf(Blob)
        expect((file as Blob & { name?: string }).name).toBe('index.html')
        expect((file as Blob).type).toBe('text/html')
        expect(await (file as Blob).text()).toBe(html)
        expect(Object.fromEntries(entries.slice(1))).toEqual({
            emulatedMediaType: 'print',
            printBackground: 'true',
            preferCssPageSize: 'true',
            skipNetworkIdleEvent: 'false',
            failOnResourceLoadingFailed: 'true',
            failOnResourceHttpStatusCodes: '[400,599]',
        })
    })

    test('serializes native FormData accepted by the authenticated gateway', async () => {
        const system = await startGatewayTestSystem({})
        gatewaySystems.push(system)
        process.env.GOTENBERG_URL = system.gatewayUrl
        await writeFile(tokenFile, `${validGatewayToken}\n`, 'utf8')

        const result = await gatewayClient.convertHtmlToPdf(
            '<html><body>Released CoA integration</body></html>'
        )

        expect(new TextDecoder().decode(result.pdfBytes)).toBe(
            '%PDF-1.7 test'
        )
        expect(result.gatewayRequestId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f-]{27}$/i
        )
        expect(system.upstreamRequests).toHaveLength(1)
        expect(system.upstreamRequests[0]).toMatchObject({
            method: 'POST',
            url: '/forms/chromium/convert/html',
        })
        expect(system.upstreamRequests[0].headers['content-type']).toMatch(
            /^multipart\/form-data;\s*boundary=/i
        )
    })

    test('returns validated PDF bytes and the gateway request ID', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createGatewayResponse({
                contentType: 'application/pdf; version=1.7',
            })
        )

        const result = await gatewayClient.convertHtmlToPdf('<html></html>')

        expect(result.pdfBytes).toEqual(PDF_BYTES)
        expect(result.gatewayRequestId).toBe(VALID_GATEWAY_REQUEST_ID)
    })

    test('returns null when the gateway request ID is absent', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createGatewayResponse({ requestId: null })
        )

        const result = await gatewayClient.convertHtmlToPdf('<html></html>')

        expect(result.gatewayRequestId).toBeNull()
    })

    test('rejects responses without a PDF content type or signature', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')

        fetchSpy.mockResolvedValueOnce(
            createGatewayResponse({ contentType: 'text/html' })
        )
        await expect(
            gatewayClient.convertHtmlToPdf('<html></html>')
        ).rejects.toThrow('invalid PDF response')

        fetchSpy.mockResolvedValueOnce(
            createGatewayResponse({
                pdfBytes: new TextEncoder().encode('not-a-pdf'),
            })
        )
        await expect(
            gatewayClient.convertHtmlToPdf('<html></html>')
        ).rejects.toThrow('invalid PDF response')
    })

    test('rejects non-success responses even when the body looks like a PDF', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createGatewayResponse({ status: 502 })
        )

        await expect(
            gatewayClient.convertHtmlToPdf('<html></html>')
        ).rejects.toThrow('invalid PDF response')
    })

    test('drops a malformed gateway request ID', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createGatewayResponse({
                requestId: 'not-a-valid-gateway-request-id',
            })
        )

        const result = await gatewayClient.convertHtmlToPdf('<html></html>')

        expect(result.gatewayRequestId).toBeNull()
    })
})

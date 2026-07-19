// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { convertHtmlToPdf } from './gateway-client'

const GATEWAY_REQUEST_ID = 'f76b37e9-ff18-414e-9c90-c04d9f56c450'

let temporaryDirectory = ''
let originalGatewayUrl: string | undefined
let originalTokenFile: string | undefined

beforeEach(async () => {
    originalGatewayUrl = process.env.GOTENBERG_URL
    originalTokenFile = process.env.PDF_GATEWAY_TOKEN_FILE
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'coa-pdf-transport-'))
    const tokenFile = join(temporaryDirectory, 'gateway-token')
    await writeFile(tokenFile, 'lims.transport-token\n', 'utf8')

    process.env.GOTENBERG_URL =
        'http://pdf-gateway:8080/ignored?query=ignored'
    process.env.PDF_GATEWAY_TOKEN_FILE = tokenFile
})

afterEach(async () => {
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

async function captureFailure(conversion: Promise<unknown>) {
    try {
        await conversion
    } catch (error) {
        expect(error).toBeInstanceOf(Error)
        return error
    }

    throw new Error('Expected PDF gateway conversion to fail')
}

function responseWithBody(body: BodyInit): Response {
    return new Response(body, {
        status: 200,
        headers: {
            'content-type': 'application/pdf',
            'x-request-id': GATEWAY_REQUEST_ID,
        },
    })
}

describe('convertHtmlToPdf transport failures', () => {
    test('preserves response metadata when reading the body fails', async () => {
        const bodyFailure = 'private body stream failure'
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            responseWithBody(
                new ReadableStream({
                    pull(controller) {
                        controller.error(new Error(bodyFailure))
                    },
                })
            )
        )

        const failure = await captureFailure(
            convertHtmlToPdf('<html>released</html>')
        )

        expect(failure).toMatchObject({
            name: 'PdfGatewayError',
            code: 'service_unavailable',
            gatewayRequestId: GATEWAY_REQUEST_ID,
            statusCode: 200,
        })
        expect(`${String(failure)} ${JSON.stringify(failure)}`).not.toContain(
            bodyFailure
        )
    })

    test('preserves response metadata when body streaming times out', async () => {
        let triggerTimeout: (() => void) | undefined
        const timeoutHandle = {} as ReturnType<typeof setTimeout>
        vi.spyOn(globalThis, 'setTimeout').mockImplementation(
            (callback, delay) => {
                expect(delay).toBe(30_000)
                triggerTimeout = () => callback()
                return timeoutHandle
            }
        )
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation((_url, request) => {
                const signal = request?.signal
                return Promise.resolve(
                    responseWithBody(
                        new ReadableStream({
                            start(controller) {
                                signal?.addEventListener(
                                    'abort',
                                    () =>
                                        controller.error(
                                            new DOMException(
                                                'aborted',
                                                'AbortError'
                                            )
                                        ),
                                    { once: true }
                                )
                            },
                        })
                    )
                )
            })

        const conversion = convertHtmlToPdf('<html>released</html>')
        while (fetchSpy.mock.calls.length === 0) {
            await new Promise<void>((resolve) => setImmediate(resolve))
        }
        triggerTimeout?.()
        const failure = await captureFailure(conversion)

        expect(failure).toMatchObject({
            name: 'PdfGatewayError',
            code: 'timeout',
            gatewayRequestId: GATEWAY_REQUEST_ID,
            statusCode: 200,
        })
        expect(fetchSpy).toHaveBeenCalledTimes(1)
        expect(fetchSpy.mock.calls[0][0]).toBe(
            'http://pdf-gateway:8080/v1/convert/html'
        )
        expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutHandle)
    })

    test('does not retry or fall back after a transport failure', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockRejectedValue(new Error('connect ECONNREFUSED'))

        const failure = await captureFailure(
            convertHtmlToPdf('<html>released</html>')
        )

        expect(failure).toMatchObject({
            name: 'PdfGatewayError',
            code: 'service_unavailable',
            gatewayRequestId: null,
            statusCode: null,
        })
        expect(fetchSpy).toHaveBeenCalledTimes(1)
        expect(fetchSpy.mock.calls[0][0]).toBe(
            'http://pdf-gateway:8080/v1/convert/html'
        )
    })
})

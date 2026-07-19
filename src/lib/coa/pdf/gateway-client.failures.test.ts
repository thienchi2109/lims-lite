// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { convertHtmlToPdf } from './gateway-client'

const VALID_GATEWAY_REQUEST_ID = '9b8a6a77-820f-4b0c-94c4-3d46ca8f0bd4'
const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\nslice-4b')
const ENVIRONMENT_KEYS = [
    'GOTENBERG_URL',
    'PDF_GATEWAY_TOKEN_FILE',
    'COA_DOWNLOAD_TOKEN',
    'SUPABASE_AUTH_TOKEN',
    'SUPABASE_SERVICE_ROLE_KEY',
] as const
type ExpectedGatewayFailure = Error & {
    code:
        | 'configuration'
        | 'authentication'
        | 'timeout'
        | 'service_unavailable'
        | 'gateway_rejected'
        | 'invalid_response'
    gatewayRequestId: string | null
    statusCode: number | null
}
let temporaryDirectory = ''
let tokenFile = ''
let originalEnvironment: Record<string, string | undefined>

beforeEach(async () => {
    originalEnvironment = Object.fromEntries(
        ENVIRONMENT_KEYS.map((key) => [key, process.env[key]])
    )
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'coa-pdf-failure-'))
    tokenFile = join(temporaryDirectory, 'gateway-token')
    await writeFile(tokenFile, 'lims.slice-4b-token\n', 'utf8')

    process.env.GOTENBERG_URL = 'http://pdf-gateway:8080'
    process.env.PDF_GATEWAY_TOKEN_FILE = tokenFile
})
afterEach(async () => {
    vi.useRealTimers()
    vi.restoreAllMocks()

    for (const key of ENVIRONMENT_KEYS) {
        const originalValue = originalEnvironment[key]
        if (originalValue === undefined) {
            delete process.env[key]
        } else {
            process.env[key] = originalValue
        }
    }

    await rm(temporaryDirectory, { force: true, recursive: true })
})

function createGatewayResponse(options: {
    body?: BodyInit
    contentType?: string
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

    return new Response(options.body ?? PDF_BYTES, {
        status: options.status ?? 200,
        headers,
    })
}
async function captureFailure(
    conversion: Promise<unknown>
): Promise<ExpectedGatewayFailure> {
    try {
        await conversion
    } catch (error) {
        expect(error).toBeInstanceOf(Error)
        return error as ExpectedGatewayFailure
    }

    throw new Error('Expected PDF gateway conversion to fail')
}
function expectFailure(
    failure: ExpectedGatewayFailure,
    expected: {
        code: ExpectedGatewayFailure['code']
        gatewayRequestId?: string | null
        statusCode?: number | null
    }
) {
    expect(failure).toMatchObject({
        name: 'PdfGatewayError',
        code: expected.code,
        gatewayRequestId: expected.gatewayRequestId ?? null,
        statusCode: expected.statusCode ?? null,
    })
}

describe('convertHtmlToPdf failure model', () => {
    test('rejects a missing token-file environment path before fetch', async () => {
        delete process.env.PDF_GATEWAY_TOKEN_FILE
        const fetchSpy = vi.spyOn(globalThis, 'fetch')

        const failure = await captureFailure(
            convertHtmlToPdf('<html>released</html>')
        )

        expectFailure(failure, { code: 'configuration' })
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    test('rejects an unreadable token file before fetch', async () => {
        process.env.PDF_GATEWAY_TOKEN_FILE = join(
            temporaryDirectory,
            'missing-token'
        )
        const fetchSpy = vi.spyOn(globalThis, 'fetch')

        const failure = await captureFailure(
            convertHtmlToPdf('<html>released</html>')
        )

        expectFailure(failure, { code: 'configuration' })
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    test('rejects an empty gateway token before fetch', async () => {
        await writeFile(tokenFile, ' \n\t', 'utf8')
        const fetchSpy = vi.spyOn(globalThis, 'fetch')

        const failure = await captureFailure(
            convertHtmlToPdf('<html>released</html>')
        )

        expectFailure(failure, { code: 'configuration' })
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    test('classifies rejected gateway credentials and captures request ID', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createGatewayResponse({
                body: 'credential details must remain private',
                contentType: 'application/json',
                status: 401,
            })
        )

        const failure = await captureFailure(
            convertHtmlToPdf('<html>released</html>')
        )

        expectFailure(failure, {
            code: 'authentication',
            gatewayRequestId: VALID_GATEWAY_REQUEST_ID,
            statusCode: 401,
        })
    })

    test('aborts a timed-out request and clears its timer', async () => {
        let triggerTimeout: (() => void) | undefined
        let capturedSignal: AbortSignal | undefined
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
            capturedSignal = request?.signal ?? undefined
            if (!capturedSignal) {
                return Promise.reject(new Error('missing abort signal'))
            }
            if (capturedSignal.aborted) {
                return Promise.reject(new DOMException('aborted', 'AbortError'))
            }

            return new Promise((_resolve, reject) => {
                capturedSignal?.addEventListener(
                    'abort',
                    () => reject(new DOMException('aborted', 'AbortError')),
                    { once: true }
                )
            })
        })

        const conversion = convertHtmlToPdf('<html>released</html>')
        while (fetchSpy.mock.calls.length === 0) {
            await new Promise<void>((resolve) => setImmediate(resolve))
        }
        triggerTimeout?.()
        const failure = await captureFailure(conversion)

        expectFailure(failure, { code: 'timeout' })
        expect(capturedSignal?.aborted).toBe(true)
        expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutHandle)
    })

    test('clears the timeout after a successful response', async () => {
        vi.useFakeTimers()
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(createGatewayResponse())

        await convertHtmlToPdf('<html>released</html>')

        expect(vi.getTimerCount()).toBe(0)
    })

    test('classifies network and service-unavailable failures', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
        fetchSpy.mockRejectedValueOnce(new Error('connect ECONNREFUSED'))

        const networkFailure = await captureFailure(
            convertHtmlToPdf('<html>released</html>')
        )
        expectFailure(networkFailure, { code: 'service_unavailable' })

        fetchSpy.mockResolvedValueOnce(
            createGatewayResponse({ status: 503 })
        )
        const serviceFailure = await captureFailure(
            convertHtmlToPdf('<html>released</html>')
        )
        expectFailure(serviceFailure, {
            code: 'service_unavailable',
            gatewayRequestId: VALID_GATEWAY_REQUEST_ID,
            statusCode: 503,
        })
    })

    test('classifies gateway errors without exposing the response body', async () => {
        const sensitiveBody = 'upstream secret diagnostics'
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createGatewayResponse({
                body: sensitiveBody,
                contentType: 'text/plain',
                status: 500,
            })
        )

        const failure = await captureFailure(
            convertHtmlToPdf('<html>released</html>')
        )

        expectFailure(failure, {
            code: 'gateway_rejected',
            gatewayRequestId: VALID_GATEWAY_REQUEST_ID,
            statusCode: 500,
        })
        expect(`${String(failure)} ${JSON.stringify(failure)}`).not.toContain(
            sensitiveBody
        )
    })

    test('classifies non-PDF success responses as invalid', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createGatewayResponse({
                body: '<html>not a PDF</html>',
                contentType: 'text/html',
            })
        )

        const failure = await captureFailure(
            convertHtmlToPdf('<html>released</html>')
        )

        expectFailure(failure, {
            code: 'invalid_response',
            gatewayRequestId: VALID_GATEWAY_REQUEST_ID,
            statusCode: 200,
        })
    })

    test('adds only the dedicated gateway bearer credential', async () => {
        process.env.COA_DOWNLOAD_TOKEN = 'coa-token-must-not-forward'
        process.env.SUPABASE_AUTH_TOKEN = 'session-must-not-forward'
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-must-not-forward'
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(createGatewayResponse())
        const convertWithHostileInput = convertHtmlToPdf as (
            html: string,
            credentials: unknown
        ) => ReturnType<typeof convertHtmlToPdf>

        await convertWithHostileInput('<html>released</html>', {
            Authorization: 'Bearer incoming-authorization',
            Cookie: 'session=incoming-cookie',
            coaToken: process.env.COA_DOWNLOAD_TOKEN,
            serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY,
            supabaseSession: process.env.SUPABASE_AUTH_TOKEN,
        })

        const [, request] = fetchSpy.mock.calls[0]
        expect([...new Headers(request?.headers).entries()]).toEqual([
            ['authorization', 'Bearer lims.slice-4b-token'],
        ])
    })

    test('does not log HTML, token, response body, or credentials', async () => {
        const logSpies = (
            ['debug', 'error', 'info', 'log', 'warn'] as const
        ).map((method) => vi.spyOn(console, method).mockImplementation(() => {}))
        const html = '<html>patient-secret-html</html>'
        const responseBody = 'private gateway response body'
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createGatewayResponse({
                body: responseBody,
                contentType: 'text/plain',
                requestId: 'malformed private request id',
                status: 500,
            })
        )

        const failure = await captureFailure(convertHtmlToPdf(html))

        expectFailure(failure, {
            code: 'gateway_rejected',
            gatewayRequestId: null,
            statusCode: 500,
        })
        for (const logSpy of logSpies) {
            expect(logSpy).not.toHaveBeenCalled()
        }
        const exposedFailure = `${String(failure)} ${JSON.stringify(failure)}`
        for (const sensitiveValue of [
            html,
            'lims.slice-4b-token',
            responseBody,
            tokenFile,
        ]) {
            expect(exposedFailure).not.toContain(sensitiveValue)
        }
    })
})

import { readFile } from 'node:fs/promises'

const CONVERSION_PATH = '/v1/convert/html'
const GATEWAY_TIMEOUT_MS = 30_000
const PDF_CONTENT_TYPE_PATTERN = /^application\/pdf(?:\s*;|$)/i
const PDF_SIGNATURE = '%PDF-'
const REQUEST_ID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RESOURCE_HTTP_ERROR_STATUS_CODES = JSON.stringify(
    Array.from({ length: 200 }, (_, index) => index + 400)
)

export type PdfGatewayErrorCode =
    | 'configuration'
    | 'authentication'
    | 'timeout'
    | 'service_unavailable'
    | 'gateway_rejected'
    | 'invalid_response'

export interface PdfGatewayError extends Error {
    readonly name: 'PdfGatewayError'
    readonly code: PdfGatewayErrorCode
    readonly gatewayRequestId: string | null
    readonly statusCode: number | null
}

export type PdfGatewayConversionResult = {
    pdfBytes: Uint8Array
    gatewayRequestId: string | null
}

export async function convertHtmlToPdf(
    html: string
): Promise<PdfGatewayConversionResult> {
    const conversionUrl = readConversionUrl()
    const gatewayToken = await readGatewayToken()
    const form = createConversionForm(html)
    const abortController = new AbortController()
    const timeout = setTimeout(
        () => abortController.abort(),
        GATEWAY_TIMEOUT_MS
    )
    let gatewayRequestId: string | null = null
    let responseStatus: number | null = null

    try {
        const response = await fetch(conversionUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${gatewayToken}`,
            },
            body: form,
            redirect: 'error',
            signal: abortController.signal,
        })
        gatewayRequestId = sanitizeRequestId(
            response.headers.get('x-request-id')
        )
        responseStatus = response.status

        if (!response.ok) {
            throw createResponseFailure(
                response.status,
                gatewayRequestId
            )
        }

        const pdfBytes = new Uint8Array(await response.arrayBuffer())
        if (
            !PDF_CONTENT_TYPE_PATTERN.test(
                response.headers.get('content-type') ?? ''
            ) ||
            !hasPdfSignature(pdfBytes)
        ) {
            throw createGatewayError(
                'invalid_response',
                gatewayRequestId,
                response.status
            )
        }

        return {
            pdfBytes,
            gatewayRequestId,
        }
    } catch (error) {
        if (isPdfGatewayError(error)) {
            throw error
        }

        throw createGatewayError(
            abortController.signal.aborted
                ? 'timeout'
                : 'service_unavailable',
            gatewayRequestId,
            responseStatus
        )
    } finally {
        clearTimeout(timeout)
    }
}

function readConversionUrl(): string {
    const gatewayUrl = requireEnvironment('GOTENBERG_URL')

    try {
        return new URL(CONVERSION_PATH, gatewayUrl).toString()
    } catch {
        throw createGatewayError('configuration')
    }
}

async function readGatewayToken(): Promise<string> {
    const tokenFile = requireEnvironment('PDF_GATEWAY_TOKEN_FILE')

    try {
        const gatewayToken = (await readFile(tokenFile, 'utf8')).trim()
        if (!gatewayToken) {
            throw createGatewayError('configuration')
        }
        return gatewayToken
    } catch (error) {
        if (isPdfGatewayError(error)) {
            throw error
        }
        throw createGatewayError('configuration')
    }
}

function createConversionForm(html: string): FormData {
    const form = new FormData()

    form.append(
        'files',
        new Blob([html], { type: 'text/html' }),
        'index.html'
    )
    form.append('emulatedMediaType', 'print')
    form.append('printBackground', 'true')
    form.append('preferCssPageSize', 'true')
    form.append('skipNetworkIdleEvent', 'false')
    form.append('failOnResourceLoadingFailed', 'true')
    form.append(
        'failOnResourceHttpStatusCodes',
        RESOURCE_HTTP_ERROR_STATUS_CODES
    )

    return form
}

function hasPdfSignature(bytes: Uint8Array): boolean {
    if (bytes.length < PDF_SIGNATURE.length) {
        return false
    }

    return new TextDecoder()
        .decode(bytes.subarray(0, PDF_SIGNATURE.length))
        .startsWith(PDF_SIGNATURE)
}

function sanitizeRequestId(requestId: string | null): string | null {
    const candidate = requestId?.trim()
    return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : null
}

function requireEnvironment(name: string): string {
    const value = process.env[name]

    if (!value) {
        throw createGatewayError('configuration')
    }

    return value
}

function createResponseFailure(
    statusCode: number,
    gatewayRequestId: string | null
): PdfGatewayError {
    if (statusCode === 401 || statusCode === 403) {
        return createGatewayError(
            'authentication',
            gatewayRequestId,
            statusCode
        )
    }

    if (statusCode === 408 || statusCode === 504) {
        return createGatewayError('timeout', gatewayRequestId, statusCode)
    }

    if (statusCode === 502 || statusCode === 503) {
        return createGatewayError(
            'service_unavailable',
            gatewayRequestId,
            statusCode
        )
    }

    return createGatewayError(
        'gateway_rejected',
        gatewayRequestId,
        statusCode
    )
}

function createGatewayError(
    code: PdfGatewayErrorCode,
    gatewayRequestId: string | null = null,
    statusCode: number | null = null
): PdfGatewayError {
    const error = new Error(getGatewayErrorMessage(code)) as PdfGatewayError
    Object.defineProperties(error, {
        name: { value: 'PdfGatewayError' },
        code: { enumerable: true, value: code },
        gatewayRequestId: { enumerable: true, value: gatewayRequestId },
        statusCode: { enumerable: true, value: statusCode },
    })
    return error
}

function getGatewayErrorMessage(code: PdfGatewayErrorCode): string {
    switch (code) {
        case 'configuration':
            return 'PDF gateway configuration is unavailable'
        case 'authentication':
            return 'PDF gateway authentication failed'
        case 'timeout':
            return 'PDF gateway request timed out'
        case 'service_unavailable':
            return 'PDF gateway service is unavailable'
        case 'gateway_rejected':
            return 'PDF gateway rejected the conversion request'
        case 'invalid_response':
            return 'PDF gateway returned an invalid response'
    }
}

function isPdfGatewayError(error: unknown): error is PdfGatewayError {
    return error instanceof Error && error.name === 'PdfGatewayError'
}

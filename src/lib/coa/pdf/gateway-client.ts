import { readFile } from 'node:fs/promises'

const CONVERSION_PATH = '/v1/convert/html'
const PDF_CONTENT_TYPE_PATTERN = /^application\/pdf(?:\s*;|$)/i
const PDF_SIGNATURE = '%PDF-'
const REQUEST_ID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PdfGatewayConversionResult = {
    pdfBytes: Uint8Array
    gatewayRequestId: string | null
}

export async function convertHtmlToPdf(
    html: string
): Promise<PdfGatewayConversionResult> {
    const gatewayUrl = requireEnvironment('GOTENBERG_URL')
    const tokenFile = requireEnvironment('PDF_GATEWAY_TOKEN_FILE')
    const gatewayToken = (await readFile(tokenFile, 'utf8')).trim()
    const form = createConversionForm(html)

    const response = await fetch(
        new URL(CONVERSION_PATH, gatewayUrl).toString(),
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${gatewayToken}`,
            },
            body: form,
            redirect: 'error',
        }
    )
    const pdfBytes = new Uint8Array(await response.arrayBuffer())

    if (
        !response.ok ||
        !PDF_CONTENT_TYPE_PATTERN.test(
            response.headers.get('content-type') ?? ''
        ) ||
        !hasPdfSignature(pdfBytes)
    ) {
        throw new Error('PDF gateway returned an invalid PDF response')
    }

    return {
        pdfBytes,
        gatewayRequestId: sanitizeRequestId(
            response.headers.get('x-request-id')
        ),
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
    form.append('failOnResourceHttpStatusCodes', '[400,599]')

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
        throw new Error(`Missing required environment variable: ${name}`)
    }

    return value
}

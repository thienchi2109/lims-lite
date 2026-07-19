// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { convertHtmlToPdf } from './gateway-client'

let temporaryDirectory = ''
let originalGatewayUrl: string | undefined
let originalTokenFile: string | undefined

beforeEach(async () => {
    originalGatewayUrl = process.env.GOTENBERG_URL
    originalTokenFile = process.env.PDF_GATEWAY_TOKEN_FILE
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'coa-pdf-attempt-'))
    const tokenFile = join(temporaryDirectory, 'gateway-token')
    await writeFile(tokenFile, 'lims.single-attempt-token\n', 'utf8')

    process.env.GOTENBERG_URL =
        'http://pdf-gateway:8080/ignored-base-path'
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

function createResponse(options: {
    body?: BodyInit
    contentType?: string
    status: number
}): Response {
    return new Response(
        options.body ?? new TextEncoder().encode('%PDF-1.7 test'),
        {
            status: options.status,
            headers: {
                'content-type':
                    options.contentType ?? 'application/pdf',
            },
        }
    )
}

describe('convertHtmlToPdf single-attempt boundary', () => {
    test.each([
        [
            'rejected credential',
            createResponse({ status: 401 }),
        ],
        [
            'unavailable service',
            createResponse({ status: 503 }),
        ],
        [
            'gateway error',
            createResponse({ status: 500 }),
        ],
        [
            'non-PDF response',
            createResponse({
                body: '<html>not a PDF</html>',
                contentType: 'text/html',
                status: 200,
            }),
        ],
    ])('does not retry or fall back after %s', async (_label, response) => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(response)

        await expect(
            convertHtmlToPdf('<html>released</html>')
        ).rejects.toMatchObject({ name: 'PdfGatewayError' })

        expect(fetchSpy).toHaveBeenCalledTimes(1)
        expect(fetchSpy.mock.calls[0][0]).toBe(
            'http://pdf-gateway:8080/v1/convert/html'
        )
    })
})

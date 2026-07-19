// @vitest-environment node
/**
 * Locks resource limits, cancellation, and error behavior for the PDF gateway.
 */
import { request as createHttpRequest, type ServerResponse } from 'node:http'
import { afterEach, describe, expect, test } from 'vitest'
import {
  createClientPolicy,
  createValidConversionForm,
  startGatewayTestSystem,
  submitValidConversion,
  validGatewayToken,
} from './helpers/pdf-gateway-test-harness'

const systems: Array<Awaited<ReturnType<typeof startGatewayTestSystem>>> = []

afterEach(async () => {
  await Promise.all(systems.splice(0).map((system) => system.close()))
})

async function start(
  options: Parameters<typeof startGatewayTestSystem>[0] = {}
) {
  const system = await startGatewayTestSystem(options)
  systems.push(system)
  return system
}

describe('PDF gateway size and protocol limits', () => {
  test('rejects oversized request bodies before upstream conversion', async () => {
    const system = await start({
      policy: createClientPolicy({ maxRequestBytes: 512 }),
    })
    const form = createValidConversionForm()
    form.set(
      'files',
      new Blob(['x'.repeat(2_048)], { type: 'text/html' }),
      'index.html'
    )

    const response = await submitValidConversion(system.gatewayUrl, { form })

    expect(response.status).toBe(413)
    expect(system.upstreamRequests).toHaveLength(0)
  })

  test('rejects oversized upstream responses without returning partial PDFs', async () => {
    const system = await start({
      policy: createClientPolicy({ maxResponseBytes: 32 }),
      upstreamHandler: (_request, response) => {
        const oversizedPdf = Buffer.from(`%PDF-${'x'.repeat(100)}`)
        response.writeHead(200, {
          'content-length': String(oversizedPdf.length),
          'content-type': 'application/pdf',
        })
        response.end(oversizedPdf)
      },
    })

    const response = await submitValidConversion(system.gatewayUrl)

    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({
      error: 'upstream_response_too_large',
    })
  })

  test('rejects excessive HTTP and multipart headers', async () => {
    const system = await start()
    const oversizedHeader = await submitValidConversion(system.gatewayUrl, {
      headers: { 'x-padding': 'x'.repeat(9_000) },
    })

    const boundary = 'test-boundary'
    const oversizedPartHeader = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="files"; filename="index.html"`,
      `X-Padding: ${'x'.repeat(2_100)}`,
      'Content-Type: text/html',
      '',
      '<html></html>',
      `--${boundary}--`,
      '',
    ].join('\r\n')
    const partHeaderResponse = await fetch(
      `${system.gatewayUrl}/v1/convert/html`,
      {
        body: oversizedPartHeader,
        headers: {
          authorization: `Bearer ${validGatewayToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        method: 'POST',
      }
    )

    expect([oversizedHeader.status, partHeaderResponse.status]).toEqual([
      431, 400,
    ])
    expect(system.upstreamRequests).toHaveLength(0)
  })
})

describe('PDF gateway rate, queue, and timeout limits', () => {
  test('applies rate limits per client', async () => {
    const system = await start({
      policy: createClientPolicy({ burst: 1, requestsPerMinute: 1 }),
    })

    const first = await submitValidConversion(system.gatewayUrl)
    const second = await submitValidConversion(system.gatewayUrl)

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
    expect(system.upstreamRequests).toHaveLength(1)
  })

  test('bounds concurrency and queue depth and releases queued work', async () => {
    const releases: Array<() => void> = []
    const system = await start({
      policy: createClientPolicy({
        maxConcurrent: 1,
        maxQueue: 1,
        timeoutMs: 5_000,
      }),
      upstreamHandler: async (_request, response) => {
        await new Promise<void>((resolve) => releases.push(resolve))
        writePdf(response)
      },
    })

    const firstPromise = submitValidConversion(system.gatewayUrl)
    await waitFor(() => system.upstreamRequests.length === 1)
    const secondPromise = submitValidConversion(system.gatewayUrl)
    await new Promise((resolve) => setTimeout(resolve, 25))
    const third = await submitValidConversion(system.gatewayUrl)

    expect(third.status).toBe(429)
    releases.shift()?.()
    expect((await firstPromise).status).toBe(200)
    await waitFor(() => system.upstreamRequests.length === 2)
    releases.shift()?.()
    expect((await secondPromise).status).toBe(200)
  })

  test('times out upstream work and releases the concurrency slot', async () => {
    let requestCount = 0
    const system = await start({
      policy: createClientPolicy({
        maxConcurrent: 1,
        maxQueue: 0,
        timeoutMs: 100,
      }),
      upstreamHandler: async (_request, response) => {
        requestCount += 1
        if (requestCount === 1) {
          await new Promise((resolve) => setTimeout(resolve, 250))
        }
        if (!response.destroyed) {
          writePdf(response)
        }
      },
    })

    const timedOut = await submitValidConversion(system.gatewayUrl)
    const afterTimeout = await submitValidConversion(system.gatewayUrl)

    expect(timedOut.status).toBe(504)
    expect(afterTimeout.status).toBe(200)
  })

  test('aborts slow uploads and releases the concurrency slot', async () => {
    const system = await start({
      policy: createClientPolicy({
        maxConcurrent: 1,
        maxQueue: 0,
        timeoutMs: 100,
      }),
    })

    await startSlowUploadAndDisconnect(system.gatewayUrl)
    const response = await submitValidConversion(system.gatewayUrl)

    expect(response.status).toBe(200)
  })

  test('maps upstream connection failures to a bounded gateway error', async () => {
    const system = await start({
      gatewayUpstreamUrl: 'http://127.0.0.1:1',
    })
    const response = await submitValidConversion(system.gatewayUrl)

    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({
      error: 'upstream_unavailable',
    })
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/i)
  })
})

function writePdf(response: ServerResponse) {
  const pdf = Buffer.from('%PDF-1.7 test')
  response.writeHead(200, {
    'content-length': String(pdf.length),
    'content-type': 'application/pdf',
  })
  response.end(pdf)
}

async function waitFor(predicate: () => boolean) {
  const deadline = Date.now() + 1_000
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for test condition')
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

function startSlowUploadAndDisconnect(gatewayUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL('/v1/convert/html', gatewayUrl)
    const request = createHttpRequest({
      headers: {
        authorization: `Bearer ${validGatewayToken}`,
        'content-type': 'multipart/form-data; boundary=slow-upload',
        'transfer-encoding': 'chunked',
      },
      hostname: url.hostname,
      method: 'POST',
      path: url.pathname,
      port: url.port,
    })

    request.once('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ECONNRESET') {
        resolve()
        return
      }
      reject(error)
    })
    request.write('--slow-upload\r\n')
    setTimeout(() => request.destroy(), 150)
    setTimeout(resolve, 225)
  })
}

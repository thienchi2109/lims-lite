// @vitest-environment node
/**
 * Locks the PDF gateway authentication, request contract, and audit boundary.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import {
  createClientPolicy,
  createValidConversionForm,
  startGatewayTestSystem,
  submitValidConversion,
  validGatewayToken,
} from './helpers/pdf-gateway-test-harness'
import { repositoryRoot } from './helpers/compose-config'
import { validateClientPolicy } from '../ops/pdf-gateway/gateway.mjs'

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

describe('PDF gateway policy and authentication', () => {
  test('fails closed for malformed client policies and unsafe limits', () => {
    const validClient = createClientPolicy().clients[0]

    expect(() => validateClientPolicy({ version: 1, clients: [] })).toThrow()
    expect(() =>
      validateClientPolicy({
        version: 1,
        clients: [validClient, { ...validClient }],
      })
    ).toThrow(/duplicate/i)
    expect(() =>
      validateClientPolicy({
        version: 1,
        clients: [{ ...validClient, credentialSha256: 'not-a-digest' }],
      })
    ).toThrow(/credentialSha256/i)
    expect(() =>
      validateClientPolicy({
        version: 1,
        clients: [{ ...validClient, maxConcurrent: 0 }],
      })
    ).toThrow(/maxConcurrent/i)
    expect(() =>
      validateClientPolicy({
        version: 1,
        clients: [{ ...validClient, timeoutMs: 600_001 }],
      })
    ).toThrow(/timeoutMs/i)
    expect(() =>
      validateClientPolicy({
        version: 1,
        clients: [
          {
            ...validClient,
            maxConcurrent: 8,
            maxRequestBytes: 16 * 1024 * 1024,
            maxResponseBytes: 32 * 1024 * 1024,
          },
        ],
      })
    ).toThrow(/buffer budget/i)
  })

  test('rejects missing, weak, and mismatched credentials before upstream', async () => {
    const system = await start()

    const missing = await fetch(`${system.gatewayUrl}/v1/convert/html`, {
      body: createValidConversionForm(),
      method: 'POST',
    })
    const weak = await submitValidConversion(system.gatewayUrl, {
      token: 'lims.short',
    })
    const mismatched = await submitValidConversion(system.gatewayUrl, {
      token: `lims.${Buffer.alloc(32, 9).toString('base64url')}`,
    })

    expect([missing.status, weak.status, mismatched.status]).toEqual([
      401, 401, 401,
    ])
    expect(system.upstreamRequests).toHaveLength(0)
  })

  test('authenticates by digest and forwards only the fixed upstream contract', async () => {
    const system = await start()

    const response = await submitValidConversion(system.gatewayUrl, {
      headers: {
        cookie: 'session=must-not-forward',
        'gotenberg-webhook-url': 'http://attacker.invalid',
        'proxy-authorization': 'Basic must-not-forward',
      },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('x-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/i
    )
    expect(system.upstreamRequests).toHaveLength(1)

    const upstream = system.upstreamRequests[0]
    expect(upstream.method).toBe('POST')
    expect(upstream.url).toBe('/forms/chromium/convert/html')
    expect(upstream.headers.authorization).toBeUndefined()
    expect(upstream.headers.cookie).toBeUndefined()
    expect(upstream.headers['proxy-authorization']).toBeUndefined()
    expect(upstream.headers['gotenberg-webhook-url']).toBeUndefined()
  })

  test('rejects upstream redirects instead of following them', async () => {
    const system = await start({
      upstreamHandler: (request, response) => {
        if (request.url === '/forms/chromium/convert/html') {
          response.writeHead(302, { location: '/redirect-target' })
          response.end()
          return
        }

        const pdf = Buffer.from('%PDF-1.7 redirected')
        response.writeHead(200, {
          'content-length': String(pdf.length),
          'content-type': 'application/pdf',
        })
        response.end(pdf)
      },
    })

    const response = await submitValidConversion(system.gatewayUrl)

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'upstream_unavailable' })
    expect(system.upstreamRequests).toHaveLength(1)
  })
})

describe('PDF gateway route and multipart allow-list', () => {
  test('uses a bounded multipart delimiter scanner', () => {
    const source = readFileSync(
      resolve(repositoryRoot, 'ops/pdf-gateway/multipart.mjs'),
      'utf8'
    )

    expect(source).toContain('MAX_MULTIPART_DELIMITERS')
    expect(source).not.toContain('.split(delimiter)')
  })

  test.each([
    ['GET', '/v1/convert/html', 405],
    ['POST', '/forms/chromium/convert/html', 404],
    ['POST', '/v1/convert/html?token=leak', 400],
    ['POST', '/healthz', 404],
  ])('rejects %s %s without contacting upstream', async (method, path, status) => {
    const system = await start()
    const response = await fetch(`${system.gatewayUrl}${path}`, { method })

    expect(response.status).toBe(status)
    expect(system.upstreamRequests).toHaveLength(0)
  })

  test.each([
    ['unknown field', (form: FormData) => form.append('cookies', '[]')],
    [
      'duplicate field',
      (form: FormData) => form.append('printBackground', 'true'),
    ],
    [
      'wrong fixed value',
      (form: FormData) => form.set('emulatedMediaType', 'screen'),
    ],
    ['missing field', (form: FormData) => form.delete('preferCssPageSize')],
    [
      'wrong filename',
      (form: FormData) =>
        form.set(
          'files',
          new Blob(['<html></html>'], { type: 'text/html' }),
          'other.html'
        ),
    ],
  ])('rejects multipart requests with %s', async (_name, mutate) => {
    const system = await start()
    const form = createValidConversionForm()
    mutate(form)

    const response = await submitValidConversion(system.gatewayUrl, { form })

    expect(response.status).toBe(400)
    expect(system.upstreamRequests).toHaveLength(0)
  })
})

describe('PDF gateway audit boundary', () => {
  test('logs sanitized metadata without credentials or document content', async () => {
    const system = await start()

    await submitValidConversion(system.gatewayUrl)
    await submitValidConversion(system.gatewayUrl, {
      token: `lims.${Buffer.alloc(32, 4).toString('base64url')}`,
    })

    expect(system.auditLines).toHaveLength(2)
    const auditText = system.auditLines.join('\n')
    const validDigest = createHash('sha256')
      .update(validGatewayToken)
      .digest('hex')

    expect(auditText).not.toContain(validGatewayToken)
    expect(auditText).not.toContain(validDigest)
    expect(auditText).not.toContain('CoA test document')
    expect(auditText).not.toContain('index.html')
    expect(auditText).not.toContain('authorization')

    const successEvent = JSON.parse(system.auditLines[0])
    expect(successEvent).toMatchObject({
      clientId: 'lims',
      method: 'POST',
      outcome: 'success',
      route: 'convert-html',
      status: 200,
    })
    expect(successEvent.requestId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(successEvent).toHaveProperty('durationMs')
    expect(successEvent).toHaveProperty('requestBytes')
    expect(successEvent).toHaveProperty('responseBytes')
    expect(Object.keys(successEvent)).not.toContain('url')
  })
})

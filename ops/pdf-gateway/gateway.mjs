/**
 * Implements the private authenticated PDF gateway HTTP boundary. It validates
 * requests, applies per-client limits, proxies one fixed Gotenberg route, and
 * emits metadata-only audit records.
 */
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import {
  ClientDisconnectedError,
  GatewayHttpError,
  GatewayTimeoutError,
  mapGatewayError,
  readIncomingBody,
  readUpstreamBody,
  sanitizeIp,
  sanitizeMethod,
  sendJsonError,
  writeAuditLine,
} from './http-boundary.mjs'
import { ClientLimiter } from './limiter.mjs'
import { validateMultipartContract } from './multipart.mjs'
import {
  authenticateClient,
  validateClientPolicy,
} from './policy.mjs'

const ALLOWED_PATH = '/v1/convert/html'
const MAX_HEADER_BYTES = 8_192

export { validateClientPolicy } from './policy.mjs'

export function createPdfGatewayServer({
  auditWriter = console.log,
  clientPolicy,
  fetchImplementation = fetch,
  now = Date.now,
  upstreamUrl,
}) {
  const clients = validateClientPolicy(clientPolicy)
  const limiters = new Map(
    [...clients].map(([id, client]) => [id, new ClientLimiter(client, now)])
  )
  const upstreamEndpoint = createUpstreamEndpoint(upstreamUrl)

  const server = createServer(
    {
      headersTimeout: 5_000,
      keepAliveTimeout: 5_000,
      maxHeaderSize: MAX_HEADER_BYTES,
      requestTimeout: 60_000,
    },
    (request, response) => {
      handleRequest({
        auditWriter,
        clients,
        fetchImplementation,
        limiters,
        now,
        request,
        response,
        upstreamEndpoint,
      })
    }
  )

  server.on('clientError', (error, socket) => {
    const status = error.code === 'HPE_HEADER_OVERFLOW' ? 431 : 400
    socket.end(
      `HTTP/1.1 ${status} Request Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`
    )
  })

  return server
}

async function handleRequest(context) {
  const { auditWriter, clients, limiters, now, request, response } = context
  const startedAt = now()
  const requestId = randomUUID()
  const audit = {
    clientId: null,
    durationMs: 0,
    method: sanitizeMethod(request.method),
    outcome: 'internal_error',
    requestBytes: 0,
    requestId,
    responseBytes: 0,
    route: 'unmatched',
    sourceIp: sanitizeIp(request.socket.remoteAddress),
    status: 500,
    timestamp: new Date().toISOString(),
  }

  response.setHeader('x-request-id', requestId)

  try {
    const requestUrl = new URL(request.url ?? '/', 'http://pdf-gateway')
    audit.route =
      requestUrl.pathname === ALLOWED_PATH ? 'convert-html' : 'unmatched'

    if (requestUrl.search) {
      throw new GatewayHttpError(400, 'query_not_allowed')
    }
    if (requestUrl.pathname !== ALLOWED_PATH) {
      throw new GatewayHttpError(404, 'route_not_found')
    }
    if (request.method !== 'POST') {
      throw new GatewayHttpError(405, 'method_not_allowed')
    }

    const client = authenticateClient(clients, request.headers.authorization)
    if (!client) {
      throw new GatewayHttpError(401, 'invalid_credential')
    }
    audit.clientId = client.id

    const limiter = limiters.get(client.id)
    if (!limiter.consumeRateToken()) {
      throw new GatewayHttpError(429, 'rate_limited')
    }

    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(new GatewayTimeoutError()),
      client.timeoutMs
    )
    const handleDisconnect = () => {
      if (!response.writableEnded) {
        controller.abort(new ClientDisconnectedError())
      }
    }
    request.once('aborted', handleDisconnect)
    response.once('close', handleDisconnect)

    let releaseSlot
    try {
      releaseSlot = await limiter.acquire(controller.signal)
      const body = await readIncomingBody(
        request,
        client.maxRequestBytes,
        controller.signal
      )
      audit.requestBytes = body.length
      validateMultipartContract(body, request.headers['content-type'])

      const upstreamResponse = await context.fetchImplementation(
        context.upstreamEndpoint,
        {
          body,
          headers: {
            'content-length': String(body.length),
            'content-type': request.headers['content-type'],
            'x-request-id': requestId,
          },
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
        }
      )

      if (
        !upstreamResponse.ok ||
        !/^application\/pdf(?:\s*;|$)/i.test(
          upstreamResponse.headers.get('content-type') ?? ''
        )
      ) {
        await upstreamResponse.body?.cancel()
        throw new GatewayHttpError(502, 'upstream_invalid_response')
      }

      const responseBody = await readUpstreamBody(
        upstreamResponse,
        client.maxResponseBytes,
        controller.signal
      )
      audit.responseBytes = responseBody.length
      audit.status = upstreamResponse.status
      audit.outcome = 'success'

      response.writeHead(upstreamResponse.status, {
        'cache-control': 'no-store',
        'content-length': String(responseBody.length),
        'content-type': 'application/pdf',
        'x-request-id': requestId,
      })
      response.end(responseBody)
    } finally {
      releaseSlot?.()
      clearTimeout(timeout)
      request.off('aborted', handleDisconnect)
      response.off('close', handleDisconnect)
    }
  } catch (error) {
    const mapped = mapGatewayError(error)
    audit.status = mapped.status
    audit.outcome = mapped.code

    if (!(error instanceof ClientDisconnectedError)) {
      sendJsonError(response, mapped.status, mapped.code, requestId)
    }
  } finally {
    audit.durationMs = Math.max(0, now() - startedAt)
    writeAuditLine(auditWriter, audit)
  }
}

function createUpstreamEndpoint(upstreamUrl) {
  const endpoint = new URL('/forms/chromium/convert/html', upstreamUrl)
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('Gotenberg upstream URL must use HTTP or HTTPS')
  }
  if (endpoint.username || endpoint.password) {
    throw new Error('Gotenberg upstream URL cannot contain credentials')
  }
  endpoint.search = ''
  endpoint.hash = ''
  return endpoint
}

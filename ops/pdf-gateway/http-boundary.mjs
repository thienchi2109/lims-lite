/**
 * Bounds gateway HTTP bodies and maps transport failures to safe responses and
 * metadata-only audit values.
 */
import { QueueFullError } from './limiter.mjs'
import { MultipartContractError } from './multipart.mjs'

export function readIncomingBody(request, maxBytes, signal) {
  const declaredLength = parseContentLength(request.headers['content-length'])
  if (declaredLength !== null && declaredLength > maxBytes) {
    throw new GatewayHttpError(413, 'request_too_large')
  }

  return new Promise((resolve, reject) => {
    const chunks = []
    let totalBytes = 0

    const cleanup = () => {
      request.off('data', handleData)
      request.off('end', handleEnd)
      request.off('error', handleError)
      request.off('aborted', handleAborted)
      signal.removeEventListener('abort', handleSignalAbort)
    }
    const fail = (error) => {
      cleanup()
      request.pause()
      reject(error)
    }
    const handleData = (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      totalBytes += buffer.length
      if (totalBytes > maxBytes) {
        fail(new GatewayHttpError(413, 'request_too_large'))
        return
      }
      chunks.push(buffer)
    }
    const handleEnd = () => {
      cleanup()
      resolve(Buffer.concat(chunks, totalBytes))
    }
    const handleError = () => fail(new GatewayHttpError(400, 'request_error'))
    const handleAborted = () => fail(new ClientDisconnectedError())
    const handleSignalAbort = () => fail(signal.reason)

    request.on('data', handleData)
    request.once('end', handleEnd)
    request.once('error', handleError)
    request.once('aborted', handleAborted)
    signal.addEventListener('abort', handleSignalAbort, { once: true })
  })
}

export async function readUpstreamBody(upstreamResponse, maxBytes, signal) {
  const declaredLength = parseContentLength(
    upstreamResponse.headers.get('content-length')
  )
  if (declaredLength !== null && declaredLength > maxBytes) {
    await upstreamResponse.body?.cancel()
    throw new GatewayHttpError(502, 'upstream_response_too_large')
  }

  if (!upstreamResponse.body) {
    return Buffer.alloc(0)
  }

  const reader = upstreamResponse.body.getReader()
  const chunks = []
  let totalBytes = 0

  try {
    while (true) {
      if (signal.aborted) {
        throw signal.reason
      }
      const { done, value } = await reader.read()
      if (done) {
        return Buffer.concat(chunks, totalBytes)
      }

      const chunk = Buffer.from(value)
      totalBytes += chunk.length
      if (totalBytes > maxBytes) {
        throw new GatewayHttpError(502, 'upstream_response_too_large')
      }
      chunks.push(chunk)
    }
  } finally {
    if (totalBytes > maxBytes || signal.aborted) {
      await reader.cancel().catch(() => {})
    }
    reader.releaseLock()
  }
}

export function mapGatewayError(error) {
  if (error instanceof GatewayHttpError) {
    return error
  }
  if (error instanceof MultipartContractError) {
    return new GatewayHttpError(400, 'invalid_multipart_contract')
  }
  if (error instanceof QueueFullError) {
    return new GatewayHttpError(429, 'queue_full')
  }
  if (error instanceof GatewayTimeoutError) {
    return new GatewayHttpError(504, 'request_timeout')
  }
  if (error instanceof ClientDisconnectedError) {
    return new GatewayHttpError(499, 'client_disconnected')
  }
  if (error instanceof TypeError) {
    return new GatewayHttpError(502, 'upstream_unavailable')
  }
  return new GatewayHttpError(500, 'internal_error')
}

export function sendJsonError(response, status, code, requestId) {
  if (response.headersSent || response.destroyed) {
    response.destroy()
    return
  }

  const body = Buffer.from(JSON.stringify({ error: code }))
  response.writeHead(status, {
    'cache-control': 'no-store',
    connection: 'close',
    'content-length': String(body.length),
    'content-type': 'application/json',
    'x-request-id': requestId,
  })
  response.end(body)
}

export function writeAuditLine(auditWriter, audit) {
  try {
    auditWriter(JSON.stringify(audit))
  } catch {
    // Audit transport failures must not expose request data or crash the gateway.
  }
}

export function sanitizeMethod(method) {
  return typeof method === 'string' && /^[A-Z]{1,16}$/.test(method)
    ? method
    : 'UNKNOWN'
}

export function sanitizeIp(address) {
  return typeof address === 'string' && /^[0-9a-f:.]{1,64}$/i.test(address)
    ? address
    : 'unknown'
}

function parseContentLength(value) {
  if (value === undefined || value === null) {
    return null
  }
  if (Array.isArray(value) || !/^\d+$/.test(value)) {
    throw new GatewayHttpError(400, 'invalid_content_length')
  }
  const length = Number(value)
  if (!Number.isSafeInteger(length)) {
    throw new GatewayHttpError(400, 'invalid_content_length')
  }
  return length
}

export class GatewayHttpError extends Error {
  constructor(status, code) {
    super(code)
    this.name = 'GatewayHttpError'
    this.status = status
    this.code = code
  }
}

export class GatewayTimeoutError extends Error {
  constructor() {
    super('Gateway request deadline exceeded')
    this.name = 'GatewayTimeoutError'
  }
}

export class ClientDisconnectedError extends Error {
  constructor() {
    super('Gateway client disconnected')
    this.name = 'ClientDisconnectedError'
  }
}

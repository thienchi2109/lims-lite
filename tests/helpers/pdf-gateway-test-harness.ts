/**
 * Starts real HTTP servers for PDF gateway tests and builds the fixed LIMS
 * multipart conversion contract.
 */
import { createHash } from 'node:crypto'
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import type { AddressInfo } from 'node:net'
import { createPdfGatewayServer } from '../../ops/pdf-gateway/gateway.mjs'

export const validGatewayToken = `lims.${Buffer.alloc(32, 7).toString(
  'base64url'
)}`

export interface ClientPolicy {
  version: 1
  clients: Array<{
    id: string
    credentialSha256: string
    maxRequestBytes: number
    maxResponseBytes: number
    timeoutMs: number
    requestsPerMinute: number
    burst: number
    maxConcurrent: number
    maxQueue: number
  }>
}

export interface CapturedUpstreamRequest {
  body: Buffer
  headers: IncomingMessage['headers']
  method: string | undefined
  url: string | undefined
}

type UpstreamHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  captured: CapturedUpstreamRequest
) => Promise<void> | void

export function createClientPolicy(
  overrides: Partial<ClientPolicy['clients'][number]> = {}
): ClientPolicy {
  return {
    version: 1,
    clients: [
      {
        id: 'lims',
        credentialSha256: createHash('sha256')
          .update(validGatewayToken)
          .digest('hex'),
        maxRequestBytes: 64 * 1024,
        maxResponseBytes: 128 * 1024,
        timeoutMs: 1_000,
        requestsPerMinute: 60,
        burst: 10,
        maxConcurrent: 2,
        maxQueue: 2,
        ...overrides,
      },
    ],
  }
}

export function createValidConversionForm(): FormData {
  const form = new FormData()
  form.append(
    'files',
    new Blob(['<html><body>CoA test document</body></html>'], {
      type: 'text/html',
    }),
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

export async function startGatewayTestSystem(options: {
  gatewayUpstreamUrl?: string
  policy?: ClientPolicy
  upstreamHandler?: UpstreamHandler
}) {
  const upstreamRequests: CapturedUpstreamRequest[] = []
  const auditLines: string[] = []

  const upstreamServer = createHttpServer(async (request, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    const captured = {
      body: Buffer.concat(chunks),
      headers: request.headers,
      method: request.method,
      url: request.url,
    }
    upstreamRequests.push(captured)

    if (options.upstreamHandler) {
      await options.upstreamHandler(request, response, captured)
      return
    }

    const pdf = Buffer.from('%PDF-1.7 test')
    response.writeHead(200, {
      'content-length': String(pdf.length),
      'content-type': 'application/pdf',
    })
    response.end(pdf)
  })

  const upstreamUrl = await listen(upstreamServer)
  const gatewayServer = createPdfGatewayServer({
    auditWriter: (line: string) => auditLines.push(line),
    clientPolicy: options.policy ?? createClientPolicy(),
    upstreamUrl: options.gatewayUpstreamUrl ?? upstreamUrl,
  })
  const gatewayUrl = await listen(gatewayServer)

  return {
    auditLines,
    gatewayUrl,
    upstreamRequests,
    async close() {
      await Promise.all([closeServer(gatewayServer), closeServer(upstreamServer)])
    },
  }
}

export async function submitValidConversion(
  gatewayUrl: string,
  options: {
    form?: FormData
    headers?: HeadersInit
    token?: string
  } = {}
) {
  return fetch(`${gatewayUrl}/v1/convert/html`, {
    body: options.form ?? createValidConversionForm(),
    headers: {
      authorization: `Bearer ${options.token ?? validGatewayToken}`,
      ...options.headers,
    },
    method: 'POST',
  })
}

function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      const address = server.address() as AddressInfo
      resolve(`http://127.0.0.1:${address.port}`)
    })
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
    server.closeAllConnections()
  })
}

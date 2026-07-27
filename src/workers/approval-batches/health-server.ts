/**
 * Internal-only liveness, readiness, and Prometheus metrics endpoints.
 */
import { createServer } from 'node:http'
import type { Server, ServerResponse } from 'node:http'
import { ApprovalBatchWorkerMetrics } from './metrics'

interface HealthServerOptions {
  host: string
  metrics: ApprovalBatchWorkerMetrics
  port: number
}

export function startApprovalBatchWorkerHealthServer({
  host,
  metrics,
  port,
}: HealthServerOptions): Server {
  const server = createServer((request, response) => {
    if (request.method !== 'GET') {
      sendJson(response, 405, { status: 'method_not_allowed' })
      return
    }
    if (request.url === '/live') {
      sendJson(response, 200, { status: 'live' })
      return
    }
    if (request.url === '/ready') {
      const databaseReady = metrics.isDatabaseReady()
      sendJson(response, databaseReady ? 200 : 503, {
        databaseReady,
        status: databaseReady ? 'ready' : 'not_ready',
      })
      return
    }
    if (request.url === '/metrics') {
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': 'text/plain; version=0.0.4; charset=utf-8',
      })
      response.end(metrics.toPrometheus())
      return
    }
    sendJson(response, 404, { status: 'not_found' })
  })

  server.listen(port, host)
  return server
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: Record<string, boolean | string>
) {
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(body))
}

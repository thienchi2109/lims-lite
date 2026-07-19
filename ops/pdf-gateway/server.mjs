/**
 * Loads the secret-backed client policy and starts the private PDF gateway.
 */
import { readFileSync } from 'node:fs'
import { createPdfGatewayServer } from './gateway.mjs'

const policyFile = requiredEnvironment('PDF_GATEWAY_CLIENT_POLICY_FILE')
const upstreamUrl = requiredEnvironment('GOTENBERG_URL')
const port = parsePort(process.env.PORT ?? '8080')
const clientPolicy = JSON.parse(readFileSync(policyFile, 'utf8'))

const server = createPdfGatewayServer({
  clientPolicy,
  upstreamUrl,
})

server.listen(port, '0.0.0.0', () => {
  console.log(
    JSON.stringify({
      event: 'pdf_gateway_started',
      port,
      timestamp: new Date().toISOString(),
    })
  )
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 10_000).unref()
  })
}

function requiredEnvironment(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

function parsePort(value) {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer from 1 to 65535')
  }
  return port
}

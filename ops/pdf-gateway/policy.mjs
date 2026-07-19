/**
 * Validates client policy and authenticates secret-backed bearer credentials.
 * Policy objects contain credential digests only, never plaintext tokens.
 */
import { createHash, timingSafeEqual } from 'node:crypto'

const CLIENT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,31}$/
const DIGEST_PATTERN = /^[0-9a-f]{64}$/i
const DUMMY_DIGEST = Buffer.alloc(32)
const MAX_TOTAL_BUFFERED_BYTES = 128 * 1024 * 1024

const LIMIT_BOUNDS = {
  burst: { max: 100, min: 1 },
  maxConcurrent: { max: 8, min: 1 },
  maxQueue: { max: 16, min: 0 },
  maxRequestBytes: { max: 16 * 1024 * 1024, min: 1 },
  maxResponseBytes: { max: 32 * 1024 * 1024, min: 1 },
  requestsPerMinute: { max: 600, min: 1 },
  timeoutMs: { max: 60_000, min: 50 },
}

export function validateClientPolicy(input) {
  if (!isRecord(input) || input.version !== 1) {
    throw new Error('Client policy version must be 1')
  }

  if (!Array.isArray(input.clients) || input.clients.length === 0) {
    throw new Error('Client policy must contain at least one client')
  }

  if (input.clients.length > 16) {
    throw new Error('Client policy cannot contain more than 16 clients')
  }

  const clients = new Map()
  let totalBufferedBytes = 0

  for (const rawClient of input.clients) {
    if (!isRecord(rawClient)) {
      throw new Error('Each client policy entry must be an object')
    }

    const id = rawClient.id
    if (typeof id !== 'string' || !CLIENT_ID_PATTERN.test(id)) {
      throw new Error('Client id must match the required format')
    }
    if (clients.has(id)) {
      throw new Error(`Duplicate client id: ${id}`)
    }

    const credentialSha256 = rawClient.credentialSha256
    if (
      typeof credentialSha256 !== 'string' ||
      !DIGEST_PATTERN.test(credentialSha256)
    ) {
      throw new Error(`Invalid credentialSha256 for client ${id}`)
    }

    const normalized = {
      id,
      credentialDigest: Buffer.from(credentialSha256, 'hex'),
    }

    for (const [name, bounds] of Object.entries(LIMIT_BOUNDS)) {
      const value = rawClient[name]
      if (
        !Number.isInteger(value) ||
        value < bounds.min ||
        value > bounds.max
      ) {
        throw new Error(
          `${name} for client ${id} must be an integer from ${bounds.min} to ${bounds.max}`
        )
      }
      normalized[name] = value
    }

    if (normalized.burst > normalized.requestsPerMinute) {
      throw new Error(`burst cannot exceed requestsPerMinute for client ${id}`)
    }

    totalBufferedBytes +=
      (normalized.maxRequestBytes + normalized.maxResponseBytes) *
      normalized.maxConcurrent
    if (totalBufferedBytes > MAX_TOTAL_BUFFERED_BYTES) {
      throw new Error('Client policy exceeds the global buffer budget')
    }

    clients.set(id, Object.freeze(normalized))
  }

  return clients
}

export function authenticateClient(clients, authorizationHeader) {
  const credential = parseBearerCredential(authorizationHeader)
  if (!credential) {
    return null
  }

  const client = clients.get(credential.clientId)
  const candidateDigest = createHash('sha256')
    .update(credential.token)
    .digest()
  const expectedDigest = client?.credentialDigest ?? DUMMY_DIGEST
  const matches = timingSafeEqual(candidateDigest, expectedDigest)

  return matches && client ? client : null
}

function parseBearerCredential(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') {
    return null
  }

  const match = /^Bearer ([^\s]+)$/.exec(authorizationHeader)
  if (!match) {
    return null
  }

  const token = match[1]
  const separatorIndex = token.indexOf('.')
  if (separatorIndex <= 0 || separatorIndex !== token.lastIndexOf('.')) {
    return null
  }

  const clientId = token.slice(0, separatorIndex)
  const secret = token.slice(separatorIndex + 1)
  if (!CLIENT_ID_PATTERN.test(clientId) || !/^[A-Za-z0-9_-]+$/.test(secret)) {
    return null
  }

  const decodedSecret = Buffer.from(secret, 'base64url')
  if (
    decodedSecret.length < 32 ||
    decodedSecret.toString('base64url') !== secret
  ) {
    return null
  }

  return { clientId, token }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

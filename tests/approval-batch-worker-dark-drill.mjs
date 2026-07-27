/**
 * Starts the compiled worker against an unavailable loopback database, verifies
 * liveness/readiness separation, sends SIGTERM, and repeats after restart.
 */
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const repositoryRoot = resolve(import.meta.dirname, '..')
const temporaryDirectory = await mkdtemp(
  join(tmpdir(), 'approval-worker-dark-drill-')
)
const passwordFile = join(temporaryDirectory, 'database-password')
await writeFile(passwordFile, 'dark-drill-placeholder\n', { mode: 0o600 })

try {
  await runLifecycle('first-start')
  await runLifecycle('restart')
  console.log('approval-batch-worker-dark-drill: ok')
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true })
}

async function runLifecycle(label) {
  const healthPort = await reservePort()
  const child = spawn(
    process.execPath,
    ['dist-worker/approval-batches/main.js'],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        APPROVAL_BATCH_WORKER_DATABASE_BACKOFF_MAX_MS: '100',
        APPROVAL_BATCH_WORKER_DATABASE_BACKOFF_MIN_MS: '50',
        APPROVAL_BATCH_WORKER_DATABASE_HOST: '127.0.0.1',
        APPROVAL_BATCH_WORKER_DATABASE_OPERATION_TIMEOUT_MS: '1000',
        APPROVAL_BATCH_WORKER_DATABASE_PASSWORD_FILE: passwordFile,
        APPROVAL_BATCH_WORKER_DATABASE_PORT: '1',
        APPROVAL_BATCH_WORKER_DRAIN_TIMEOUT_MS: '2000',
        APPROVAL_BATCH_WORKER_HEALTH_HOST: '127.0.0.1',
        APPROVAL_BATCH_WORKER_HEALTH_PORT: String(healthPort),
        APPROVAL_BATCH_WORKER_IDLE_POLL_INTERVAL_MS: '50',
        APPROVAL_BATCH_WORKER_INSTANCE_ID: `dark-drill-${label}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )
  let output = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    output += chunk
  })
  child.stderr.on('data', (chunk) => {
    output += chunk
  })

  try {
    const live = await waitForResponse(
      `http://127.0.0.1:${healthPort}/live`,
      200
    )
    const ready = await waitForResponse(
      `http://127.0.0.1:${healthPort}/ready`,
      503
    )
    assert((await live.json()).status === 'live', `${label}: invalid liveness`)
    assert(
      (await ready.json()).databaseReady === false,
      `${label}: readiness did not fail closed`
    )

    child.kill('SIGTERM')
    const [exitCode, signal] = await Promise.race([
      once(child, 'exit'),
      timeout(5_000, `${label}: worker did not exit after SIGTERM`),
    ])
    assert(signal === null, `${label}: worker exited through ${signal}`)
    assert(exitCode === 0, `${label}: worker exit code was ${exitCode}`)
    assert(
      !/dark-drill-placeholder|JWT|OTP|SERVICE_ROLE|ACCESS_TOKEN|REFRESH_TOKEN/.test(
        output
      ),
      `${label}: logs exposed credential material`
    )
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
      await once(child, 'exit')
    }
  }
}

async function reservePort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Could not reserve an ephemeral health port')
  }
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  return address.port
}

async function waitForResponse(url, expectedStatus) {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.status === expectedStatus) {
        return response
      }
    } catch {
      // The process may still be binding the health server.
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`${url} did not return ${expectedStatus}`)
}

function timeout(delayMs, message) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), delayMs)
  })
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

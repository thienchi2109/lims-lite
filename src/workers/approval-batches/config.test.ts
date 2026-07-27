import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { parseApprovalBatchWorkerConfig } from './config'

const temporaryDirectories: string[] = []

function createPasswordFile(password = 'worker-password') {
  const directory = mkdtempSync(join(tmpdir(), 'approval-worker-config-'))
  const passwordFile = join(directory, 'database-password')
  temporaryDirectories.push(directory)
  writeFileSync(passwordFile, `${password}\n`, { mode: 0o600 })
  return passwordFile
}

function validEnvironment() {
  return {
    APPROVAL_BATCH_WORKER_DATABASE_PASSWORD_FILE: createPasswordFile(),
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe('parseApprovalBatchWorkerConfig', () => {
  test('uses bounded production defaults without web session configuration', () => {
    const config = parseApprovalBatchWorkerConfig(validEnvironment())

    expect(config).toMatchObject({
      concurrency: 8,
      claimLeaseSeconds: 60,
      database: {
        database: 'postgres',
        host: 'postgres',
        password: 'worker-password',
        port: 5432,
        user: 'approval_batch_worker',
      },
      databaseOperationTimeoutMs: 10_000,
      drainTimeoutMs: 25_000,
      healthHost: '0.0.0.0',
      healthPort: 8081,
      idlePollIntervalMs: 1_000,
      poolMax: 8,
    })
    expect(JSON.stringify(config)).not.toMatch(
      /jwt|otp|access[_-]?token|refresh[_-]?token|service[_-]?role/i
    )
  })

  test.each(['0', '17', 'not-a-number'])(
    'rejects invalid concurrency %s',
    (concurrency) => {
      expect(() =>
        parseApprovalBatchWorkerConfig({
          ...validEnvironment(),
          APPROVAL_BATCH_WORKER_CONCURRENCY: concurrency,
        })
      ).toThrow(/concurrency/i)
    }
  )

  test('rejects inline database passwords and empty secret files', () => {
    expect(() =>
      parseApprovalBatchWorkerConfig({
        ...validEnvironment(),
        APPROVAL_BATCH_WORKER_DATABASE_PASSWORD: 'inline-secret',
      })
    ).toThrow(/password file/i)

    expect(() =>
      parseApprovalBatchWorkerConfig({
        APPROVAL_BATCH_WORKER_DATABASE_PASSWORD_FILE: createPasswordFile(''),
      })
    ).toThrow(/password file/i)
  })

  test('pins the dedicated worker login and validates operation bounds', () => {
    expect(() =>
      parseApprovalBatchWorkerConfig({
        ...validEnvironment(),
        APPROVAL_BATCH_WORKER_DATABASE_USER: 'postgres',
      })
    ).toThrow(/approval_batch_worker/)

    expect(() =>
      parseApprovalBatchWorkerConfig({
        ...validEnvironment(),
        APPROVAL_BATCH_WORKER_CLAIM_LEASE_SECONDS: '4',
      })
    ).toThrow(/lease/i)
  })

  test('keeps database deadlines inside the bounded drain window', () => {
    expect(() =>
      parseApprovalBatchWorkerConfig({
        ...validEnvironment(),
        APPROVAL_BATCH_WORKER_DATABASE_OPERATION_TIMEOUT_MS: '2000',
        APPROVAL_BATCH_WORKER_DRAIN_TIMEOUT_MS: '1000',
      })
    ).toThrow(/drain/i)

    expect(() =>
      parseApprovalBatchWorkerConfig({
        ...validEnvironment(),
        APPROVAL_BATCH_WORKER_DRAIN_TIMEOUT_MS: '26000',
      })
    ).toThrow(/drain/i)
  })
})

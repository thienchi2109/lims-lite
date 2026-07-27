/**
 * Locks the dark worker profile, protected credential, and container boundaries.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  loadComposeConfig,
  loadExampleEnvironment,
  repositoryRoot,
} from './helpers/compose-config'

const composeConfig = loadComposeConfig(['approval-batch-worker'])
const workerService = composeConfig.services['approval-batch-worker']
const composeSource = readFileSync(
  resolve(repositoryRoot, 'docker-compose.yml'),
  'utf8'
)

describe('approval batch worker Compose contract', () => {
  test('keeps the worker disabled unless its explicit profile is selected', () => {
    expect(workerService.profiles).toEqual(['approval-batch-worker'])
    expect(loadExampleEnvironment()).not.toHaveProperty('COMPOSE_PROFILES')
    expect(loadExampleEnvironment()).toMatchObject({
      BACKGROUND_BATCH_RESULT_APPROVAL_ENABLED: 'FALSE',
    })
    expect(composeSource).toContain(
      '${APPROVAL_BATCH_WORKER_DATABASE_PASSWORD_FILE:-/opt/lims-lite-secrets/approval-batch-worker-database-password}'
    )
  })

  test('uses the protected dedicated database credential without host ports', () => {
    expect(workerService.environment).toMatchObject({
      APPROVAL_BATCH_WORKER_DATABASE_HOST: 'postgres',
      APPROVAL_BATCH_WORKER_DATABASE_PASSWORD_FILE:
        '/run/secrets/approval_batch_worker_database_password',
      APPROVAL_BATCH_WORKER_DATABASE_USER: 'approval_batch_worker',
    })
    expect(workerService.secrets).toContainEqual({
      source: 'approval_batch_worker_database_password',
      target: 'approval_batch_worker_database_password',
    })
    expect(composeConfig.secrets).toMatchObject({
      approval_batch_worker_database_password: {
        file: '/opt/lims-lite-secrets/approval-batch-worker-database-password',
      },
    })
    expect(workerService.ports).toBeUndefined()
    expect(workerService.network_mode).not.toBe('host')
    expect(JSON.stringify(workerService.environment)).not.toMatch(
      /JWT|OTP|SERVICE_ROLE|ANON_KEY|PASSWORD=/
    )
  })

  test('bounds resources and exposes only an internal readiness health check', () => {
    expect(workerService).toMatchObject({
      cap_drop: ['ALL'],
      cpus: 0.5,
      init: true,
      mem_limit: '268435456',
      mem_reservation: '134217728',
      pids_limit: 64,
      read_only: true,
      restart: 'unless-stopped',
      security_opt: ['no-new-privileges:true'],
      stop_grace_period: '30s',
    })
    expect(workerService.healthcheck.test).toEqual([
      'CMD',
      'node',
      '-e',
      expect.stringMatching(/127\.0\.0\.1.*\/ready/),
    ])
    expect(workerService.depends_on.postgres.condition).toBe('service_healthy')
  })

  test('builds a dedicated non-root worker runtime', () => {
    const dockerfile = readFileSync(
      resolve(repositoryRoot, 'ops/approval-batch-worker/Dockerfile'),
      'utf8'
    )

    expect(workerService.build).toMatchObject({
      context: repositoryRoot,
      dockerfile: 'ops/approval-batch-worker/Dockerfile',
    })
    expect(dockerfile).toContain('npm run build:worker')
    expect(dockerfile).toMatch(/USER 10002:10002/)
    expect(dockerfile).toContain('CMD ["npm", "run", "start:worker"]')
  })
})

/**
 * Validates the private Gotenberg image and Compose contract for CoA PDF infrastructure.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadComposeConfig() {
  const environment = { ...process.env }
  const exampleEnvironment = loadExampleEnvironment()

  for (const variableName of Object.keys(environment)) {
    if (
      variableName.startsWith('COMPOSE_') ||
      Object.hasOwn(exampleEnvironment, variableName)
    ) {
      delete environment[variableName]
    }
  }

  const output = execFileSync(
    'docker',
    [
      'compose',
      '--file',
      'docker-compose.yml',
      '--env-file',
      '.env.example',
      'config',
      '--format',
      'json',
    ],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: environment,
    }
  )

  return JSON.parse(output)
}

function loadExampleEnvironment() {
  return Object.fromEntries(
    readFileSync(resolve(repositoryRoot, '.env.example'), 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=')
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)]
      })
  )
}

const composeConfig = loadComposeConfig()
const gotenbergService = composeConfig.services.gotenberg
const appService = composeConfig.services.app

describe('Gotenberg Compose infrastructure', () => {
  test('builds the custom pinned Gotenberg 8 image with Times New Roman', () => {
    const dockerfile = readFileSync(
      resolve(repositoryRoot, 'ops/gotenberg/Dockerfile'),
      'utf8'
    )

    expect(gotenbergService.build.context).toBe(
      resolve(repositoryRoot, 'ops/gotenberg')
    )
    expect(gotenbergService.build.dockerfile).toBe('Dockerfile')
    expect(dockerfile).toContain(
      'FROM gotenberg/gotenberg:8.34.0@sha256:67097317623a503ba2a6a7e9ae8db6929a1f7e1bbd88077bacf2d325fbdab923'
    )
    expect(dockerfile).toMatch(/USER root/)
    expect(dockerfile).toMatch(/DEBIAN_FRONTEND=noninteractive/)
    expect(dockerfile).toMatch(/trixie contrib non-free/)
    expect(dockerfile).toMatch(/msttcorefonts\/accepted-mscorefonts-eula/)
    expect(dockerfile).toMatch(
      /apt-get install[\s\S]*ttf-mscorefonts-installer/
    )
    expect(dockerfile).toContain('fc-match "Times New Roman"')
    expect(dockerfile.trimEnd()).toMatch(/USER gotenberg$/)
  })

  test('keeps Gotenberg private and optional for application startup', () => {
    expect(gotenbergService.ports).toBeUndefined()
    expect(gotenbergService.network_mode).not.toBe('host')
    expect(gotenbergService.networks).toEqual({ default: null })
    expect(appService.environment.GOTENBERG_URL).toBe(
      'http://gotenberg:3000'
    )
    expect(appService.depends_on).not.toHaveProperty('gotenberg')
    expect(composeConfig.services.nginx.depends_on).not.toHaveProperty(
      'gotenberg'
    )
  })

  test('defines health and resource boundaries for Chromium conversion', () => {
    expect(gotenbergService.restart).toBe('unless-stopped')
    expect(gotenbergService.healthcheck.test.join(' ')).toContain(
      'http://localhost:3000/health'
    )
    expect(gotenbergService.healthcheck).toMatchObject({
      interval: '30s',
      retries: 3,
      start_period: '10s',
      timeout: '5s',
    })
    expect(gotenbergService.mem_limit).toBe('2147483648')
    expect(gotenbergService.mem_reservation).toBe('1073741824')
    expect(gotenbergService.cpus).toBe(2)
    expect(gotenbergService.shm_size).toBe('268435456')
    expect(gotenbergService.stop_grace_period).toBe('30s')
  })

  test('denies private IPs without disabling Gotenberg network protections', () => {
    const dockerfile = readFileSync(
      resolve(repositoryRoot, 'ops/gotenberg/Dockerfile'),
      'utf8'
    )
    const forbiddenOverrides =
      /CHROMIUM_(?:PROXY_SERVER|HOST_RESOLVER_RULES|ALLOW_LIST)|--chromium-(?:proxy-server|host-resolver-rules|allow-list)/i

    expect(gotenbergService.environment).toMatchObject({
      API_TIMEOUT: '30s',
      CHROMIUM_DENY_PRIVATE_IPS: 'true',
    })
    expect(gotenbergService.environment).not.toHaveProperty(
      'CHROMIUM_PROXY_SERVER'
    )
    expect(gotenbergService.environment).not.toHaveProperty(
      'CHROMIUM_HOST_RESOLVER_RULES'
    )
    expect(gotenbergService.environment).not.toHaveProperty(
      'CHROMIUM_ALLOW_LIST'
    )
    expect(
      JSON.stringify({
        command: gotenbergService.command,
        entrypoint: gotenbergService.entrypoint,
      })
    ).not.toMatch(forbiddenOverrides)
    expect(dockerfile).not.toMatch(forbiddenOverrides)
  })

  test('documents the internal application service URL', () => {
    expect(loadExampleEnvironment().GOTENBERG_URL).toBe(
      'http://gotenberg:3000'
    )
  })
})

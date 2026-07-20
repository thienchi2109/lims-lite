/**
 * Validates the private Gotenberg image and Compose contract for CoA PDF infrastructure.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  loadComposeConfig,
  loadExampleEnvironment,
  repositoryRoot,
} from './helpers/compose-config'

type DockerfileInstruction = {
  arguments: string
  command: string
}

function parseDockerfileInstructions(
  dockerfile: string
): DockerfileInstruction[] {
  const logicalLines: string[] = []
  let currentInstruction = ''

  for (const rawLine of dockerfile.split(/\r?\n/)) {
    const trimmedLine = rawLine.trim()

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue
    }

    const continuesOnNextLine = trimmedLine.endsWith('\\')
    const instructionFragment = continuesOnNextLine
      ? trimmedLine.slice(0, -1).trimEnd()
      : trimmedLine

    currentInstruction = [currentInstruction, instructionFragment]
      .filter(Boolean)
      .join(' ')

    if (!continuesOnNextLine) {
      logicalLines.push(currentInstruction)
      currentInstruction = ''
    }
  }

  if (currentInstruction) {
    throw new Error('Dockerfile ends with an unfinished continuation')
  }

  return logicalLines.map((line) => {
    const instructionMatch = /^([a-z]+)\s+(.+)$/i.exec(line)

    if (!instructionMatch) {
      throw new Error(`Invalid Dockerfile instruction: ${line}`)
    }

    return {
      command: instructionMatch[1].toUpperCase(),
      arguments: instructionMatch[2].trim(),
    }
  })
}

const composeConfig = loadComposeConfig()
const gotenbergService = composeConfig.services.gotenberg
const appService = composeConfig.services.app

test('ignores comments while parsing executable Dockerfile instructions', () => {
  expect(
    parseDockerfileInstructions(`
      # FROM misleading/image:latest
      FROM trusted/image:1

      # RUN apt-get install unsafe-package
      RUN echo safe \\
        && echo complete
    `)
  ).toEqual([
    { command: 'FROM', arguments: 'trusted/image:1' },
    { command: 'RUN', arguments: 'echo safe && echo complete' },
  ])
})

describe('Gotenberg Compose infrastructure', () => {
  test('patches outbound policy denials into resource loading failures', () => {
    const dockerfile = readFileSync(
      resolve(repositoryRoot, 'ops/gotenberg/Dockerfile'),
      'utf8'
    )
    const patchPath = resolve(
      repositoryRoot,
      'ops/gotenberg/fail-closed-resource-policy.patch'
    )
    const sourcePatch = existsSync(patchPath)
      ? readFileSync(patchPath, 'utf8')
      : ''

    expect(dockerfile).toContain(
      'golang:1.26.2-bookworm@sha256:47ce5636e9936b2c5cbf708925578ef386b4f8872aec74a67bd13a627d242b19 AS gotenberg-builder'
    )
    expect(dockerfile).toContain(
      'GOTENBERG_SOURCE_COMMIT=98fc40347885ad510a311b990a73397c6d4143db'
    )
    expect(dockerfile).toContain(
      'GOTENBERG_SOURCE_SHA256=7aa20a8062bb170f3f9931eb35be3bf24479b9298f48ebe49e28a8d3ce45d947'
    )
    expect(dockerfile).toContain('sha256sum --check')
    expect(dockerfile).toContain('patch --forward --strip=1')
    expect(dockerfile).toContain('go test ./pkg/modules/chromium')
    expect(dockerfile).toContain('cmd/gotenberg/main.go')
    expect(dockerfile).toContain(
      'COPY --from=gotenberg-builder /out/gotenberg /usr/bin/gotenberg'
    )
    expect(sourcePatch).toContain('net::ERR_ACCESS_DENIED')
    expect(sourcePatch).toContain(
      'blocked outbound resources must fail closed'
    )
  })

  test('builds the custom pinned Gotenberg 8 image with Times New Roman', () => {
    const dockerfile = readFileSync(
      resolve(repositoryRoot, 'ops/gotenberg/Dockerfile'),
      'utf8'
    )
    const dockerfileInstructions = parseDockerfileInstructions(dockerfile)
    const instructionArguments = (command: string) =>
      dockerfileInstructions
        .filter((instruction) => instruction.command === command)
        .map((instruction) => instruction.arguments)
    const runInstructions = instructionArguments('RUN').join('\n')

    expect(gotenbergService.build.context).toBe(
      resolve(repositoryRoot, 'ops/gotenberg')
    )
    expect(gotenbergService.build.dockerfile).toBe('Dockerfile')
    expect(instructionArguments('FROM')).toEqual([
      'golang:1.26.2-bookworm@sha256:47ce5636e9936b2c5cbf708925578ef386b4f8872aec74a67bd13a627d242b19 AS gotenberg-builder',
      'gotenberg/gotenberg:8.34.0@sha256:67097317623a503ba2a6a7e9ae8db6929a1f7e1bbd88077bacf2d325fbdab923',
    ])
    expect(instructionArguments('USER')).toEqual(['root', 'gotenberg'])
    expect(instructionArguments('ARG')).toContain(
      'DEBIAN_FRONTEND=noninteractive'
    )
    expect(runInstructions).toMatch(/trixie contrib non-free/)
    expect(runInstructions).toMatch(
      /msttcorefonts\/accepted-mscorefonts-eula/
    )
    expect(runInstructions).toMatch(
      /apt-get install[\s\S]*ttf-mscorefonts-installer/
    )
    expect(runInstructions).toContain('fc-match "Times New Roman"')
    expect(dockerfileInstructions.at(-1)).toEqual({
      command: 'USER',
      arguments: 'gotenberg',
    })
  })

  test('keeps Gotenberg upstream private and PDF optional for application startup', () => {
    expect(gotenbergService.ports).toBeUndefined()
    expect(gotenbergService.network_mode).not.toBe('host')
    expect(gotenbergService.networks).toEqual({ 'pdf-upstream': null })
    expect(appService.environment.GOTENBERG_URL).toBe(
      'http://pdf-gateway:8080'
    )
    expect(appService.depends_on).not.toHaveProperty('gotenberg')
    expect(appService.depends_on).not.toHaveProperty('pdf-gateway')
    expect(composeConfig.services.nginx.depends_on).not.toHaveProperty(
      'gotenberg'
    )
    expect(composeConfig.services.nginx.depends_on).not.toHaveProperty(
      'pdf-gateway'
    )
    expect(JSON.stringify(appService.healthcheck.test)).not.toMatch(
      /gotenberg|GOTENBERG_URL/i
    )
  })

  test('defines health and resource boundaries for Chromium conversion', () => {
    expect(gotenbergService.restart).toBe('unless-stopped')
    expect(gotenbergService.healthcheck.test).toEqual([
      'CMD',
      'curl',
      '--fail',
      '--silent',
      '--show-error',
      'http://localhost:3000/health',
    ])
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
    const executableDockerfile = parseDockerfileInstructions(dockerfile)
      .map(
        (instruction) => `${instruction.command} ${instruction.arguments}`
      )
      .join('\n')
    const forbiddenOverrides =
      /CHROMIUM_(?:PROXY_SERVER|HOST_RESOLVER_RULES|ALLOW_LIST)|--chromium-(?:proxy-server|host-resolver-rules|allow-list)|(?:HTTP|HTTPS|ALL|NO)_PROXY/i

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
        environment: gotenbergService.environment,
      })
    ).not.toMatch(forbiddenOverrides)
    expect(executableDockerfile).not.toMatch(forbiddenOverrides)
  })

  test('documents the internal application service URL', () => {
    expect(loadExampleEnvironment().GOTENBERG_URL).toBe(
      'http://pdf-gateway:8080'
    )
  })
})

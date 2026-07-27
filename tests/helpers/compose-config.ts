/**
 * Renders Docker Compose with the repository example environment so config
 * tests inspect the same normalized contract.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..'
)

export function loadComposeConfig(profiles: string[] = []) {
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

  const profileArguments = profiles.flatMap((profile) => [
    '--profile',
    profile,
  ])
  const output = execFileSync(
    'docker',
    [
      'compose',
      '--file',
      'docker-compose.yml',
      '--env-file',
      '.env.example',
      ...profileArguments,
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

export function loadExampleEnvironment() {
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

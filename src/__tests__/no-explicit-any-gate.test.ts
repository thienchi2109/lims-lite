import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { findExplicitAnyViolations } from '../../scripts/check-no-explicit-any.mjs'

const ANY_KEYWORD = 'any'
const GIT_EXECUTABLE = '/usr/bin/git'

describe('findExplicitAnyViolations', () => {
  it('reports explicit any usages added in a diff', () => {
    const explicitTypeLine = `const value: ${ANY_KEYWORD} = getValue()`
    const explicitCastLine = `const castValue = value as ${ANY_KEYWORD}`
    const explicitPromiseLine = `type ApiResponse = Promise<${ANY_KEYWORD}>`
    const explicitListLine = `type List = ${ANY_KEYWORD}[]`
    const explicitRecordLine = `type Map = Record<string, ${ANY_KEYWORD}>`
    const diff = [
      'diff --git a/src/example.ts b/src/example.ts',
      '+++ b/src/example.ts',
      `+${explicitTypeLine}`,
      `+${explicitCastLine}`,
      `+${explicitPromiseLine}`,
      `+${explicitListLine}`,
      `+${explicitRecordLine}`,
    ].join('\n')

    expect(findExplicitAnyViolations(diff)).toEqual([
      { filePath: 'src/example.ts', line: explicitTypeLine },
      { filePath: 'src/example.ts', line: explicitCastLine },
      { filePath: 'src/example.ts', line: explicitPromiseLine },
      { filePath: 'src/example.ts', line: explicitListLine },
      { filePath: 'src/example.ts', line: explicitRecordLine },
    ])
  })

  it('ignores removed lines, diff headers, and words that are not explicit any types', () => {
    const diff = [
      'diff --git a/src/example.ts b/src/example.ts',
      '--- a/src/example.ts',
      '+++ b/src/example.ts',
      `-const oldValue: ${ANY_KEYWORD} = getValue()`,
      '+const label = "company policy can mention any word"',
      '+const safeValue: unknown = getValue()',
      '+const values: unknown[] = []',
    ].join('\n')

    expect(findExplicitAnyViolations(diff)).toEqual([])
  })

  it('reports added code lines that start with an increment operator', () => {
    const incrementLine = `++counter as ${ANY_KEYWORD}`
    const diff = [
      'diff --git a/src/example.ts b/src/example.ts',
      '+++ b/src/example.ts',
      `+${incrementLine}`,
    ].join('\n')

    expect(findExplicitAnyViolations(diff)).toEqual([
      { filePath: 'src/example.ts', line: incrementLine },
    ])
  })

  it('keeps staged checks scoped to staged files', () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'no-explicit-any-'))
    const scriptPath = join(process.cwd(), 'scripts/check-no-explicit-any.mjs')

    execFileSync(GIT_EXECUTABLE, ['init'], { cwd: repoPath, stdio: 'ignore' })
    writeFileSync(join(repoPath, 'scratch.ts'), `const value: ${ANY_KEYWORD} = 1\n`)

    const output = execFileSync(process.execPath, [scriptPath, '--staged'], {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    expect(output).toContain('No explicit any found')
  })
})

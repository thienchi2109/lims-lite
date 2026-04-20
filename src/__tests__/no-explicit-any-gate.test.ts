import { describe, expect, it } from 'vitest'

import { findExplicitAnyViolations } from '../../scripts/check-no-explicit-any.mjs'

const ANY_KEYWORD = 'any'

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
})

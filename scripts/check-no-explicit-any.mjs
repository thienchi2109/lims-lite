#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const EXPLICIT_ANY_PATTERNS = [
  /:\s*any\b/,
  /\bas\s+any\b/,
  /<\s*any\s*>/,
  /\bany\s*\[\]/,
  /\b[A-Za-z_$][\w$]*\s*<[^>\n]*\bany\b[^>\n]*>/,
  /=\s*any\b/,
]

function getAddedLines(diffText) {
  const violations = []
  let currentFilePath = null

  for (const rawLine of diffText.split('\n')) {
    if (rawLine.startsWith('+++ b/')) {
      currentFilePath = rawLine.slice('+++ b/'.length)
      continue
    }

    if (
      !rawLine.startsWith('+') ||
      rawLine.startsWith('+++ b/') ||
      rawLine.startsWith('+++ /dev/null')
    ) {
      continue
    }

    const line = rawLine.slice(1)

    if (EXPLICIT_ANY_PATTERNS.some((pattern) => pattern.test(line))) {
      violations.push({
        filePath: currentFilePath || 'unknown',
        line,
      })
    }
  }

  return violations
}

export function findExplicitAnyViolations(diffText) {
  return getAddedLines(diffText)
}

function runGit(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function tryRunGit(args) {
  try {
    return runGit(args).trim()
  } catch {
    return null
  }
}

function getUntrackedTypeScriptDiffText() {
  const output = runGit([
    'ls-files',
    '--others',
    '--exclude-standard',
    '--',
    '*.ts',
    '*.tsx',
    '*.mts',
  ])

  return output
    .split('\n')
    .filter(Boolean)
    .map((filePath) => {
      const addedLines = readFileSync(filePath, 'utf8')
        .split('\n')
        .map((line) => `+${line}`)
        .join('\n')

      return [
        `diff --git a/${filePath} b/${filePath}`,
        `+++ b/${filePath}`,
        addedLines,
      ].join('\n')
    })
    .join('\n')
}

function getDiffText(argv) {
  if (argv.includes('--staged')) {
    return runGit(['diff', '--cached', '-U0', '--', '*.ts', '*.tsx', '*.mts'])
  }

  const baseFlagIndex = argv.indexOf('--base')
  const baseRef =
    baseFlagIndex === -1
      ? process.env.NO_EXPLICIT_ANY_BASE || 'origin/main'
      : argv[baseFlagIndex + 1]

  const mergeBase =
    tryRunGit(['merge-base', 'HEAD', baseRef]) || tryRunGit(['rev-parse', 'HEAD'])

  return [
    mergeBase
      ? runGit(['diff', '-U0', `${mergeBase}...HEAD`, '--', '*.ts', '*.tsx', '*.mts'])
      : '',
    runGit(['diff', '--cached', '-U0', '--', '*.ts', '*.tsx', '*.mts']),
    runGit(['diff', '-U0', '--', '*.ts', '*.tsx', '*.mts']),
    getUntrackedTypeScriptDiffText(),
  ].join('\n')
}

function printViolations(violations) {
  console.error('Explicit any is not allowed in new TypeScript diff lines:')

  for (const violation of violations) {
    console.error(`- ${violation.filePath}: ${violation.line.trim()}`)
  }
}

function main() {
  const violations = findExplicitAnyViolations(getDiffText(process.argv.slice(2)))

  if (violations.length > 0) {
    printViolations(violations)
    process.exitCode = 1
    return
  }

  console.log('No explicit any found in TypeScript diff.')
}

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1] || '').href

if (isDirectRun) {
  try {
    main()
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}

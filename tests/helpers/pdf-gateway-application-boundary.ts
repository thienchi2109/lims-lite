/**
 * Scans production application source for violations of the authenticated PDF
 * gateway boundary. The separately deployed gateway server is out of scope.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import {
  collectStaticExpressionBindings,
  type StaticExpressionBindings,
} from './pdf-gateway-static-expression'
import {
  collectPdfGatewayConversionReferences,
  hasCallerControlledPdfTransport,
  isPdfGatewayConversionCall,
} from './pdf-gateway-conversion-reference'
import {
  collectNetworkFactoryArguments,
  collectNetworkReferences,
  isNetworkSink,
} from './pdf-gateway-network-reference'
import { collectEndpointCandidates } from './pdf-gateway-network-endpoint'
import { findProhibitedGatewayReferences } from './pdf-gateway-prohibited-reference'

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..'
)
const applicationSourceRoot = resolve(repositoryRoot, 'src')
const gatewayClientFile = 'src/lib/coa/pdf/gateway-client.ts'
const sourceExtensions = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
])
const rawBoundaryPatterns = [
  {
    pattern: /\bgotenberg:3000\b/i,
    rule: 'raw-gotenberg-host' as const,
  },
  {
    pattern: /\/forms\/chromium\/convert\/html\b/i,
    rule: 'raw-gotenberg-path' as const,
  },
]
const directTransportPattern =
  /\b(?:GOTENBERG_URL|PDF_GATEWAY_TOKEN_FILE)\b|pdf-gateway:8080|\/v1\/convert\/html\b/i

export type PdfGatewayBoundaryRule =
  | 'caller-controlled-transport'
  | 'direct-gateway-transport'
  | 'raw-gotenberg-host'
  | 'raw-gotenberg-path'

export interface PdfGatewayBoundaryViolation {
  file: string
  line: number
  rule: PdfGatewayBoundaryRule
}

export function findPdfGatewayApplicationBoundaryViolations(
  sourceRoot = applicationSourceRoot
): PdfGatewayBoundaryViolation[] {
  return collectProductionSourceFiles(sourceRoot)
    .flatMap((absolutePath) => {
      const file = relative(repositoryRoot, absolutePath).split(sep).join('/')
      return analyzePdfGatewayBoundarySource(
        file,
        readFileSync(absolutePath, 'utf8')
      )
    })
    .sort(compareViolations)
}

export function analyzePdfGatewayBoundarySource(
  file: string,
  source: string
): PdfGatewayBoundaryViolation[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(file)
  )
  const bindings = collectStaticExpressionBindings(sourceFile)
  const conversionReferences =
    collectPdfGatewayConversionReferences(sourceFile)
  const networkReferences = collectNetworkReferences(sourceFile, bindings)
  const violations = findRawBoundaryReferences(file, source)

  if (file !== gatewayClientFile) {
    const directTransportMatch = directTransportPattern.exec(source)
    if (directTransportMatch) {
      violations.push({
        file,
        line: getLineNumber(source, directTransportMatch.index),
        rule: 'direct-gateway-transport',
      })
    }
    for (const importNode of [
      ...conversionReferences.unsupportedImports,
      ...findProhibitedGatewayReferences(sourceFile),
    ]) {
      violations.push(createNodeViolation(
        file,
        sourceFile,
        importNode,
        'direct-gateway-transport'
      ))
    }
  }

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      if (
        isPdfGatewayConversionCall(
          node.expression,
          conversionReferences,
          bindings
        ) &&
        hasCallerControlledPdfTransport(node, bindings)
      ) {
        violations.push(createNodeViolation(
          file,
          sourceFile,
          node,
          'caller-controlled-transport'
        ))
      }

      if (isNetworkSink(node.expression, bindings, networkReferences)) {
        inspectEndpointExpression(
          file,
          sourceFile,
          node,
          node.arguments[0],
          bindings,
          violations
        )
        for (const factoryArgument of collectNetworkFactoryArguments(
          node.expression,
          bindings,
          networkReferences
        )) {
          inspectEndpointExpression(
            file,
            sourceFile,
            node,
            factoryArgument,
            bindings,
            violations
          )
        }
      }
    }

    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'URL'
    ) {
      inspectEndpointExpression(
        file,
        sourceFile,
        node,
        node,
        bindings,
        violations
      )
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return deduplicateViolations(violations)
}

function collectProductionSourceFiles(directory: string): string[] {
  const files: string[] = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name)
    const repositoryPath = relative(repositoryRoot, absolutePath)
      .split(sep)
      .join('/')

    if (entry.isDirectory()) {
      if (
        entry.name === '__tests__' ||
        repositoryPath === 'src/lib/pdf-gateway'
      ) {
        continue
      }
      files.push(...collectProductionSourceFiles(absolutePath))
      continue
    }

    if (
      entry.isFile() &&
      sourceExtensions.has(extname(entry.name)) &&
      !/\.(?:spec|test)\.[^.]+$/i.test(entry.name)
    ) {
      files.push(absolutePath)
    }
  }

  return files
}

function inspectEndpointExpression(
  file: string,
  sourceFile: ts.SourceFile,
  reportNode: ts.Node,
  expression: ts.Expression | undefined,
  bindings: StaticExpressionBindings,
  violations: PdfGatewayBoundaryViolation[]
) {
  if (!expression) {
    return
  }

  for (const endpoint of collectEndpointCandidates(expression, bindings)) {
    for (const { pattern, rule } of rawBoundaryPatterns) {
      if (pattern.test(endpoint)) {
        violations.push(createNodeViolation(
          file,
          sourceFile,
          reportNode,
          rule
        ))
      }
    }
    if (
      file !== gatewayClientFile &&
      directTransportPattern.test(endpoint)
    ) {
      violations.push(createNodeViolation(
        file,
        sourceFile,
        reportNode,
        'direct-gateway-transport'
      ))
    }
  }
}

function findRawBoundaryReferences(
  file: string,
  source: string
): PdfGatewayBoundaryViolation[] {
  const violations: PdfGatewayBoundaryViolation[] = []

  for (const { pattern, rule } of rawBoundaryPatterns) {
    const globalPattern = new RegExp(pattern.source, `${pattern.flags}g`)
    for (const match of source.matchAll(globalPattern)) {
      violations.push({
        file,
        line: getLineNumber(source, match.index ?? 0),
        rule,
      })
    }
  }

  return violations
}

function createNodeViolation(
  file: string,
  sourceFile: ts.SourceFile,
  node: ts.Node,
  rule: PdfGatewayBoundaryRule
): PdfGatewayBoundaryViolation {
  return {
    file,
    line:
      sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
      1,
    rule,
  }
}

function deduplicateViolations(
  violations: PdfGatewayBoundaryViolation[]
): PdfGatewayBoundaryViolation[] {
  const unique = new Map<string, PdfGatewayBoundaryViolation>()
  for (const violation of violations) {
    unique.set(
      `${violation.file}:${violation.line}:${violation.rule}`,
      violation
    )
  }
  return [...unique.values()].sort(compareViolations)
}

function getScriptKind(file: string): ts.ScriptKind {
  return file.endsWith('.tsx') || file.endsWith('.jsx')
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS
}

function getLineNumber(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

function compareViolations(
  left: PdfGatewayBoundaryViolation,
  right: PdfGatewayBoundaryViolation
): number {
  return (
    left.file.localeCompare(right.file) ||
    left.line - right.line ||
    left.rule.localeCompare(right.rule)
  )
}

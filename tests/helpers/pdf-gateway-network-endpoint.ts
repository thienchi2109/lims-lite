import ts from 'typescript'
import {
  evaluateStaticString,
  resolveStaticExpression,
  type StaticExpressionBindings,
} from './pdf-gateway-static-expression'

const globalConstructorOwners = new Set(['globalThis', 'self', 'window'])

export function collectEndpointCandidates(
  expression: ts.Expression,
  bindings: StaticExpressionBindings,
  seen = new Set<number>()
): string[] {
  const candidate = resolveStaticExpression(expression, bindings, seen)
  const directValue = evaluateStaticString(candidate, bindings, seen)
  if (directValue !== null) {
    return [directValue]
  }

  if (
    ts.isNewExpression(candidate) &&
    isRequestOrUrlConstructor(candidate.expression, bindings)
  ) {
    return (candidate.arguments ?? []).flatMap((argument) =>
      collectEndpointCandidates(argument, bindings, seen)
    )
  }

  if (ts.isObjectLiteralExpression(candidate)) {
    return collectObjectEndpointCandidates(candidate, bindings, seen)
  }

  return []
}

function collectObjectEndpointCandidates(
  object: ts.ObjectLiteralExpression,
  bindings: StaticExpressionBindings,
  seen: Set<number>
): string[] {
  const values = collectObjectEndpointValues(object, bindings, seen)
  const direct =
    values.get('href') ?? values.get('url') ?? values.get('baseurl')
  if (direct) {
    return [direct]
  }

  const host = values.get('hostname') ?? values.get('host')
  const path = values.get('path')
  if (!host && !path) {
    return []
  }

  const protocol = normalizeProtocol(values.get('protocol'))
  const port = values.get('port')
  const normalizedPath =
    path && !path.startsWith('/') ? `/${path}` : (path ?? '')
  return [
    `${protocol}${host ?? ''}${port ? `:${port}` : ''}${normalizedPath}`,
  ]
}

function collectObjectEndpointValues(
  object: ts.ObjectLiteralExpression,
  bindings: StaticExpressionBindings,
  seen: Set<number>
): Map<string, string> {
  const values = new Map<string, string>()

  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) {
      const spread = resolveStaticExpression(property.expression, bindings)
      if (ts.isObjectLiteralExpression(spread)) {
        for (const [name, value] of collectObjectEndpointValues(
          spread,
          bindings,
          seen
        )) {
          values.set(name, value)
        }
      }
      continue
    }
    if (ts.isShorthandPropertyAssignment(property)) {
      const value = evaluateStaticString(property.name, bindings, seen)
      if (value !== null) {
        values.set(property.name.text.toLowerCase(), value)
      }
      continue
    }
    if (ts.isPropertyAssignment(property)) {
      const name = getPropertyName(property.name)
      const value = evaluateStaticString(property.initializer, bindings, seen)
      if (name && value !== null) {
        values.set(name, value)
      }
    }
  }

  return values
}

function isRequestOrUrlConstructor(
  expression: ts.LeftHandSideExpression,
  bindings: StaticExpressionBindings
): boolean {
  const candidate = resolveStaticExpression(expression, bindings)

  if (ts.isIdentifier(candidate)) {
    return ['Request', 'URL'].includes(candidate.text)
  }
  if (
    ts.isPropertyAccessExpression(candidate) &&
    ts.isIdentifier(candidate.expression) &&
    globalConstructorOwners.has(candidate.expression.text)
  ) {
    return ['Request', 'URL'].includes(candidate.name.text)
  }
  if (
    ts.isElementAccessExpression(candidate) &&
    ts.isIdentifier(candidate.expression) &&
    globalConstructorOwners.has(candidate.expression.text) &&
    candidate.argumentExpression
  ) {
    return ['Request', 'URL'].includes(
      evaluateStaticString(candidate.argumentExpression, bindings) ?? ''
    )
  }
  return false
}

function getPropertyName(name: ts.PropertyName): string | null {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text.toLowerCase()
  }
  return null
}

function normalizeProtocol(protocol: string | undefined): string {
  if (!protocol) {
    return ''
  }
  return protocol.endsWith('//')
    ? protocol
    : `${protocol.replace(/:?$/, ':')}//`
}

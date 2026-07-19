import ts from 'typescript'
import {
  evaluateStaticString,
  findVisibleStaticBinding,
  type StaticExpressionBindings,
} from './pdf-gateway-static-expression'

const networkModules = new Set([
  'axios',
  'http',
  'https',
  'node:http',
  'node:https',
  'undici',
])
const networkMethodNames = new Set(['fetch', 'get', 'post', 'request'])
const globalFetchOwners = new Set(['globalThis', 'self', 'window'])

interface NetworkReferences {
  callables: Set<string>
  namespaces: Set<string>
}

export function collectNetworkReferences(
  sourceFile: ts.SourceFile,
  bindings: StaticExpressionBindings
): NetworkReferences {
  const references: NetworkReferences = {
    callables: new Set(),
    namespaces: new Set(),
  }

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !networkModules.has(statement.moduleSpecifier.text)
    ) {
      continue
    }

    const clause = statement.importClause
    if (clause?.name) {
      references.namespaces.add(clause.name.text)
    }
    const namedBindings = clause?.namedBindings
    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      references.namespaces.add(namedBindings.name.text)
    }
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      collectNamedNetworkBindings(namedBindings, references)
    }
  }

  collectCommonJsNetworkReferences(sourceFile, references)
  collectNetworkDestructuring(sourceFile, bindings, references)
  return references
}

export function isNetworkSink(
  expression: ts.Expression,
  bindings: StaticExpressionBindings,
  references: NetworkReferences,
  seen = new Set<number>()
): boolean {
  if (ts.isIdentifier(expression)) {
    const binding = findVisibleStaticBinding(expression, bindings)
    if (binding) {
      if (!binding.initializer || seen.has(binding.position)) {
        return false
      }
      const nextSeen = new Set(seen)
      nextSeen.add(binding.position)
      return isNetworkSink(
        binding.initializer,
        bindings,
        references,
        nextSeen
      )
    }
    return (
      expression.text === 'fetch' ||
      references.callables.has(expression.text)
    )
  }

  if (ts.isPropertyAccessExpression(expression)) {
    if (
      ts.isIdentifier(expression.expression) &&
      globalFetchOwners.has(expression.expression.text) &&
      expression.name.text === 'fetch'
    ) {
      return true
    }
    return (
      networkMethodNames.has(expression.name.text) &&
      isNetworkClientExpression(
        expression.expression,
        bindings,
        references,
        seen
      )
    )
  }

  if (
    ts.isElementAccessExpression(expression) &&
    expression.argumentExpression
  ) {
    const method = evaluateStaticString(
      expression.argumentExpression,
      bindings
    )
    return (
      method !== null &&
      networkMethodNames.has(method) &&
      isNetworkClientExpression(
        expression.expression,
        bindings,
        references,
        seen
      )
    )
  }

  return false
}

export function collectNetworkFactoryArguments(
  expression: ts.Expression,
  bindings: StaticExpressionBindings,
  references: NetworkReferences,
  seen = new Set<number>()
): ts.Expression[] {
  const client = getNetworkClientReceiver(expression)
  if (!client) {
    return []
  }
  return findNetworkFactoryArguments(client, bindings, references, seen)
}

function isNetworkClientExpression(
  expression: ts.Expression,
  bindings: StaticExpressionBindings,
  references: NetworkReferences,
  seen: Set<number>
): boolean {
  if (ts.isIdentifier(expression)) {
    const binding = findVisibleStaticBinding(expression, bindings)
    if (binding) {
      if (!binding.initializer || seen.has(binding.position)) {
        return false
      }
      const nextSeen = new Set(seen)
      nextSeen.add(binding.position)
      return isNetworkClientExpression(
        binding.initializer,
        bindings,
        references,
        nextSeen
      )
    }
    return references.namespaces.has(expression.text)
  }

  if (isNetworkRequire(expression)) {
    return true
  }

  if (
    ts.isCallExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression) &&
    expression.expression.name.text === 'create'
  ) {
    return isNetworkClientExpression(
      expression.expression.expression,
      bindings,
      references,
      seen
    )
  }

  return false
}

function getNetworkClientReceiver(
  expression: ts.Expression
): ts.Expression | null {
  if (
    ts.isPropertyAccessExpression(expression) ||
    ts.isElementAccessExpression(expression)
  ) {
    return expression.expression
  }
  return null
}

function findNetworkFactoryArguments(
  expression: ts.Expression,
  bindings: StaticExpressionBindings,
  references: NetworkReferences,
  seen: Set<number>
): ts.Expression[] {
  if (ts.isIdentifier(expression)) {
    const binding = findVisibleStaticBinding(expression, bindings)
    if (!binding?.initializer || seen.has(binding.position)) {
      return []
    }
    const nextSeen = new Set(seen)
    nextSeen.add(binding.position)
    return findNetworkFactoryArguments(
      binding.initializer,
      bindings,
      references,
      nextSeen
    )
  }

  if (
    ts.isCallExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression) &&
    expression.expression.name.text === 'create' &&
    isNetworkClientExpression(
      expression.expression.expression,
      bindings,
      references,
      seen
    )
  ) {
    return [...expression.arguments]
  }

  return []
}

function collectNamedNetworkBindings(
  bindings: ts.NamedImports,
  references: NetworkReferences
) {
  for (const element of bindings.elements) {
    if (networkMethodNames.has((element.propertyName ?? element.name).text)) {
      references.callables.add(element.name.text)
    }
  }
}

function collectCommonJsNetworkReferences(
  sourceFile: ts.SourceFile,
  references: NetworkReferences
) {
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      isNetworkRequire(node.initializer)
    ) {
      if (ts.isIdentifier(node.name)) {
        references.namespaces.add(node.name.text)
      }
      if (ts.isObjectBindingPattern(node.name)) {
        collectObjectNetworkBindings(node.name, references)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

function collectNetworkDestructuring(
  sourceFile: ts.SourceFile,
  bindings: StaticExpressionBindings,
  references: NetworkReferences
) {
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      isNetworkClientExpression(
        node.initializer,
        bindings,
        references,
        new Set()
      )
    ) {
      collectObjectNetworkBindings(node.name, references)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

function collectObjectNetworkBindings(
  pattern: ts.ObjectBindingPattern,
  references: NetworkReferences
) {
  for (const element of pattern.elements) {
    const importedName = (element.propertyName ?? element.name).getText()
    if (
      networkMethodNames.has(importedName) &&
      ts.isIdentifier(element.name)
    ) {
      references.callables.add(element.name.text)
    }
  }
}

function isNetworkRequire(expression: ts.Expression): boolean {
  return (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'require' &&
    expression.arguments.length === 1 &&
    ts.isStringLiteral(expression.arguments[0]) &&
    networkModules.has(expression.arguments[0].text)
  )
}

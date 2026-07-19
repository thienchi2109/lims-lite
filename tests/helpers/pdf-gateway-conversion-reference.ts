import ts from 'typescript'
import {
  evaluateStaticString,
  findVisibleStaticBinding,
  resolveStaticExpression,
  type StaticExpressionBindings,
} from './pdf-gateway-static-expression'

const directGatewayClientModulePattern =
  /(?:^|\/)coa\/pdf\/gateway-client(?:\.[cm]?[jt]sx?)?$/
const coaPdfBarrelModulePattern =
  /(?:^|\/)coa\/pdf(?:\.[cm]?[jt]sx?)?$/

export interface PdfGatewayConversionReferences {
  callables: Set<string>
  namespaces: Set<string>
  unsupportedImports: ts.ImportDeclaration[]
}

export function collectPdfGatewayConversionReferences(
  sourceFile: ts.SourceFile
): PdfGatewayConversionReferences {
  const references: PdfGatewayConversionReferences = {
    callables: new Set(),
    namespaces: new Set(),
    unsupportedImports: [],
  }

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue
    }

    const namedBindings = statement.importClause?.namedBindings
    const isDirectModule = directGatewayClientModulePattern.test(
      statement.moduleSpecifier.text
    )
    const isBarrelModule = coaPdfBarrelModulePattern.test(
      statement.moduleSpecifier.text
    )
    if (
      !isDirectModule &&
      isBarrelModule &&
      (statement.importClause?.name ||
        (namedBindings && ts.isNamespaceImport(namedBindings)))
    ) {
      references.unsupportedImports.push(statement)
    }
    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      if (isDirectModule) {
        references.namespaces.add(namedBindings.name.text)
      }
      continue
    }
    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
      continue
    }

    for (const element of namedBindings.elements) {
      if ((element.propertyName ?? element.name).text !== 'convertHtmlToPdf') {
        continue
      }
      if (isDirectModule) {
        references.callables.add(element.name.text)
      } else {
        references.unsupportedImports.push(statement)
      }
    }
  }

  collectNamespaceDestructuring(sourceFile, references)
  return references
}

export function isPdfGatewayConversionCall(
  expression: ts.LeftHandSideExpression,
  references: PdfGatewayConversionReferences,
  bindings: StaticExpressionBindings
): boolean {
  const indirectTarget = getIndirectCallTarget(expression, bindings)
  if (indirectTarget) {
    return expressionReferencesConversion(
      indirectTarget,
      references,
      bindings
    )
  }

  return expressionReferencesConversion(expression, references, bindings)
}

export function hasCallerControlledPdfTransport(
  call: ts.CallExpression,
  bindings: StaticExpressionBindings
): boolean {
  if (getIndirectCallTarget(call.expression, bindings)) {
    return true
  }
  if (call.arguments.some((argument) => ts.isSpreadElement(argument))) {
    return true
  }
  if (call.arguments.length !== 1) {
    return true
  }

  return ts.isObjectLiteralExpression(
    resolveStaticExpression(call.arguments[0], bindings)
  )
}

function collectNamespaceDestructuring(
  sourceFile: ts.SourceFile,
  references: PdfGatewayConversionReferences
) {
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      ts.isIdentifier(node.initializer) &&
      references.namespaces.has(node.initializer.text)
    ) {
      for (const element of node.name.elements) {
        if (
          (element.propertyName ?? element.name).getText() ===
            'convertHtmlToPdf' &&
          ts.isIdentifier(element.name)
        ) {
          references.callables.add(element.name.text)
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

function expressionReferencesConversion(
  expression: ts.Expression,
  references: PdfGatewayConversionReferences,
  bindings: StaticExpressionBindings,
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
      return expressionReferencesConversion(
        binding.initializer,
        references,
        bindings,
        nextSeen
      )
    }
    return references.callables.has(expression.text)
  }

  const candidate = resolveStaticExpression(expression, bindings, seen)
  if (ts.isIdentifier(candidate)) {
    return references.callables.has(candidate.text)
  }
  if (
    ts.isPropertyAccessExpression(candidate) &&
    ts.isIdentifier(candidate.expression)
  ) {
    return (
      references.namespaces.has(candidate.expression.text) &&
      candidate.name.text === 'convertHtmlToPdf'
    )
  }
  if (
    ts.isElementAccessExpression(candidate) &&
    ts.isIdentifier(candidate.expression) &&
    references.namespaces.has(candidate.expression.text) &&
    candidate.argumentExpression
  ) {
    return (
      evaluateStaticString(candidate.argumentExpression, bindings) ===
      'convertHtmlToPdf'
    )
  }
  return false
}

function getIndirectCallTarget(
  expression: ts.LeftHandSideExpression,
  bindings: StaticExpressionBindings
): ts.Expression | null {
  if (
    ts.isPropertyAccessExpression(expression) &&
    ['apply', 'call'].includes(expression.name.text)
  ) {
    return expression.expression
  }
  if (
    ts.isElementAccessExpression(expression) &&
    expression.argumentExpression &&
    ['apply', 'call'].includes(
      evaluateStaticString(expression.argumentExpression, bindings) ?? ''
    )
  ) {
    return expression.expression
  }
  return null
}

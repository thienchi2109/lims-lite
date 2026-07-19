import ts from 'typescript'

const gatewayServerModulePattern =
  /(?:^|\/)(?:lib|ops)\/pdf-gateway(?:\/|$)/
const gatewayConversionModulePattern =
  /(?:^|\/)coa\/pdf(?:\/gateway-client)?(?:\.[cm]?[jt]sx?)?$/

export function findProhibitedGatewayReferences(
  sourceFile: ts.SourceFile
): ts.Node[] {
  const references: ts.Node[] = []

  function visit(node: ts.Node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      gatewayServerModulePattern.test(node.moduleSpecifier.text)
    ) {
      references.push(node)
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      isProhibitedGatewayExport(node)
    ) {
      references.push(node)
    }

    if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]) &&
      (gatewayServerModulePattern.test(node.arguments[0].text) ||
        gatewayConversionModulePattern.test(node.arguments[0].text)) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require'))
    ) {
      references.push(node)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return references
}

function isProhibitedGatewayExport(node: ts.ExportDeclaration): boolean {
  if (
    !node.moduleSpecifier ||
    !ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return false
  }
  if (gatewayServerModulePattern.test(node.moduleSpecifier.text)) {
    return true
  }
  if (!gatewayConversionModulePattern.test(node.moduleSpecifier.text)) {
    return false
  }
  if (!node.exportClause) {
    return true
  }
  if (!ts.isNamedExports(node.exportClause)) {
    return true
  }

  return node.exportClause.elements.some(
    (element) =>
      (element.propertyName ?? element.name).text === 'convertHtmlToPdf'
  )
}

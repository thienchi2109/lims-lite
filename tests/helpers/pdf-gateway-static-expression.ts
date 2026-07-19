import ts from 'typescript'

export interface StaticExpressionBinding {
  initializer?: ts.Expression
  name: string
  position: number
  scope: ts.Node
}

export type StaticExpressionBindings = StaticExpressionBinding[]

export function collectStaticExpressionBindings(
  sourceFile: ts.SourceFile
): StaticExpressionBindings {
  const bindings: StaticExpressionBindings = []

  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name)
    ) {
      bindings.push({
        initializer: node.initializer,
        name: node.name.text,
        position: node.getStart(sourceFile),
        scope: findLexicalScope(node),
      })
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      const declarationBinding = findVisibleStaticBinding(node.left, bindings)
      bindings.push({
        initializer: node.right,
        name: node.left.text,
        position: node.getStart(sourceFile),
        scope: declarationBinding?.scope ?? findLexicalScope(node),
      })
    }
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      bindings.push({
        initializer: node.initializer,
        name: node.name.text,
        position: node.getStart(sourceFile),
        scope: findFunctionScope(node),
      })
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return bindings
}

export function resolveStaticExpression(
  expression: ts.Expression,
  bindings: StaticExpressionBindings,
  seen = new Set<number>()
): ts.Expression {
  const candidate = unwrapExpression(expression)
  if (!ts.isIdentifier(candidate)) {
    return candidate
  }

  const binding = findVisibleBinding(candidate, bindings)
  if (!binding?.initializer || seen.has(binding.position)) {
    return candidate
  }

  const nextSeen = new Set(seen)
  nextSeen.add(binding.position)
  return resolveStaticExpression(binding.initializer, bindings, nextSeen)
}

export function evaluateStaticString(
  expression: ts.Expression,
  bindings: StaticExpressionBindings,
  seen = new Set<number>()
): string | null {
  const candidate = unwrapExpression(expression)

  if (
    ts.isStringLiteral(candidate) ||
    ts.isNoSubstitutionTemplateLiteral(candidate) ||
    ts.isNumericLiteral(candidate)
  ) {
    return candidate.text
  }

  if (ts.isIdentifier(candidate)) {
    const binding = findVisibleBinding(candidate, bindings)
    if (!binding?.initializer || seen.has(binding.position)) {
      return null
    }
    const nextSeen = new Set(seen)
    nextSeen.add(binding.position)
    return evaluateStaticString(binding.initializer, bindings, nextSeen)
  }

  if (
    ts.isBinaryExpression(candidate) &&
    candidate.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = evaluateStaticString(candidate.left, bindings, seen)
    const right = evaluateStaticString(candidate.right, bindings, seen)
    return left === null || right === null ? null : left + right
  }

  if (ts.isTemplateExpression(candidate)) {
    let value = candidate.head.text
    for (const span of candidate.templateSpans) {
      const expressionValue = evaluateStaticString(
        span.expression,
        bindings,
        seen
      )
      if (expressionValue === null) {
        return null
      }
      value += expressionValue + span.literal.text
    }
    return value
  }

  if (ts.isCallExpression(candidate)) {
    return evaluateStaticCall(candidate, bindings, seen)
  }

  if (
    ts.isNewExpression(candidate) &&
    ts.isIdentifier(candidate.expression) &&
    candidate.expression.text === 'URL'
  ) {
    return evaluateStaticUrl(candidate.arguments ?? [], bindings, seen)
  }

  return null
}

export function findVisibleStaticBinding(
  identifier: ts.Identifier,
  bindings: StaticExpressionBindings
): StaticExpressionBinding | undefined {
  const usagePosition = identifier.getStart()

  return bindings
    .filter(
      (binding) =>
        binding.name === identifier.text &&
        binding.position < usagePosition &&
        binding.scope.getStart() <= usagePosition &&
        binding.scope.getEnd() >= usagePosition
    )
    .sort(
      (left, right) =>
        getNodeWidth(left.scope) - getNodeWidth(right.scope) ||
        right.position - left.position
    )[0]
}

function findVisibleBinding(
  identifier: ts.Identifier,
  bindings: StaticExpressionBindings
): StaticExpressionBinding | undefined {
  return findVisibleStaticBinding(identifier, bindings)
}

function findLexicalScope(node: ts.Node): ts.Node {
  let current = node.parent

  while (current) {
    if (
      ts.isSourceFile(current) ||
      ts.isBlock(current) ||
      ts.isCaseBlock(current) ||
      ts.isModuleBlock(current)
    ) {
      return current
    }
    current = current.parent
  }

  return node.getSourceFile()
}

function findFunctionScope(node: ts.Node): ts.Node {
  let current = node.parent

  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isConstructorDeclaration(current) ||
      ts.isGetAccessorDeclaration(current) ||
      ts.isSetAccessorDeclaration(current)
    ) {
      return current
    }
    current = current.parent
  }

  return findLexicalScope(node)
}

function getNodeWidth(node: ts.Node): number {
  return node.getEnd() - node.getStart()
}

function evaluateStaticCall(
  expression: ts.CallExpression,
  bindings: StaticExpressionBindings,
  seen: Set<number>
): string | null {
  if (
    !ts.isPropertyAccessExpression(expression.expression) ||
    expression.expression.name.text !== 'join'
  ) {
    return null
  }

  const target = resolveStaticExpression(
    expression.expression.expression,
    bindings
  )
  if (!ts.isArrayLiteralExpression(target)) {
    return null
  }

  const separator =
    expression.arguments.length === 0
      ? ','
      : evaluateStaticString(expression.arguments[0], bindings, seen)
  if (separator === null) {
    return null
  }

  const values: string[] = []
  for (const element of target.elements) {
    if (ts.isSpreadElement(element)) {
      return null
    }
    const value = evaluateStaticString(element, bindings, seen)
    if (value === null) {
      return null
    }
    values.push(value)
  }
  return values.join(separator)
}

function evaluateStaticUrl(
  argumentsList: readonly ts.Expression[],
  bindings: StaticExpressionBindings,
  seen: Set<number>
): string | null {
  if (argumentsList.length === 0) {
    return null
  }

  const path = evaluateStaticString(argumentsList[0], bindings, seen)
  const base =
    argumentsList.length > 1
      ? evaluateStaticString(argumentsList[1], bindings, seen)
      : undefined
  if (path === null || base === null) {
    return null
  }

  try {
    return base === undefined
      ? new URL(path).toString()
      : new URL(path, base).toString()
  } catch {
    return null
  }
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let candidate = expression

  while (
    ts.isParenthesizedExpression(candidate) ||
    ts.isAsExpression(candidate) ||
    ts.isTypeAssertionExpression(candidate) ||
    ts.isSatisfiesExpression(candidate) ||
    ts.isNonNullExpression(candidate)
  ) {
    candidate = candidate.expression
  }

  return candidate
}

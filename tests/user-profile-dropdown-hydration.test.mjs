// Regression test: UserProfileDropdown defers Radix menus until client mount to avoid hydration mismatches.
// Run with: node tests/user-profile-dropdown-hydration.test.mjs

import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import ts from 'typescript';

const filePath = path.join(
  process.cwd(),
  'src',
  'components',
  'user-profile-dropdown.tsx'
);

const content = await readFile(filePath, 'utf8');
const sourceFile = ts.createSourceFile(
  filePath,
  content,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

let hasIsMountedState = false;
let hasMountedEffect = false;
let hasGuardReturn = false;

const visit = (node) => {
  if (ts.isVariableDeclaration(node)) {
    if (ts.isArrayBindingPattern(node.name)) {
      const [first, second] = node.name.elements;
      if (
        first &&
        second &&
        ts.isIdentifier(first.name) &&
        ts.isIdentifier(second.name) &&
        first.name.text === 'isMounted' &&
        second.name.text === 'setIsMounted' &&
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        node.initializer.expression.text === 'useState'
      ) {
        hasIsMountedState = true;
      }
    }
  }

  if (ts.isCallExpression(node)) {
    if (ts.isIdentifier(node.expression) && node.expression.text === 'useEffect') {
      if (node.arguments.length > 0) {
        const effectArg = node.arguments[0];
        if (ts.isArrowFunction(effectArg) || ts.isFunctionExpression(effectArg)) {
          const body = effectArg.body;
          const statements = ts.isBlock(body) ? body.statements : [];
          for (const statement of statements) {
            if (ts.isExpressionStatement(statement)) {
              const expr = statement.expression;
              if (
                ts.isCallExpression(expr) &&
                ts.isIdentifier(expr.expression) &&
                expr.expression.text === 'setIsMounted' &&
                expr.arguments.length === 1 &&
                expr.arguments[0].kind === ts.SyntaxKind.TrueKeyword
              ) {
                hasMountedEffect = true;
              }
            }
          }
        }
      }
    }
  }

  if (ts.isIfStatement(node)) {
    const condition = node.expression;
    if (
      ts.isPrefixUnaryExpression(condition) &&
      condition.operator === ts.SyntaxKind.ExclamationToken &&
      ts.isIdentifier(condition.operand) &&
      condition.operand.text === 'isMounted'
    ) {
      const thenStatement = node.thenStatement;
      if (ts.isBlock(thenStatement)) {
        for (const statement of thenStatement.statements) {
          if (ts.isReturnStatement(statement)) {
            hasGuardReturn = true;
          }
        }
      } else if (ts.isReturnStatement(thenStatement)) {
        hasGuardReturn = true;
      }
    }
  }

  ts.forEachChild(node, visit);
};

visit(sourceFile);

assert.ok(hasIsMountedState, 'UserProfileDropdown should track isMounted state');
assert.ok(hasMountedEffect, 'UserProfileDropdown should set isMounted in useEffect');
assert.ok(hasGuardReturn, 'UserProfileDropdown should guard render before mount');

console.log('✓ UserProfileDropdown defers render until mount');

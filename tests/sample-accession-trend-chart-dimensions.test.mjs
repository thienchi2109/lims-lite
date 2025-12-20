// Regression test: SampleAccessionTrendChart uses minWidth to avoid Recharts size warnings.
// Run with: node tests/sample-accession-trend-chart-dimensions.test.mjs

import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import ts from 'typescript';

const chartFiles = [
  'sample-accession-trend-chart.tsx',
  'tat-trend-chart.tsx',
  'coa-statistics-chart.tsx',
  'sample-status-chart.tsx',
  'staff-productivity-chart.tsx',
].map((fileName) => path.join(process.cwd(), 'src', 'components', fileName));

const getAttribute = (node, name) =>
  node.attributes.properties.find(
    (prop) => ts.isJsxAttribute(prop) && prop.name.text === name
  );

const isZeroLiteral = (attribute) => {
  if (!attribute?.initializer || !ts.isJsxExpression(attribute.initializer)) {
    return false;
  }

  const expression = attribute.initializer.expression;
  return Boolean(
    expression && ts.isNumericLiteral(expression) && expression.text === '0'
  );
};

const isHeightIdentifier = (attribute) => {
  if (!attribute?.initializer || !ts.isJsxExpression(attribute.initializer)) {
    return false;
  }

  const expression = attribute.initializer.expression;
  return Boolean(expression && ts.isIdentifier(expression) && expression.text === 'height');
};

for (const filePath of chartFiles) {
  const content = await readFile(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const responsiveContainers = [];

  const visit = (node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      if (tagName === 'ResponsiveContainer') {
        responsiveContainers.push(node);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  assert.ok(
    responsiveContainers.length > 0,
    `${path.basename(filePath)} should render a ResponsiveContainer`
  );

  for (const container of responsiveContainers) {
    const minWidthAttribute = getAttribute(container, 'minWidth');
    const heightAttribute = getAttribute(container, 'height');

    assert.ok(
      minWidthAttribute,
      `${path.basename(filePath)} ResponsiveContainer should set minWidth`
    );
    assert.ok(
      isZeroLiteral(minWidthAttribute),
      `${path.basename(filePath)} ResponsiveContainer minWidth should be set to 0`
    );
    assert.ok(
      heightAttribute,
      `${path.basename(filePath)} ResponsiveContainer should set height`
    );
    assert.ok(
      isHeightIdentifier(heightAttribute),
      `${path.basename(filePath)} ResponsiveContainer height should use height prop`
    );
  }
}

console.log('✓ ResponsiveContainer enforces minWidth across charts');

// Regression test: ensure specialty_id is forwarded through client-actions route.
// Run with: node tests/assay-specialty-forwarding.test.mjs

import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const routePath = path.join(process.cwd(), 'src', 'app', 'api', 'client-actions', 'route.ts');
const content = await readFile(routePath, 'utf8');

const hasCreateSpecialtyAppend =
  /createAssayDefinition:\s*async\s*\([\s\S]*?\)\s*=>\s*{[\s\S]*?formData\.append\(\s*['"]specialty_id['"]/.test(
    content
  );

const hasUpdateSpecialtyAppend =
  /updateAssayDefinition:\s*async\s*\([\s\S]*?\)\s*=>\s*{[\s\S]*?formData\.append\(\s*['"]specialty_id['"]/.test(
    content
  );

assert.ok(
  hasCreateSpecialtyAppend,
  'createAssayDefinition handler must append specialty_id to FormData'
);
assert.ok(
  hasUpdateSpecialtyAppend,
  'updateAssayDefinition handler must append specialty_id to FormData'
);

console.log('✓ specialty_id is forwarded for create/update assays');

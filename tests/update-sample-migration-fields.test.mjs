// Regression test: updateSample supports client_id and type (migrations 039/040).
// Run with: node tests/update-sample-migration-fields.test.mjs

import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const typesPath = path.join(process.cwd(), 'src', 'types', 'index.ts');
const samplesActionPath = path.join(process.cwd(), 'src', 'app', 'actions', 'samples.ts');

const [typesContent, samplesActionContent] = await Promise.all([
  readFile(typesPath, 'utf8'),
  readFile(samplesActionPath, 'utf8'),
]);

const updateSchemaStart = typesContent.indexOf('export const UpdateSampleSchema');
assert.ok(updateSchemaStart !== -1, 'UpdateSampleSchema must exist');

const updateSchemaEnd = typesContent.indexOf('export type UpdateSample', updateSchemaStart);
assert.ok(updateSchemaEnd !== -1, 'UpdateSample type must exist');

const updateSchemaBlock = typesContent.slice(updateSchemaStart, updateSchemaEnd);
assert.ok(
  updateSchemaBlock.includes('client_id'),
  'UpdateSampleSchema must include client_id (migration 040)'
);
assert.ok(
  updateSchemaBlock.includes('type'),
  'UpdateSampleSchema must include type (migration 040)'
);

const updateSampleStart = samplesActionContent.indexOf('export async function updateSample');
assert.ok(updateSampleStart !== -1, 'updateSample action must exist');

const updateSampleEnd = samplesActionContent.indexOf('/**', updateSampleStart + 1);
const updateSampleBlock = samplesActionContent.slice(
  updateSampleStart,
  updateSampleEnd === -1 ? samplesActionContent.length : updateSampleEnd
);
assert.ok(
  updateSampleBlock.includes('validatedData.client_id'),
  'updateSample must handle client_id updates'
);
assert.ok(updateSampleBlock.includes('validatedData.type'), 'updateSample must handle type updates');

console.log('✓ updateSample supports client_id and type');

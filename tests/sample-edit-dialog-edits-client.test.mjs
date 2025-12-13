// Regression test: Sample edit dialog edits full client info (migrations 039/040).
// Run with: node tests/sample-edit-dialog-edits-client.test.mjs

import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const dialogPath = path.join(process.cwd(), 'src', 'components', 'sample-edit-dialog.tsx');
const clientFormPath = path.join(process.cwd(), 'src', 'components', 'client-form.tsx');
const apiClientPath = path.join(process.cwd(), 'src', 'lib', 'api-client.ts');
const clientActionsTypesPath = path.join(process.cwd(), 'src', 'lib', 'client-actions', 'types.ts');
const clientActionsRoutePath = path.join(
  process.cwd(),
  'src',
  'app',
  'api',
  'client-actions',
  'route.ts'
);
const clientsActionPath = path.join(process.cwd(), 'src', 'app', 'actions', 'clients.ts');

const [
  dialogContent,
  clientFormContent,
  apiClientContent,
  clientActionsTypesContent,
  clientActionsRouteContent,
  clientsActionContent,
] = await Promise.all([
  readFile(dialogPath, 'utf8'),
  readFile(clientFormPath, 'utf8'),
  readFile(apiClientPath, 'utf8'),
  readFile(clientActionsTypesPath, 'utf8'),
  readFile(clientActionsRoutePath, 'utf8'),
  readFile(clientsActionPath, 'utf8'),
]);

assert.ok(
  clientActionsTypesContent.includes("'getClient'"),
  "ClientActionName must include 'getClient'"
);
assert.ok(
  /getClient\s*:\s*async\s*\(/.test(clientActionsRouteContent),
  'client-actions route must expose getClient handler'
);
assert.ok(
  /export\s+async\s+function\s+getClient\s*\(/.test(clientsActionContent),
  'clients action must export getClient(id)'
);
assert.ok(
  apiClientContent.includes("callClientAction('getClient'"),
  'api-client must implement getClientClient()'
);

assert.ok(
  /updateClientClient/.test(clientFormContent),
  'ClientForm must support updating an existing client via updateClientClient'
);
assert.ok(
  /<ClientForm[\s\S]*mode=\s*["']update["']/.test(dialogContent) ||
    /<ClientForm[\s\S]*clientId=/.test(dialogContent),
  'SampleEditDialog must render ClientForm in update mode for the linked client'
);

console.log('✓ sample edit dialog edits full client info');


// Regression test: Sample edit dialog loads a linked client and saves profile data.
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
const clientLifecycleActionPath = path.join(
  process.cwd(),
  'src',
  'app',
  'actions',
  'client-lifecycle.ts'
);

const [
  dialogContent,
  clientFormContent,
  apiClientContent,
  clientActionsTypesContent,
  clientActionsRouteContent,
  clientsActionContent,
  clientLifecycleActionContent,
] = await Promise.all([
  readFile(dialogPath, 'utf8'),
  readFile(clientFormPath, 'utf8'),
  readFile(apiClientPath, 'utf8'),
  readFile(clientActionsTypesPath, 'utf8'),
  readFile(clientActionsRoutePath, 'utf8'),
  readFile(clientsActionPath, 'utf8'),
  readFile(clientLifecycleActionPath, 'utf8'),
]);

function getExportedFunctionBlock(content, signature) {
  const functionStart = content.indexOf(signature);
  assert.ok(functionStart !== -1, `${signature} must exist`);

  const nextExport = content.indexOf('\nexport ', functionStart + signature.length);
  return content.slice(
    functionStart,
    nextExport === -1 ? content.length : nextExport
  );
}

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
assert.match(
  dialogContent,
  /getClientClient\(\s*sample\.client_id(?:\s+as\s+string)?\s*\)/,
  'SampleEditDialog must load the linked client with sample.client_id'
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

for (const field of [
  'gender',
  'phone',
  'address',
  'health_insurance_num',
  'expiry_date',
]) {
  assert.match(
    dialogContent,
    new RegExp(`${field}:\\s*client\\.${field}`),
    `SampleEditDialog must seed the linked client's ${field} profile value`
  );
}

const apiIdentityCorrectionBlock = getExportedFunctionBlock(
  apiClientContent,
  'export function correctClientIdentityClient'
);
assert.match(
  apiIdentityCorrectionBlock,
  /return\s+callClientAction[\s\S]*?\(\s*['"]correctClientIdentity['"]\s*,\s*data\s*,?\s*\)/,
  "correctClientIdentityClient must delegate data to action 'correctClientIdentity'"
);

assert.match(
  clientActionsRouteContent,
  /correctClientIdentity\s*:\s*async\s*\(\s*payload\s*\)\s*=>\s*correctClientIdentity\(\s*payload\s*\)/,
  'client-actions route must delegate identity correction payload to correctClientIdentity'
);

const lifecycleIdentityCorrectionBlock = getExportedFunctionBlock(
  clientLifecycleActionContent,
  'export async function correctClientIdentity'
);
assert.match(
  lifecycleIdentityCorrectionBlock,
  /return\s+runMutation\(\s*['"]correct_client_identity_v1['"]/,
  'correctClientIdentity must delegate to the audited correct_client_identity_v1 RPC'
);

// The companion clients-update-allows-analyst test owns the scoped assertion
// that normal updateClient never writes id_card_num, name, or date_of_birth.

console.log('✓ sample edit dialog loads linked client profile editing');


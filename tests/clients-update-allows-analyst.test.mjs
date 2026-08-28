// Regression test: analysts and managers can update client profile fields only.
// Run with: node tests/clients-update-allows-analyst.test.mjs

import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const clientsActionPath = path.join(process.cwd(), 'src', 'app', 'actions', 'clients.ts');
const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

const [clientsActionContent, migrationFiles] = await Promise.all([
  readFile(clientsActionPath, 'utf8'),
  readdir(migrationsDir),
]);

const updateClientStart = clientsActionContent.indexOf('export async function updateClient');
assert.ok(updateClientStart !== -1, 'updateClient action must exist');

const nextActionStart = clientsActionContent.indexOf(
  '\nexport async function ',
  updateClientStart + 1
);
const updateClientBlock = clientsActionContent.slice(
  updateClientStart,
  nextActionStart === -1 ? clientsActionContent.length : nextActionStart
);

for (const role of ['analyst', 'manager']) {
  assert.ok(
    updateClientBlock.includes(`'${role}'`) || updateClientBlock.includes(`"${role}"`),
    `updateClient must allow ${role}s to update client profile fields`
  );
}

for (const field of [
  'gender',
  'phone',
  'address',
  'health_insurance_num',
  'expiry_date',
]) {
  assert.match(
    updateClientBlock,
    new RegExp(`updateData\\.${field}\\s*=`),
    `updateClient must preserve the ${field} profile update`
  );
}

assert.doesNotMatch(
  updateClientBlock,
  /updateData\.(?:id_card_num|name|date_of_birth)\s*=/,
  'updateClient must reject identity fields instead of sending them to clients.update'
);

const sqlFiles = migrationFiles.filter((file) => file.endsWith('.sql'));
const migrationsContent = await Promise.all(
  sqlFiles.map((file) => readFile(path.join(migrationsDir, file), 'utf8'))
);

const hasAnalystUpdatePolicy = migrationsContent.some((content) => {
  const onIndex = content.search(/ON\s+public\.clients\s+FOR\s+UPDATE/i);
  if (onIndex === -1) return false;

  const createIndex = content.lastIndexOf('CREATE POLICY', onIndex);
  const statementStart = createIndex === -1 ? onIndex : createIndex;
  const statementEnd = content.indexOf(';', onIndex);
  const statement = content.slice(
    statementStart,
    statementEnd === -1 ? content.length : statementEnd + 1
  );

  const roleChecks =
    statement.match(
      /get_user_role\(\)\s+IN\s*\(\s*'analyst'\s*,\s*'manager'\s*\)/gi
    ) ?? [];

  return roleChecks.length >= 2;
});

assert.ok(
  hasAnalystUpdatePolicy,
  "RLS migrations must allow UPDATE on public.clients for roles ('analyst','manager')"
);

console.log('✓ analysts can update clients (RLS + action)');

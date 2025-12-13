// Regression test: analysts can update clients (RLS + server action).
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

const updateClientBlock = clientsActionContent.slice(updateClientStart);
assert.ok(
  updateClientBlock.includes("'analyst'") || updateClientBlock.includes('"analyst"'),
  'updateClient must allow analysts to update clients'
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

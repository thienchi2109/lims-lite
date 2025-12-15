// Regression test: Manager approvals show a real-time favicon badge for pending reviews.
// Run with: node tests/manager-approval-favicon-badge.test.mjs

import { readFile, readdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
import path from 'node:path'

const root = process.cwd()

const hookPath = path.join(root, 'src', 'hooks', 'use-favicon-badge.ts')
const approvalTabsPath = path.join(root, 'src', 'components', 'approval-tabs-client.tsx')
const apiClientPath = path.join(root, 'src', 'lib', 'api-client.ts')
const clientActionsTypesPath = path.join(root, 'src', 'lib', 'client-actions', 'types.ts')
const clientActionsRoutePath = path.join(root, 'src', 'app', 'api', 'client-actions', 'route.ts')
const samplesActionsPath = path.join(root, 'src', 'app', 'actions', 'samples.ts')
const migrationsDir = path.join(root, 'supabase', 'migrations')

const hookContent = await readFile(hookPath, 'utf8')

assert.ok(
  hookContent.includes("document.createElement('canvas')") || hookContent.includes('document.createElement("canvas")'),
  'useFaviconBadge should draw using an HTMLCanvasElement'
)
assert.ok(
  hookContent.includes('toDataURL'),
  'useFaviconBadge should export a favicon image via canvas.toDataURL()'
)

const approvalTabsContent = await readFile(approvalTabsPath, 'utf8')
assert.ok(
  approvalTabsContent.includes('useFaviconBadge'),
  'ApprovalTabsClient should use useFaviconBadge() to update the favicon'
)
assert.ok(
  approvalTabsContent.includes('postgres_changes') || approvalTabsContent.includes('.channel('),
  'ApprovalTabsClient should subscribe to realtime updates for samples'
)

const samplesActionsContent = await readFile(samplesActionsPath, 'utf8')
assert.ok(
  samplesActionsContent.includes('getSamplesForApprovalCount'),
  'samples actions should expose getSamplesForApprovalCount() for fetching pending review count'
)

const apiClientContent = await readFile(apiClientPath, 'utf8')
assert.ok(
  apiClientContent.includes('getSamplesForApprovalCount') || apiClientContent.includes('SamplesForApprovalCount'),
  'api-client should expose a client helper for fetching approval pending count'
)

const clientActionsTypesContent = await readFile(clientActionsTypesPath, 'utf8')
assert.ok(
  clientActionsTypesContent.includes("'getSamplesForApprovalCount'"),
  'client-actions types should include getSamplesForApprovalCount'
)

const clientActionsRouteContent = await readFile(clientActionsRoutePath, 'utf8')
assert.ok(
  clientActionsRouteContent.includes('getSamplesForApprovalCount'),
  'client-actions route should map getSamplesForApprovalCount to a server action'
)

const migrationFiles = await readdir(migrationsDir)
let hasRealtimeSamplesMigration = false
for (const file of migrationFiles) {
  if (!file.endsWith('.sql')) continue
  const content = await readFile(path.join(migrationsDir, file), 'utf8')
  if (content.includes('supabase_realtime') && content.includes('public.samples')) {
    hasRealtimeSamplesMigration = true
    break
  }
}

assert.ok(
  hasRealtimeSamplesMigration,
  'Supabase migrations should enable Realtime publication for public.samples'
)

console.log('✓ manager approvals favicon badge wiring present')

// Regression test: client-actions route must wire approval actions from the approval-only module.
// Run with: node tests/results-approval-route-wiring.test.mjs

import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import path from 'node:path'

const routePath = path.join(process.cwd(), 'src', 'app', 'api', 'client-actions', 'route.ts')
const approvalActionsPath = path.join(process.cwd(), 'src', 'app', 'actions', 'results-approval.ts')

const [routeContent, approvalActionsContent] = await Promise.all([
  readFile(routePath, 'utf8'),
  readFile(approvalActionsPath, 'utf8').catch(() => ''),
])

assert.ok(
  routeContent.includes("from '@/app/actions/results-approval'"),
  'client-actions route should import approval actions from results-approval.ts'
)

assert.ok(
  /approveResults\s*:\s*async\s*\(/.test(routeContent) && /cancelApproval\s*:\s*async\s*\(/.test(routeContent),
  'client-actions route should expose approveResults and cancelApproval handlers'
)

assert.ok(
  approvalActionsContent.includes('export async function approveResults') &&
    approvalActionsContent.includes('export async function cancelApproval'),
  'results-approval.ts should export approveResults and cancelApproval'
)

console.log('✓ results approval route wiring present')

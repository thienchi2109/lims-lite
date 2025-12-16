// Regression test: Approval dialog refresh preserves approvals tab/selection query params.
// Run with: node tests/approval-dialog-refresh-preserves-query.test.mjs

import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import path from 'node:path'

const root = process.cwd()
const dialogPath = path.join(root, 'src', 'components', 'approval-dialog.tsx')
const dialogContent = await readFile(dialogPath, 'utf8')

assert.ok(
  dialogContent.includes('router.refresh()'),
  'ApprovalDialog should call router.refresh() after successful approve/cancel to re-fetch server components without dropping query params.'
)

assert.ok(
  !dialogContent.includes("'/manager/approvals'") && !dialogContent.includes('"/manager/approvals"'),
  'ApprovalDialog should not hardcode navigation to /manager/approvals, which drops tab/sampleId search params.'
)

assert.ok(
  !/router\.push\s*\(/.test(dialogContent),
  'ApprovalDialog should not use router.push() for refreshing, which can reset page state.'
)

console.log('✓ approval dialog refresh preserves approvals query state')

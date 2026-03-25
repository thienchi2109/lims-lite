// Regression test: ensure confidentiality fields are forwarded through the client-actions route.
// Run with: node tests/confidentiality-forwarding.test.mjs

import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import path from 'node:path'

const routePath = path.join(process.cwd(), 'src', 'app', 'api', 'client-actions', 'route.ts')
const content = await readFile(routePath, 'utf8')

const hasAssayConfidentialAppend = /createAssayDefinition:\s*async\s*\([\s\S]*?\)\s*=>\s*{[\s\S]*?formData\.append\(\s*['"]is_confidential['"]/.test(content)
const hasAssayUpdateConfidentialAppend = /updateAssayDefinition:\s*async\s*\([\s\S]*?\)\s*=>\s*{[\s\S]*?formData\.append\(\s*['"]is_confidential['"]/.test(content)

assert.ok(hasAssayConfidentialAppend, 'createAssayDefinition handler must append is_confidential')
assert.ok(hasAssayUpdateConfidentialAppend, 'updateAssayDefinition handler must append is_confidential')

console.log('✓ confidentiality fields are forwarded for assay actions')

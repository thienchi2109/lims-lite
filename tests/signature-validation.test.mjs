/**
 * Test: Signature schema timestamp validation strategy
 *
 * Validates that ActiveSignatureSchema and SignatureHistoryItemSchema
 * in src/types/workflow.ts use timestamp coercion for uploaded_at.
 * We intentionally use z.coerce.date() so PostgreSQL timestamptz strings
 * are accepted and normalized to Date.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

async function readWorkspaceFile(relativePath) {
    return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function extractSchema(content, schemaName, typeName) {
    const schemaStart = content.indexOf(`export const ${schemaName}`)
    assert.notEqual(schemaStart, -1, `${schemaName} not found`)

    const schemaEnd = content.indexOf(`export type ${typeName}`, schemaStart)
    assert.notEqual(schemaEnd, -1, `${typeName} not found`)

    return content.slice(schemaStart, schemaEnd)
}

test('ActiveSignatureSchema uses z.coerce.date() for uploaded_at', async () => {
    const content = await readWorkspaceFile('src/types/workflow.ts')
    const schemaContent = extractSchema(content, 'ActiveSignatureSchema', 'ActiveSignature')

    assert.match(schemaContent, /uploaded_at:\s*z\.coerce\.date\(\)/)
    assert.doesNotMatch(schemaContent, /uploaded_at:\s*z\.string\(\)\.datetime\(\)/)
})

test('SignatureHistoryItemSchema uses z.coerce.date() for uploaded_at', async () => {
    const content = await readWorkspaceFile('src/types/workflow.ts')
    const schemaContent = extractSchema(content, 'SignatureHistoryItemSchema', 'SignatureHistoryItem')

    assert.match(schemaContent, /uploaded_at:\s*z\.coerce\.date\(\)/)
    assert.doesNotMatch(schemaContent, /uploaded_at:\s*z\.string\(\)\.datetime\(\)/)
})

// Runtime coercion behavior is covered in integration/manual validation scripts.
// These tests verify source schema definitions stay aligned with that strategy.

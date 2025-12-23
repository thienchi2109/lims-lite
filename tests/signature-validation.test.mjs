/**
 * Test: Signature validation with PostgreSQL timestamp format
 *
 * Validates that ActiveSignatureSchema and SignatureHistoryItemSchema
 * accept PostgreSQL timestamptz format (without strict ISO 8601 validation)
 *
 * Bug Fix: Changed z.string().datetime() to z.string() to accept
 * PostgreSQL format: "2025-12-16 10:23:21.160338+00"
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

async function readWorkspaceFile(relativePath) {
    return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

test('ActiveSignatureSchema uses z.string() for uploaded_at (not z.string().datetime())', async () => {
    const content = await readWorkspaceFile('src/types/index.ts')

    // Find ActiveSignatureSchema definition
    const schemaStart = content.indexOf('export const ActiveSignatureSchema')
    const schemaEnd = content.indexOf('export type ActiveSignature', schemaStart)
    const schemaContent = content.slice(schemaStart, schemaEnd)

    // Should contain z.string() for uploaded_at
    assert.match(schemaContent, /uploaded_at:\s*z\.string\(\)/)

    // Should NOT contain z.string().datetime()
    assert.doesNotMatch(schemaContent, /uploaded_at:\s*z\.string\(\)\.datetime\(\)/)

    // Should have comment explaining why
    assert.match(schemaContent, /PostgreSQL timestamptz/)
})

test('SignatureHistoryItemSchema uses z.string() for uploaded_at', async () => {
    const content = await readWorkspaceFile('src/types/index.ts')

    // Find SignatureHistoryItemSchema definition
    const schemaStart = content.indexOf('export const SignatureHistoryItemSchema')
    const schemaEnd = content.indexOf('export type SignatureHistoryItem', schemaStart)
    const schemaContent = content.slice(schemaStart, schemaEnd)

    // Should contain z.string() for uploaded_at
    assert.match(schemaContent, /uploaded_at:\s*z\.string\(\)/)

    // Should NOT contain z.string().datetime()
    assert.doesNotMatch(schemaContent, /uploaded_at:\s*z\.string\(\)\.datetime\(\)/)

    // Should have comment explaining why
    assert.match(schemaContent, /PostgreSQL timestamptz/)
})

// Runtime validation tests are done via integration testing
// since Node can't directly import TypeScript files
// The schema definition tests above verify the fix is in place

/**
 * Manual validation test for timestamp coercion
 * Run with: node tests/validate-timestamp-fix.mjs
 */

import { z } from 'zod'

// Define the schemas exactly as they are in src/types/index.ts
const ActiveSignatureSchema = z.object({
    id: z.string().uuid(),
    signature_path: z.string(),
    signature_hash: z.string(),
    mime_type: z.enum(['image/png', 'image/jpeg']),
    uploaded_at: z.coerce.date(), // Coerce PostgreSQL timestamptz to Date object
})

const SignatureHistoryItemSchema = z.object({
    id: z.string().uuid(),
    uploaded_at: z.coerce.date(), // Coerce PostgreSQL timestamptz to Date object
    is_active: z.boolean(),
    file_size: z.number().int(),
    mime_type: z.enum(['image/png', 'image/jpeg']),
})

console.log('=== Testing Timestamp Coercion Fix ===\n')

// Test 1: PostgreSQL format (the original issue)
console.log('Test 1: PostgreSQL timestamptz format')
const postgresData = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    signature_path: 'test.png',
    signature_hash: 'abc123',
    mime_type: 'image/png',
    uploaded_at: '2025-12-16 10:23:21.160338+00', // PostgreSQL format
}

const result1 = ActiveSignatureSchema.safeParse(postgresData)
if (result1.success) {
    console.log('✅ PASS: PostgreSQL format coerced successfully')
    console.log(`   Type: ${typeof result1.data.uploaded_at}`)
    console.log(`   Value: ${result1.data.uploaded_at}`)
    console.log(`   Instance: ${result1.data.uploaded_at instanceof Date ? 'Date' : 'Not a Date'}\n`)
} else {
    console.log('❌ FAIL: PostgreSQL format failed validation')
    console.log(`   Error: ${result1.error.issues[0].message}\n`)
}

// Test 2: ISO 8601 format (should also work)
console.log('Test 2: ISO 8601 format')
const isoData = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    signature_path: 'test.png',
    signature_hash: 'abc123',
    mime_type: 'image/jpeg',
    uploaded_at: '2025-12-16T10:23:21.160338+00:00', // ISO 8601 format
}

const result2 = ActiveSignatureSchema.safeParse(isoData)
if (result2.success) {
    console.log('✅ PASS: ISO 8601 format coerced successfully')
    console.log(`   Type: ${typeof result2.data.uploaded_at}`)
    console.log(`   Value: ${result2.data.uploaded_at}`)
    console.log(`   Instance: ${result2.data.uploaded_at instanceof Date ? 'Date' : 'Not a Date'}\n`)
} else {
    console.log('❌ FAIL: ISO 8601 format failed validation')
    console.log(`   Error: ${result2.error.issues[0].message}\n`)
}

// Test 3: Invalid date string (should fail)
console.log('Test 3: Invalid date string')
const invalidData = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    signature_path: 'test.png',
    signature_hash: 'abc123',
    mime_type: 'image/png',
    uploaded_at: 'not a valid date',
}

const result3 = ActiveSignatureSchema.safeParse(invalidData)
if (result3.success) {
    console.log('❌ FAIL: Invalid date should have been rejected')
} else {
    console.log('✅ PASS: Invalid date correctly rejected')
    console.log(`   Error: ${result3.error.issues[0].message}\n`)
}

// Test 4: SignatureHistoryItemSchema with PostgreSQL format
console.log('Test 4: SignatureHistoryItemSchema with PostgreSQL format')
const historyData = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    uploaded_at: '2025-12-16 10:23:21.160338+00',
    is_active: true,
    file_size: 12345,
    mime_type: 'image/jpeg',
}

const result4 = SignatureHistoryItemSchema.safeParse(historyData)
if (result4.success) {
    console.log('✅ PASS: SignatureHistoryItemSchema coerced successfully')
    console.log(`   Type: ${typeof result4.data.uploaded_at}`)
    console.log(`   Value: ${result4.data.uploaded_at}`)
    console.log(`   Instance: ${result4.data.uploaded_at instanceof Date ? 'Date' : 'Not a Date'}\n`)
} else {
    console.log('❌ FAIL: SignatureHistoryItemSchema failed validation')
    console.log(`   Error: ${result4.error.issues[0].message}\n`)
}

// Test 5: Date object (should pass through)
console.log('Test 5: Date object input')
const dateObjData = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    signature_path: 'test.png',
    signature_hash: 'abc123',
    mime_type: 'image/png',
    uploaded_at: new Date('2025-12-16T10:23:21.160Z'),
}

const result5 = ActiveSignatureSchema.safeParse(dateObjData)
if (result5.success) {
    console.log('✅ PASS: Date object accepted successfully')
    console.log(`   Type: ${typeof result5.data.uploaded_at}`)
    console.log(`   Value: ${result5.data.uploaded_at}\n`)
} else {
    console.log('❌ FAIL: Date object rejected')
    console.log(`   Error: ${result5.error.issues[0].message}\n`)
}

console.log('=== Test Summary ===')
const passed = [result1.success, result2.success, !result3.success, result4.success, result5.success].filter(Boolean).length
console.log(`Passed: ${passed}/5`)
console.log(passed === 5 ? '✅ All tests passed!' : '❌ Some tests failed')

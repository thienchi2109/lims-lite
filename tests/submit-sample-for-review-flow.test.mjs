// Regression test: submit-sample-for-review flow
// - Server action must use an RPC (avoid silent RLS no-op updates)
// - CoA trigger must not reference non-existent sample_status value 'approved'
//
// Run with: node tests/submit-sample-for-review-flow.test.mjs

import { readFile, readdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
import path from 'node:path'

const samplesActionPath = path.join(process.cwd(), 'src', 'app', 'actions', 'samples.ts')
const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')

const [samplesActionContent, migrationFiles] = await Promise.all([
    readFile(samplesActionPath, 'utf8'),
    readdir(migrationsDir),
])

const submitStart = samplesActionContent.indexOf('export async function submitSampleForReview')
assert.ok(submitStart !== -1, 'submitSampleForReview action must exist')

const submitBlockAll = samplesActionContent.slice(submitStart)
const nextExportIndex = submitBlockAll.indexOf('export async function', 1)
const submitBlock = nextExportIndex === -1 ? submitBlockAll : submitBlockAll.slice(0, nextExportIndex)

assert.ok(
    submitBlock.includes("rpc('submit_sample_for_review'") ||
        submitBlock.includes('rpc("submit_sample_for_review"'),
    "submitSampleForReview must call submit_sample_for_review RPC (RLS can make UPDATE return 0 rows without error)"
)

const sqlFiles = migrationFiles.filter((file) => file.endsWith('.sql'))
const migrationsContent = await Promise.all(
    sqlFiles.map((file) => readFile(path.join(migrationsDir, file), 'utf8'))
)

const hasSubmitRpcMigration = migrationsContent.some((content) => {
    return (
        content.includes('submit_sample_for_review') &&
        /CREATE\s+OR\s+REPLACE\s+FUNCTION/i.test(content)
    )
})

assert.ok(
    hasSubmitRpcMigration,
    'Database migrations must define submit_sample_for_review() RPC'
)

const hasFixedCoaTrigger = migrationsContent.some((content) => {
    return (
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?trigger_generate_coa/i.test(content) &&
        content.includes("NEW.status = 'completed'")
    )
})

assert.ok(
    hasFixedCoaTrigger,
    "Database migrations must update trigger_generate_coa() to check status='completed' (not 'approved')"
)

console.log('✓ submit-sample-for-review flow guarded (RPC + CoA trigger fix present)')

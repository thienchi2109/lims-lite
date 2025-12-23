/**
 * Test: CoA Reports RLS Policy - Manager Update Permissions
 *
 * Validates that coa_reports_update_managers RLS policy allows
 * managers to update CoA records in ANY status, not just 'failed'
 *
 * Bug Fix: Migration 091 changed USING clause from:
 * "(get_user_role() = 'manager') AND (status = 'failed')"
 * to:
 * "(get_user_role() = 'manager')"
 *
 * This prevents PGRST116 errors when updating non-failed CoA records
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { execSync } from 'child_process'
import { readFile } from 'node:fs/promises'

// Helper to run SQL query
function runSQL(query) {
    const result = execSync(
        `docker exec lims-postgres psql -U postgres -d postgres -t -A -c "${query.replace(/"/g, '\\"')}"`,
        { encoding: 'utf-8' }
    )
    return result.trim()
}

async function readWorkspaceFile(relativePath) {
    return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

test('migration 091 file exists and contains correct policy', async () => {
    const content = await readWorkspaceFile('supabase/migrations/091_fix_coa_reports_update_policy.sql')

    // Should drop old policy
    assert.match(content, /DROP POLICY IF EXISTS "coa_reports_update_managers"/)

    // Should create new policy
    assert.match(content, /CREATE POLICY "coa_reports_update_managers"/)

    // USING clause should only check role, not status
    assert.match(content, /USING \(get_user_role\(\) = 'manager'::user_role\)/)

    // Should NOT restrict to status='failed' in USING clause
    const usingMatch = content.match(/USING \((.*?)\)/s)
    if (usingMatch) {
        const usingClause = usingMatch[1]
        assert.doesNotMatch(usingClause, /status\s*=\s*'failed'/)
    }

    // WITH CHECK should validate status transitions
    assert.match(content, /WITH CHECK/)
    assert.match(content, /status = ANY/)
    assert.match(content, /pending/)
    assert.match(content, /ready/)
    assert.match(content, /failed/)
})

test('coa_reports_update_managers policy exists in database', () => {
    const query = `
        SELECT COUNT(*) as count
        FROM pg_policy
        WHERE polrelid = 'public.coa_reports'::regclass
        AND polname = 'coa_reports_update_managers';
    `
    const count = runSQL(query)
    assert.equal(count, '1', 'Policy should exist in database')
})

test('USING clause allows managers to update any status', () => {
    const query = `
        SELECT pg_get_expr(polqual, polrelid) as using_clause
        FROM pg_policy
        WHERE polrelid = 'public.coa_reports'::regclass
        AND polname = 'coa_reports_update_managers';
    `
    const usingClause = runSQL(query)

    // Should only check role
    assert.match(usingClause, /get_user_role\(\) = 'manager'::user_role/)

    // Should NOT restrict by status
    assert.doesNotMatch(usingClause, /status\s*=\s*'failed'/)
    assert.doesNotMatch(usingClause, /AND\s+\(status/)
})

test('WITH CHECK clause validates status transitions', () => {
    const query = `
        SELECT pg_get_expr(polwithcheck, polrelid) as check_clause
        FROM pg_policy
        WHERE polrelid = 'public.coa_reports'::regclass
        AND polname = 'coa_reports_update_managers';
    `
    const checkClause = runSQL(query)

    // Should require manager role
    assert.match(checkClause, /get_user_role\(\) = 'manager'::user_role/)

    // Should validate status is one of: pending, ready, failed
    assert.match(checkClause, /status = ANY/)
    assert.match(checkClause, /pending/)
    assert.match(checkClause, /ready/)
    assert.match(checkClause, /failed/)
})

test('policy allows updating pending CoA to ready', () => {
    // The fix removes the status='failed' restriction from USING clause
    // This allows managers to update records in any status
    const query = `
        SELECT pg_get_expr(polqual, polrelid) as using_clause
        FROM pg_policy
        WHERE polrelid = 'public.coa_reports'::regclass
        AND polname = 'coa_reports_update_managers';
    `
    const usingClause = runSQL(query)

    // The USING clause determines which rows can be selected for UPDATE
    // It should NOT contain status restrictions
    const statusRestricted = usingClause.includes("status = 'failed'") ||
                            usingClause.includes("AND (status")

    assert.equal(statusRestricted, false, 'USING clause should not restrict by status')
})

test('policy still requires manager role for security', () => {
    const query = `
        SELECT
            pg_get_expr(polqual, polrelid) as using_clause,
            pg_get_expr(polwithcheck, polrelid) as check_clause
        FROM pg_policy
        WHERE polrelid = 'public.coa_reports'::regclass
        AND polname = 'coa_reports_update_managers';
    `
    const result = runSQL(query)
    const [usingClause, checkClause] = result.split('|')

    // Both clauses should require manager role
    assert.match(usingClause, /get_user_role\(\) = 'manager'::user_role/)
    assert.match(checkClause, /get_user_role\(\) = 'manager'::user_role/)
})

test('policy comment documents the change', () => {
    const query = `
        SELECT obj_description(oid) as comment
        FROM pg_policy
        WHERE polrelid = 'public.coa_reports'::regclass
        AND polname = 'coa_reports_update_managers';
    `
    const comment = runSQL(query)

    // Should have a comment explaining the policy
    assert.notEqual(comment, '', 'Policy should have a comment')
    assert.match(comment, /manager/i)
})

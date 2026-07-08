import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
    process.cwd(),
    'supabase/migrations/146_optimize_rls_initplan_policies.sql',
)

function readMigration() {
    return readFileSync(migrationPath, 'utf8')
}

describe('RLS init-plan policy migration', () => {
    it('adds a focused migration for Supabase auth_rls_initplan advisors', () => {
        expect(existsSync(migrationPath)).toBe(true)
    })

    it('wraps auth and role helper calls in SELECT init-plan expressions', () => {
        const migration = readMigration()

        expect(migration).toContain('user_id = (select auth.uid())')
        expect(migration).toContain('(select get_user_role()) = ANY')
        expect(migration).toContain("((select auth.jwt()) ->> 'role'::text) = 'service_role'::text")
        expect(migration).toContain('(select user_can_access_confidential())')
    })

    it('recreates only the seven auth_rls_initplan policies from the CSV', () => {
        const migration = readMigration()
        const createPolicyStatements = migration.match(/CREATE POLICY /g) || []

        expect(createPolicyStatements).toHaveLength(7)
        expect(migration).toContain('CREATE POLICY "Users can view own signatures"')
        expect(migration).toContain('CREATE POLICY "Users can insert own signatures"')
        expect(migration).toContain('CREATE POLICY "Users can update own signatures"')
        expect(migration).toContain('CREATE POLICY "Service role can read all signatures"')
        expect(migration).toContain('CREATE POLICY "Users can view submissions"')
        expect(migration).toContain('CREATE POLICY "Authenticated users can read results"')
        expect(migration).toContain('CREATE POLICY "Managers can read manager OTP settings"')
    })

    it('does not mix extension moves or permissive policy consolidation into the init-plan fix', () => {
        const migration = readMigration()

        expect(migration).not.toMatch(/ALTER EXTENSION/i)
        expect(migration).not.toMatch(/DROP POLICY IF EXISTS "Service role can read all signatures",/i)
        expect(migration).not.toMatch(/AS RESTRICTIVE/i)
    })

    it('scopes the service-role SELECT policy away from public roles', () => {
        const migration = readMigration()

        expect(migration).toMatch(
            /CREATE POLICY "Service role can read all signatures"[\s\S]+?FOR SELECT[\s\S]+?TO service_role/,
        )
    })
})

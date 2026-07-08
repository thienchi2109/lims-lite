import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationPath = join(
    process.cwd(),
    'supabase/migrations/145_pin_linted_function_search_paths.sql',
)

function readMigration() {
    return readFileSync(migrationPath, 'utf8')
}

describe('function search_path lint migration', () => {
    it('pins the 33 Supabase-linted functions to public search_path', () => {
        const migration = readMigration()
        const alterStatements = migration.match(/ALTER FUNCTION public\.[^;]+ SET search_path = public;/g) || []

        expect(alterStatements).toHaveLength(33)
        expect(alterStatements).toContain(
            'ALTER FUNCTION public.calculate_average_tat(timestamp with time zone, timestamp with time zone) SET search_path = public;',
        )
        expect(alterStatements).toContain(
            'ALTER FUNCTION public.global_search(text, integer) SET search_path = public;',
        )
        expect(alterStatements).toContain(
            'ALTER FUNCTION public.update_search_vector_samples() SET search_path = public;',
        )
    })

    it('does not mix extension moves or RLS policy rewrites into the quick fix', () => {
        const migration = readMigration()

        expect(migration).not.toMatch(/ALTER EXTENSION/i)
        expect(migration).not.toMatch(/DROP POLICY|CREATE POLICY|ALTER POLICY/i)
    })
})

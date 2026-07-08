import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
    process.cwd(),
    'supabase/migrations/147_add_assay_reference_range_to_rpcs.sql',
)

function readMigration() {
    return readFileSync(migrationPath, 'utf8')
}

describe('assay reference range RPC migration', () => {
    it('adds a focused migration for assay reference range RPC contracts', () => {
        expect(existsSync(migrationPath)).toBe(true)
    })

    it('returns normal_range from both assay definition RPCs', () => {
        const migration = readMigration()

        expect(migration).toMatch(/CREATE FUNCTION public\.get_assay_definitions[\s\S]+?normal_range text/)
        expect(migration).toMatch(/CREATE FUNCTION public\.get_assay_definitions[\s\S]+?ad\.normal_range/)
        expect(migration).toMatch(/CREATE FUNCTION public\.get_assay_definition_by_id[\s\S]+?normal_range text/)
        expect(migration).toMatch(/CREATE FUNCTION public\.get_assay_definition_by_id[\s\S]+?ad\.normal_range/)
    })

    it('preserves security definer RPC grants and search_path patterns', () => {
        const migration = readMigration()

        expect(migration.match(/^SECURITY DEFINER$/gm)).toHaveLength(2)
        expect(migration.match(/^SET search_path = public$/gm)).toHaveLength(2)
        expect(migration).toContain(
            'REVOKE ALL ON FUNCTION public.get_assay_definitions(text, uuid, uuid, int, int) FROM PUBLIC, anon, authenticated, service_role;',
        )
        expect(migration).toContain(
            'GRANT EXECUTE ON FUNCTION public.get_assay_definitions(text, uuid, uuid, int, int) TO authenticated;',
        )
        expect(migration).toContain(
            'REVOKE ALL ON FUNCTION public.get_assay_definition_by_id(uuid) FROM PUBLIC, anon, authenticated, service_role;',
        )
        expect(migration).toContain(
            'GRANT EXECUTE ON FUNCTION public.get_assay_definition_by_id(uuid) TO authenticated;',
        )
    })
})

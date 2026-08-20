import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
    process.cwd(),
    'supabase/migrations/202_extend_assay_import_code_rpc_contracts.sql',
)

function readMigration() {
    return readFileSync(migrationPath, 'utf8')
}

function getFunctionBlock(migration: string, functionName: string) {
    const startMarker = `CREATE FUNCTION public.${functionName}`
    const endMarker = `REVOKE ALL ON FUNCTION public.${functionName}`
    const start = migration.indexOf(startMarker)
    const end = migration.indexOf(endMarker, start)

    expect(start).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(start)

    return migration.slice(start, end)
}

function getReturnShape(functionBlock: string) {
    const match = functionBlock.match(/RETURNS TABLE \(([\s\S]*?)\)\nLANGUAGE/)
    expect(match).not.toBeNull()

    return match![1]
        .split('\n')
        .map((line) => line.trim().replace(/,$/, ''))
        .filter(Boolean)
}

function expectFragmentsInOrder(source: string, fragments: string[]) {
    let cursor = 0

    for (const fragment of fragments) {
        const index = source.indexOf(fragment, cursor)
        expect(index, `Missing ordered fragment: ${fragment}`).toBeGreaterThanOrEqual(cursor)
        cursor = index + fragment.length
    }
}

describe('stable assay import code RPC migration', () => {
    it('adds a separate forward-only migration after migration 201', () => {
        expect(existsSync(migrationPath)).toBe(true)
    })

    it('requires the immutable import-code database core from migration 201', () => {
        const migration = readMigration()

        expect(migration).toContain("column_name = 'import_code'")
        expect(migration).toContain("data_type = 'text'")
        expect(migration).toContain("is_nullable = 'NO'")
        expect(migration).toContain("tgname = 'assay_definitions_import_code_immutable'")
    })

    it('returns import_code from list and detail RPCs', () => {
        const migration = readMigration()

        expect(migration).toMatch(
            /CREATE FUNCTION public\.get_assay_definitions[\s\S]+?import_code text[\s\S]+?ad\.import_code/,
        )
        expect(migration).toMatch(
            /CREATE FUNCTION public\.get_assay_definition_by_id[\s\S]+?import_code text[\s\S]+?ad\.import_code/,
        )
    })

    it('locks the complete ordered list and detail row shapes', () => {
        const migration = readMigration()
        const listFunction = getFunctionBlock(migration, 'get_assay_definitions')
        const detailFunction = getFunctionBlock(migration, 'get_assay_definition_by_id')

        expect(getReturnShape(listFunction)).toEqual([
            'id uuid',
            'import_code text',
            'name text',
            'specialty_id uuid',
            'specialty_name text',
            'specialty_order int',
            'units text',
            'method_name text',
            'normal_range text',
            'validation_rules jsonb',
            'is_confidential boolean',
            'methods jsonb',
            'created_at timestamptz',
            'updated_at timestamptz',
            'total_count bigint',
        ])
        expect(getReturnShape(detailFunction)).toEqual([
            'id uuid',
            'import_code text',
            'name text',
            'specialty_id uuid',
            'units text',
            'method_name text',
            'normal_range text',
            'validation_rules jsonb',
            'is_confidential boolean',
            'methods jsonb',
            'created_at timestamptz',
            'updated_at timestamptz',
        ])

        const listProjection = listFunction.match(
            /SELECT\s+p\.id,[\s\S]*?FROM paginated p;/,
        )?.[0]
        const detailProjection = detailFunction.match(
            /RETURN QUERY\s+SELECT[\s\S]*?FROM public\.assay_definitions ad/,
        )?.[0]

        expect(listProjection).toBeDefined()
        expect(detailProjection).toBeDefined()
        expectFragmentsInOrder(listProjection!, [
            'p.id',
            'p.import_code',
            'p.name',
            'p.specialty_id',
            'p.specialty_name',
            'p.specialty_order',
            'p.units',
            'p.method_name',
            'p.normal_range',
            'p.validation_rules',
            'p.is_confidential',
            'AS methods',
            'p.created_at',
            'p.updated_at',
            'AS total_count',
        ])
        expectFragmentsInOrder(detailProjection!, [
            'ad.id',
            'ad.import_code',
            'ad.name',
            'ad.specialty_id',
            'ad.units',
            'ad.method_name',
            'ad.normal_range',
            'ad.validation_rules',
            'ad.is_confidential',
            'AS methods',
            'ad.created_at',
            'ad.updated_at',
        ])
    })

    it('preserves list pagination and filters without restoring method_id output', () => {
        const migration = readMigration()

        expect(migration).toContain('p_search text DEFAULT NULL')
        expect(migration).toContain('p_method_id uuid DEFAULT NULL')
        expect(migration).toContain('p_specialty_id uuid DEFAULT NULL')
        expect(migration).toContain('p_page int DEFAULT 1')
        expect(migration).toContain('p_page_size int DEFAULT 10')
        expect(migration).toContain('v_offset := (p_page - 1) * p_page_size')
        expect(migration).toContain('LIMIT p_page_size')
        expect(migration).toContain('OFFSET v_offset')
        expect(migration).not.toMatch(/\n\s+method_id uuid,\n/)
    })

    it('preserves security definer, search_path, and execute grants', () => {
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
        expect(migration).not.toMatch(/\b(CREATE|ALTER|DROP) POLICY\b/)
    })
})

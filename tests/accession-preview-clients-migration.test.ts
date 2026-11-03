// SOURCE ONLY: these guards inspect migration contracts; retained SQL tests prove behavior later.
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = resolve('supabase/migrations/233_add_accession_preview_client_resolution.sql')
const sql = () => {
    expect(existsSync(migration), 'Phase 1 read-only canonical SQL bridge migration must exist').toBe(true)
    return readFileSync(migration, 'utf8')
}

describe('accession preview client bridge migration source contract', () => {
    it('uses analyst-only canonical SQL authority without changing public resolver policy', () => {
        const source = sql()
        expect(source).toMatch(/CREATE FUNCTION public\.resolve_accession_preview_clients_v1\(p_clients JSONB\)/)
        expect(source).toMatch(/STABLE\s+SECURITY DEFINER\s+SET search_path = public, pg_temp/)
        expect(source).toContain("get_user_role() IS DISTINCT FROM 'analyst'")
        for (const helper of ['normalize_client_name_v1', 'normalize_client_phone_v1', 'fold_client_name_accents_v1', 'resolve_client_identity_internal_v2', 'is_client_collision_confirmed_distinct_v1']) expect(source).toContain(`public.${helper}`)
        expect(source).not.toMatch(/(?:INSERT INTO|UPDATE|DELETE FROM|TRUNCATE) public\.(?:clients|samples|results|audit_logs)\b/i)
        expect(source).not.toMatch(/(?:CREATE|REPLACE) FUNCTION public\.resolve_client_identity_(?:internal_)?v2\s*\(/i)
        expect(source).not.toMatch(/resolve_or_create|CREATE TEMP|CROSS JOIN.*(?:input|normalized|resolved)/i)
    })

    it('closes default grants, validates baseline and registers security coverage', () => {
        const source = sql()
        expect(source).toContain('to_regprocedure')
        expect(source).toMatch(/REVOKE ALL ON FUNCTION public\.resolve_accession_preview_clients_v1\(JSONB\)\s+FROM PUBLIC, anon, authenticated, service_role/)
        expect(source).toMatch(/GRANT EXECUTE ON FUNCTION public\.resolve_accession_preview_clients_v1\(JSONB\) TO authenticated/)
        expect(source).toContain('test_accession_preview_client_resolution_security')
        expect(source).toContain('run_security_tests')
        expect(source).toContain('provolatile')
    })

    it('retains grouped candidate guards, bounded error representatives and strict JSON boundary', () => {
        const source = sql()
        expect(source).toContain('jsonb_object_keys')
        expect(source).toContain('jsonb_typeof')
        expect(source).toMatch(/GROUP BY/)
        expect(source).toContain('CLIENT_DUPLICATE')
        expect(source).toContain('CLIENT_CONFLICT')
        expect(source).toContain('government_identity_trusted')
        expect(source).toContain('accent_only_conflict')
        expect(source).toContain('cross_key_conflict')
        expect(source).not.toMatch(/jsonb_array_length\(p_clients\)\s*>\s*\d+/)
    })
})

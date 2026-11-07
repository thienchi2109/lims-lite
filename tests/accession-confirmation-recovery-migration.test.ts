// Source recovery contract; PostgreSQL compilation and existing SQL fixtures remain runtime gates.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readMigration = (name: string) => readFileSync(`supabase/migrations/${name}`, 'utf8')
const path = 'supabase/migrations/238_recover_atomic_accession_confirmation.sql'
const recovery = existsSync(path) ? readFileSync(path, 'utf8') : ''
const historicalBody = (name: string) => {
    const sql = readMigration(name)
    return sql.slice(sql.indexOf('DO $baseline$'), sql.lastIndexOf('COMMIT;')).trim()
}

describe('atomic accession recovery migration', () => {
    it('keeps every historical migration byte-for-byte immutable', () => {
        const hashes = {
            '233_add_accession_preview_client_resolution.sql': 'fc895bc7c2ea1976b80f145263a3e8dd7d672fe443f29650905473c2741254dc',
            '234_add_accession_preview_commitment.sql': 'a4bb16cb004da4799c3084734a02f3eb3fbbb5904311c5ee0661ac5ff0a9ff53',
            '235_add_accession_import_provenance.sql': 'afd069b663bee98feed3d9ea33d9654a3fe52e3bc38c054cd4c354259f67ceaa',
            '236_add_accession_confirmation_validation.sql': 'c1e804b0f1293304c0650d7036a3c279d2c4f938cd80a22f270de571a2417803',
            '237_add_atomic_accession_confirmation.sql': '07ab7ea28b1c2cb292ce679f94ecd893161ec10748c20964c60e070a4d6a2835',
            '238_recover_atomic_accession_confirmation.sql': '17549f4d2b47dc000f8b429da4549e0d8cafe35d4049114295689351e93f8063',
            '239_fix_accession_confirmation_result_audit.sql': '7f04734df82d050a9a46e2b2a03f88325657b57d7a82a2e7158758bacbc1d87b',
            '240_add_accession_confirmation_status.sql': 'e7cfb095980be3648d667f6ccf49deb368a2acabb886a508aeb99bb88046276a',
            '241_guard_accession_preview_retry.sql': '3d72f86e0fce39ed675d28f5b40666ecbe1b2146962cc9ca99b9014540d4e02a',
            '242_add_accession_import_maintenance.sql': 'dd25dc0ed8dca987c22d97ea1532d209e43ae742111a1453b472fa7aa7156e82',
            '243_recover_accession_import_maintenance.sql': '04a633641e54f830ee980e9af9c752f6a3e4edcce76aea4739359e67c790d6bf',
        }
        for (const [name, hash] of Object.entries(hashes)) {
            expect(createHash('sha256').update(readMigration(name)).digest('hex')).toBe(hash)
        }
    })

    it('recovers the original validation and atomic definitions with only the confirmed parser fix', () => {
        const condition = "CASE v_kind WHEN 'clients' THEN 'Khách hàng' WHEN 'samples' THEN 'Mẫu' ELSE 'Chỉ định' END"
        const validation = historicalBody('236_add_accession_confirmation_validation.sql')
            .replace(`IS DISTINCT FROM ${condition}`, `IS DISTINCT FROM (${condition})`)
        const atomic = historicalBody('237_add_atomic_accession_confirmation.sql')
        expect(recovery).toContain(validation)
        expect(recovery).toContain(atomic)
        expect(recovery.indexOf(validation)).toBeLessThan(recovery.indexOf(atomic))
    })

    it('requires the proven 235 baseline and checked function bodies in one transaction', () => {
        expect(recovery).toContain('Migration 238 supports only the verified 235 baseline')
        expect(recovery).toContain("current_setting('check_function_bodies')::BOOLEAN IS DISTINCT FROM TRUE")
        expect(recovery).toContain('c59214d857dc91923ce41480901925267d20035cb1c988a3d9ddff2464ac3a8b')
        expect(recovery).toContain('b1050737434de758c3dd4d57382176807cfe7ee06d7b1f6448d8a3702333587d')
        expect(recovery.match(/^BEGIN;$/gm)).toHaveLength(1)
        expect(recovery.match(/^COMMIT;$/gm)).toHaveLength(1)
        expect(recovery).not.toMatch(/check_function_bodies\s*=\s*(off|false)|^\\i[mr]?\b|pg_read_file|ALTER ROLE/gim)
    })

    it('forward-corrects only the exact full-row result audit selection after 238', () => {
        const name = '239_fix_accession_confirmation_result_audit.sql'
        const sql = existsSync(`supabase/migrations/${name}`) ? readMigration(name) : ''
        const original = readMigration('238_recover_atomic_accession_confirmation.sql')
            .match(/CREATE FUNCTION public\.confirm_accession_import\([^]*?\n\$\$;/)?.[0] ?? ''
        expect(original).not.toBe('')
        const statement = "SELECT id INTO STRICT v_audit FROM public.audit_logs WHERE table_name='results' AND record_id=v_result AND operation='INSERT' AND changed_by=p_actor;"
        const expected = original.replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION')
            .replace(statement, `${statement.slice(0, -1)} AND new_values->>'id'=v_result::TEXT;`)
        expect(sql).toContain(expected)
        expect(sql).toContain('53c657c987d434435783652def29b185959c0d1df2629b6472333689e79c57c7')
        expect(sql).toContain("current_setting('check_function_bodies')::BOOLEAN IS DISTINCT FROM TRUE")
        expect(sql).not.toMatch(/DROP TRIGGER|DISABLE TRIGGER|LIMIT 1/)
    })

    it('forward-preserves bigint generation strings at both SQL reconstruction boundaries', () => {
        const sql = readMigration('244_preserve_accession_binding_generation_strings.sql')
        expect(sql).toContain("v_old CONSTANT TEXT := 'kind,row_number,parent_row,import_code,entity_id,generation,method_name'")
        expect(sql).toContain("v_new CONSTANT TEXT := 'kind,row_number,parent_row,import_code,entity_id,generation::TEXT,method_name'")
        for (const signature of ['get_accession_confirmation_preparation(uuid,uuid)',
            'validate_accession_confirmation_locked(uuid,uuid,boolean,jsonb,jsonb,jsonb,jsonb,text,text,jsonb)']) expect(sql).toContain(signature)
        for (const hash of ['6828b035ae787c10d107d4b11a8b67591f2d13ad04f56f6f9eb0e63dba5ac2e7',
            'c5e0411b0b48cd08dfde6848dabea84d5fc763080d0069399561c2ebf96bc30a',
            '6df2835d7d192c358af8d54c096eee1ed1d767c6b0808f9d1608ddb153173f37',
            'f6ac7d81a78ea6414e7061921516039a72ed71292d3173286d2300c39972f4fd']) expect(sql).toContain(hash)
        expect(sql).toContain('public.test_accession_import_maintenance_security()')
        expect(sql).toContain('public.run_security_tests()')
        expect(sql).not.toMatch(/UPDATE|INSERT INTO|DELETE FROM|ALTER (?:TABLE|ROLE)|GRANT |REVOKE /)
        const fixture = readFileSync('tests/accession-confirmation-validation.sql', 'utf8')
        expect(fixture).toContain('protected reader preserves app binding bytes and bigint generation strings')
        expect(fixture).not.toContain("(v_type->>'compatibilityGeneration')::BIGINT")
        expect(fixture).not.toContain("(v_assay->>'compatibilityGeneration')::BIGINT")
    })
})

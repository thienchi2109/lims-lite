import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
    process.cwd(),
    'supabase/migrations/215_add_client_canonical_foundation.sql',
)
const rollbackTestPath = join(
    process.cwd(),
    'tests/client-canonical-foundation.test.sql',
)

function readFile(path: string) {
    return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

function normalizeSql(sql: string) {
    return sql
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/--.*$/gm, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .trim()
}

describe('client canonical foundation migration', () => {
    it('fails closed on an incompatible or partially-applied baseline', () => {
        const migration = readFile(migrationPath)
        const normalized = normalizeSql(migration)

        expect(existsSync(migrationPath)).toBe(true)
        expect(migration).toContain('Security impact:')
        expect(migration).toContain('Historical data impact:')
        expect(normalized).toMatch(/^BEGIN;/i)
        expect(normalized).toMatch(/COMMIT;$/i)
        expect(normalized).toContain(
            'LOCK TABLE public.clients IN ACCESS EXCLUSIVE MODE',
        )
        expect(normalized).toContain(
            "to_regprocedure('public.trigger_audit_log()') IS NULL",
        )
        expect(normalized).toContain(
            "to_regprocedure('public.update_updated_at_column()') IS NULL",
        )
        expect(normalized).toContain(
            "tgname = 'audit_clients_changes'",
        )
        expect(normalized).toContain(
            "tgname = 'clients_search_update'",
        )
        expect(normalized).toContain(
            "tgname = 'update_clients_updated_at'",
        )
        expect(normalized).toMatch(
            /found a partial client canonical foundation/i,
        )
        expect(normalized).toContain(
            "current_setting('server_version_num')::INTEGER <> 150001",
        )
        expect(normalized).toContain(
            "collversion IS NOT DISTINCT FROM '153.14'",
        )
        expect(normalized).toContain(
            "pg_collation_actual_version(oid) IS NOT DISTINCT FROM '153.14'",
        )
    })

    it('adds only nullable canonical and lifecycle foundation columns', () => {
        const normalized = normalizeSql(readFile(migrationPath))

        expect(normalized).toMatch(
            /ALTER TABLE public\.clients ADD COLUMN government_identity_type TEXT, ADD COLUMN government_identity_value TEXT, ADD COLUMN government_identity_trusted BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN normalized_name TEXT, ADD COLUMN normalized_phone TEXT, ADD COLUMN deleted_at TIMESTAMPTZ, ADD COLUMN deleted_by UUID, ADD COLUMN deletion_reason TEXT/i,
        )
        expect(normalized).toContain(
            'CONSTRAINT clients_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE RESTRICT',
        )
        expect(normalized).toContain(
            'CONSTRAINT clients_government_identity_projection_check CHECK',
        )
        expect(normalized).toContain(
            'CONSTRAINT clients_soft_delete_audit_check CHECK',
        )
        expect(normalized).not.toMatch(
            /ALTER COLUMN (?:normalized_name|normalized_phone|government_identity_type|government_identity_value|deleted_at|deleted_by|deletion_reason) SET NOT NULL/i,
        )
    })

    it('locks versioned PostgreSQL normalization and Vietnamese fixtures', () => {
        const normalized = normalizeSql(readFile(migrationPath))

        expect(normalized).toMatch(
            /CREATE FUNCTION public\.normalize_client_name_v1\(p_name TEXT\) RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path = pg_catalog/i,
        )
        expect(normalized).toContain(
            'btrim(normalize(p_name, NFC))',
        )
        expect(normalized).toContain(
            "regexp_replace(btrim(normalize(p_name, NFC)), '[[:space:]]+', ' ', 'g')",
        )
        expect(normalized).toContain(
            'COLLATE "und-x-icu"',
        )
        expect(normalized).toMatch(
            /CREATE FUNCTION public\.normalize_client_phone_v1\(p_phone TEXT\) RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path = pg_catalog/i,
        )
        expect(normalized).toMatch(
            /CREATE FUNCTION public\.normalize_client_government_identity_v1\(p_value TEXT\) RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path = pg_catalog/i,
        )
        expect(normalized).toMatch(
            /CREATE FUNCTION public\.classify_client_government_identity_v1\(p_value TEXT\) RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path = pg_catalog/i,
        )
        expect(normalized).toContain('client-normalization-v1')
        expect(normalized).toContain("normalize('Nguyễn Văn A', NFD)")
        expect(normalized).toContain("'nguyễn văn a'")
        expect(normalized).toContain("'Nguyen Van A'")
    })

    it('derives projections for every future legacy insert and update', () => {
        const normalized = normalizeSql(readFile(migrationPath))

        expect(normalized).toMatch(
            /CREATE FUNCTION public\.maintain_client_identity_projections\(\) RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp/i,
        )
        expect(normalized).toContain(
            'NEW.normalized_name := public.normalize_client_name_v1(NEW.name)',
        )
        expect(normalized).toContain(
            'NEW.normalized_phone := public.normalize_client_phone_v1(NEW.phone)',
        )
        expect(normalized).toContain(
            'NEW.government_identity_value := public.normalize_client_government_identity_v1(NEW.id_card_num)',
        )
        expect(normalized).toContain(
            'NEW.government_identity_trusted := NEW.government_identity_value IS NOT NULL',
        )
        expect(normalized).toMatch(
            /CREATE TRIGGER clients_maintain_identity_projections BEFORE INSERT OR UPDATE ON public\.clients FOR EACH ROW EXECUTE FUNCTION public\.maintain_client_identity_projections\(\)/i,
        )
        expect(normalized).not.toMatch(
            /UPDATE public\.clients SET (?:normalized_name|normalized_phone|government_identity)/i,
        )
    })

    it('adds non-unique candidate indexes without changing legacy workflow', () => {
        const normalized = normalizeSql(readFile(migrationPath))

        expect(normalized).toMatch(
            /CREATE INDEX idx_clients_normalized_name_dob ON public\.clients \(normalized_name, date_of_birth\) WHERE deleted_at IS NULL AND normalized_name IS NOT NULL/i,
        )
        expect(normalized).toMatch(
            /CREATE INDEX idx_clients_normalized_phone ON public\.clients \(normalized_phone\) WHERE deleted_at IS NULL AND normalized_phone IS NOT NULL/i,
        )
        expect(normalized).toMatch(
            /CREATE INDEX idx_clients_government_identity_candidate ON public\.clients \(government_identity_type, government_identity_value\) WHERE government_identity_trusted AND government_identity_value IS NOT NULL/i,
        )
        expect(normalized).not.toMatch(
            /CREATE UNIQUE INDEX idx_clients_(?:normalized|government)/i,
        )
        expect(normalized).not.toContain(
            'DROP CONSTRAINT clients_unique_identity',
        )
        expect(normalized).not.toMatch(/DROP POLICY|CREATE POLICY/i)
        expect(normalized).not.toMatch(
            /REVOKE (?:DELETE|INSERT|SELECT|UPDATE) ON (?:TABLE )?public\.clients/i,
        )
        expect(normalized).not.toMatch(
            /CREATE(?: OR REPLACE)? FUNCTION public\.(?:resolve|deactivate|restore|adjudicate)_client/i,
        )
    })

    it('keeps helper functions private and verifies exact postconditions', () => {
        const migration = readFile(migrationPath)
        const normalized = normalizeSql(migration)

        for (const functionName of [
            'normalize_client_name_v1',
            'normalize_client_phone_v1',
            'normalize_client_government_identity_v1',
            'classify_client_government_identity_v1',
            'maintain_client_identity_projections',
        ]) {
            expect(normalized).toMatch(
                new RegExp(
                    `REVOKE ALL ON FUNCTION public\\.${functionName}\\([^;]*\\) FROM PUBLIC, anon, authenticated, service_role`,
                    'i',
                ),
            )
        }
        expect(normalized).toContain(
            "tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE",
        )
        expect(normalized).toContain(
            "tgfoid = 'public.update_updated_at_column()'::REGPROCEDURE",
        )
        expect(normalized).toContain(
            "tgfoid = 'public.update_search_vector_clients()'::REGPROCEDURE",
        )
        expect(normalized).toContain('expected_client_policy_contract')
        expect(migration).toContain("'Authenticated users can read clients'")
        expect(migration).toContain(
            "'(( SELECT auth.uid() AS uid) IS NOT NULL)'",
        )
        expect(migration).toContain("'Analysts can create clients'")
        expect(migration).toContain(
            "'(get_user_role() = ANY (ARRAY[''analyst''::user_role, ''manager''::user_role]))'",
        )
        expect(normalized).toContain('pg_get_expr(polqual, polrelid)')
        expect(normalized).toContain('pg_get_expr(polwithcheck, polrelid)')
        expect(normalized).toContain('authenticated=arwdDxt/postgres')
        expect(normalized).toContain('anon=r/postgres')
        expect(normalized).toContain('service_role=r/postgres')
        expect(normalized).toMatch(
            /existing client rows were unexpectedly classified/i,
        )
    })

    it('ships a rollback-only SQL suite for runtime non-regression', () => {
        const sql = normalizeSql(readFile(rollbackTestPath))

        expect(existsSync(rollbackTestPath)).toBe(true)
        expect(sql).toMatch(/^BEGIN;/i)
        expect(sql).toMatch(/ROLLBACK;$/i)
        expect(sql).toContain("SET LOCAL statement_timeout = '30s'")
        expect(sql).toContain("SET LOCAL temp_file_limit = '64MB'")
        expect(sql).toContain('SET LOCAL max_parallel_workers_per_gather = 0')
        expect(sql).not.toMatch(/\bgenerate_series\s*\(/i)
        expect(sql.match(/FOR v_attempt IN 1\.\.100 LOOP/gi)).toHaveLength(4)
        expect(sql).toContain('client-normalization-v1')
        expect(sql).toContain('clients_maintain_identity_projections')
        expect(sql).toContain('audit_clients_changes')
        expect(sql).toContain('clients_unique_identity')
        expect(sql).toContain('idx_clients_unique_phone')
        expect(sql).toContain('SET LOCAL ROLE authenticated')
        expect(sql).toContain('SET LOCAL ROLE anon')
        expect(sql).toContain('public.user_can_access_confidential()')
        expect(sql).toContain('Legacy direct client caller contract changed')
        expect(sql).toContain('changed_by')
        expect(sql).toContain(
            "current_setting('server_version_num')::INTEGER <> 150001",
        )
        expect(sql).toContain('Analyst client INSERT policy changed')
        expect(sql).toContain('Manager client DELETE policy changed')
        expect(sql).toContain('Anonymous client reads no longer fail closed')
        expect(sql).toContain('has_function_privilege')
        expect(sql).toContain('row_security')
    })
})

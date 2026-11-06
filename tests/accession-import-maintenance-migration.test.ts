// SOURCE ONLY: SQL structure and retained scenarios are not executed database evidence.
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/242_add_accession_import_maintenance.sql'
const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : ''

describe('forward-only accession maintenance source boundary', () => {
    it('adds a separately numbered maintenance migration', () => {
        expect(existsSync(migrationPath)).toBe(true)
    })
    it('exposes only a narrowly granted backend maintenance RPC with actual caller-role checks', () => {
        const sql = read(migrationPath)
        expect(sql).toContain('public.maintain_accession_import_once()')
        expect(sql).toContain('accession_maintenance_worker')
        expect(sql).toContain('NOINHERIT')
        expect(sql).toContain('NOBYPASSRLS')
        expect(sql).toContain('session_user')
        expect(sql).toMatch(/current_setting\('role',\s*true\)/)
        expect(sql).toContain('SECURITY DEFINER SET search_path = public, pg_temp')
        expect(sql).toContain('FROM PUBLIC, anon, authenticated, service_role')
        expect(sql).not.toMatch(/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE)[\s\S]{0,100}TO accession_maintenance_worker/i)
        expect(sql).not.toMatch(/GRANT service_role TO accession_maintenance_worker/i)
    })
    it('selects and reconciles current eligible state under a non-stealing batch lock', () => {
        const sql = read(migrationPath)
        expect(sql).toMatch(/FOR UPDATE(?: OF \w+)? SKIP LOCKED/)
        expect(sql).toContain('lease_generation')
        expect(sql).toContain('lease_expires_at')
        expect(sql).toContain('clock_timestamp()')
        expect(sql).toContain('public.accession_import_receipts')
        expect(sql).toContain("'failed'")
        expect(sql).toContain("'expired'")
        expect(sql).not.toMatch(/(?:PERFORM|SELECT)\s+public\.confirm_accession_import\s*\(/i)
    })
    it('deletes only transient bindings and preserves all durable import records', () => {
        const sql = read(migrationPath)
        expect(sql).toMatch(/DELETE FROM public\.accession_preview_bindings/)
        expect(sql).not.toMatch(/DELETE FROM public\.(?:accession_preview_batches|accession_import_receipts|accession_import_dedup_claims|accession_import_mappings|audit_logs|clients|samples|results)\b/i)
        expect(sql).not.toMatch(/DISABLE TRIGGER|DISABLE ROW LEVEL SECURITY|session_replication_role/i)
        expect(sql).toContain('public.audit_logs')
        expect(sql).toContain('purgedBindings')
    })
    it('registers an executable security check without dropping earlier security coverage', () => {
        const sql = read(migrationPath)
        expect(sql).toContain('test_accession_import_maintenance_security()')
        expect(sql).toContain('test_accession_preview_retry_security()')
        expect(sql).toContain('public.run_security_tests()')
        expect(sql).toContain('has_table_privilege')
        expect(sql).toContain('has_function_privilege')
    })
    it('applies unique baseline-bound changes while preserving all other guard and status bytes', () => {
        const sql = read(migrationPath)
        const replacements = [...sql.matchAll(/replace\(v_definition,\$old\$([\s\S]*?)\$old\$\s*,\s*\$new\$([\s\S]*?)\$new\$\)/g)]
        expect(replacements).toHaveLength(4)
        for (const [file, name, start, end] of [
            ['238_recover_atomic_accession_confirmation.sql', 'guard_accession_preview_mutation', 0, 3],
            ['240_add_accession_confirmation_status.sql', 'get_accession_import_status', 3, 4],
        ] as const) {
            let body = read(`supabase/migrations/${file}`).split(`FUNCTION public.${name}`)[1]?.split('AS $$')[1]?.split('$$;')[0] ?? ''
            expect(body).not.toBe('')
            expect(sql).toContain(createHash('sha256').update(body).digest('hex'))
            for (const replacement of replacements.slice(start, end)) {
                expect(body.split(replacement[1])).toHaveLength(2)
                body = body.replace(replacement[1], replacement[2])
            }
            expect(sql).toContain(createHash('sha256').update(body).digest('hex'))
        }
    })
    it('keeps purge capability private, transactional, role-bound and removed after cleanup', () => {
        const sql = read(migrationPath)
        expect(sql).toContain('transaction_id xid8 NOT NULL')
        expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
        expect(sql).toContain('transaction_id=pg_current_xact_id() AND batch_id=OLD.batch_id')
        const lock = sql.indexOf('LIMIT 1 FOR UPDATE SKIP LOCKED')
        const authorize = sql.indexOf('INSERT INTO public.accession_import_maintenance_authorizations')
        const purge = sql.indexOf('DELETE FROM public.accession_preview_bindings')
        const revoke = sql.indexOf('DELETE FROM public.accession_import_maintenance_authorizations')
        expect(lock).toBeGreaterThan(0)
        expect(authorize).toBeGreaterThan(lock)
        expect(purge).toBeGreaterThan(authorize)
        expect(revoke).toBeGreaterThan(purge)
        expect(sql).toContain("THEN NULL ELSE NEW.owner_id END")
        expect(sql).toContain("jsonb_build_object('state',v_batch.state,'batchId',p_batch)")
    })
    it('retains rollback and concurrency cases without claiming runtime execution', () => {
        const fixture = read('tests/accession-import-maintenance.sql')
        expect(fixture).toContain('ROLLBACK;')
        expect(fixture).toContain('stale heartbeat')
        expect(fixture).toContain('lease_generation')
        expect(fixture).toContain('42501')
        const scenarios = read('tests/accession-import-maintenance-concurrency.md')
        expect(scenarios).toContain('NOT RUN')
        expect(scenarios).toContain('Session A')
        expect(scenarios).toContain('Session B')
        expect(scenarios).toContain('outage')
        expect(scenarios).toContain('deadline')
    })
})

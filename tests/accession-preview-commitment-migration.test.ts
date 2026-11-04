// Source security contract; behavioral SQL fixture is retained but requires authorized DB execution.
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const path = 'supabase/migrations/234_add_accession_preview_commitment.sql'
const sql = existsSync(path) ? readFileSync(path, 'utf8') : ''
describe('durable accession preview migration contract', () => {
    it('rejects all existing lifecycle/helper overloads before changing ownership or grants', () => {
        const baseline = sql.match(/DO \$baseline\$([\s\S]*?)\$baseline\$;/)?.[1] ?? ''
        expect(baseline).toContain("pronamespace='public'::REGNAMESPACE")
        for (const name of ['authorize_accession_preview_actor', 'guard_accession_preview_mutation', 'start_accession_preview',
            'heartbeat_accession_preview', 'finish_accession_preview', 'seal_accession_preview', 'test_accession_preview_commitment_security']) expect(baseline).toContain(`'${name}'`)
        expect(sql).toContain("'public.heartbeat_accession_preview(uuid,uuid,uuid,bigint,text,bigint)'::REGPROCEDURE")
    })
    it('retains metadata and typed bindings without raw source or identity columns', () => {
        expect(sql).toContain('CREATE TABLE public.accession_preview_batches')
        expect(sql).toContain('CREATE TABLE public.accession_preview_bindings')
        expect(sql).not.toMatch(/\b(filename|workbook_bytes|normalized_payload|government_identity_value|phone|raw_ref)\s+(TEXT|JSONB|BYTEA)/i)
        expect(sql).toContain('source_size < 10000000')
        expect(sql).toContain('client_count BIGINT,')
    })
    it('uses database time, immutable seals and finite fenced preparation leases', () => {
        for (const token of ['clock_timestamp()', "INTERVAL '30 minutes'", 'lease_generation', 'lease_token', 'ACCESSION_PREVIEW_IMMUTABLE', 'ACCESSION_PREVIEW_LEASE_STALE', 'ACCESSION_PREVIEW_EXPIRED']) expect(sql).toContain(token)
        expect(sql).toMatch(/v_now\s*>=\s*v_batch\.expires_at/)
        expect(sql).not.toContain("SET state = 'succeeded'")
    })
    it('authorizes service boundary and current analyst owner independently of RLS bypass', () => {
        for (const token of ["auth.role() IS DISTINCT FROM 'service_role'", "role = 'analyst'", 'deleted_at IS NULL', 'DROP POLICY IF EXISTS', 'ENABLE ROW LEVEL SECURITY', 'SECURITY DEFINER SET search_path = public, pg_temp', 'FROM PUBLIC, anon, authenticated', 'TO service_role']) expect(sql).toContain(token)
        expect(sql).toContain('owner_id = auth.uid()')
    })
    it('atomically rechecks snapshot and canonical clients under locks without retaining inputs', () => {
        for (const token of ['IN SHARE MODE', 'get_accession_template_snapshot()', 'resolve_accession_preview_clients_v1(p_clients)', 'p_expected_clients', 'p_bindings_text', 'ACCESSION_PREVIEW_AUTHORITY_CHANGED', 'ACCESSION_PREVIEW_BINDINGS_INVALID', 'request.jwt.claims', 'set_config', 'test_accession_preview_commitment_security()', 'run_security_tests()', 'audit_logs']) expect(sql).toContain(token)
    })
    it('retains hostile-role, deadline, stale-lease and rollback runtime assertions', () => {
        const fixture = existsSync('tests/accession-preview-commitment.sql') ? readFileSync('tests/accession-preview-commitment.sql', 'utf8') : ''
        for (const token of ['ROLLBACK', 'manager', 'forged', 'lease', 'expires_at', 'business', 'partial', 'owner']) expect(fixture).toContain(token)
    })
})

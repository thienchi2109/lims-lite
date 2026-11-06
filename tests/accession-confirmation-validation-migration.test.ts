// SOURCE ONLY: security/ordering contracts. Retained SQL scenarios are explicitly NOT RUN.
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
const file = 'supabase/migrations/236_add_accession_confirmation_validation.sql'
const sql = existsSync(file) ? readFileSync(file, 'utf8') : ''
const body = (name: string) => sql.match(new RegExp(`CREATE FUNCTION public\\.${name}\\([^]*?AS \\$\\$([^]*?)\\$\\$;`))?.[1] ?? ''
describe('private locked confirmation source boundary', () => {
    it('leaves immutable migrations and all business destinations unchanged', () => {
        for (const [name, hash] of [
            ['233_add_accession_preview_client_resolution.sql', 'fc895bc7c2ea1976b80f145263a3e8dd7d672fe443f29650905473c2741254dc'],
            ['234_add_accession_preview_commitment.sql', 'a4bb16cb004da4799c3084734a02f3eb3fbbb5904311c5ee0661ac5ff0a9ff53'],
        ]) expect(createHash('sha256').update(readFileSync(`supabase/migrations/${name}`)).digest('hex')).toBe(hash)
        expect(sql).not.toMatch(/(?:INSERT INTO|UPDATE|DELETE FROM) public\.(?:clients|samples|results|accession_import_receipts|accession_import_mappings|accession_preview_batches)\b/i)
        expect(sql).not.toContain('generate_next_sample_id')
        expect(sql).toContain('test_accession_confirmation_validation_security()')
    })
    it('locks in exact order at final modes before current authority and acceptance clock', () => {
        const validation = body('validate_accession_confirmation_locked')
        const locks = ['assay_definitions', 'assay_sample_type_catalog_revisions', 'assay_sample_type_compatibilities',
            'assay_sample_type_reviews', 'client_collision_adjudications', 'clients', 'sample_types', 'samples', 'results']
        let previous = validation.indexOf('FOR UPDATE')
        expect(previous).toBeGreaterThan(0)
        for (const table of locks) {
            const mode = ['clients', 'samples', 'results'].includes(table) ? 'SHARE ROW EXCLUSIVE' : 'SHARE'
            const index = validation.indexOf(`LOCK TABLE public.${table} IN ${mode} MODE;`)
            expect(index).toBeGreaterThan(previous); previous = index
        }
        expect(validation.indexOf('get_accession_template_snapshot()')).toBeGreaterThan(previous)
        expect(validation.indexOf('clock_timestamp()')).toBeGreaterThan(validation.indexOf('resolve_accession_preview_clients_v1(p_clients)'))
        expect(validation.match(/clock_timestamp\(\)/g)).toHaveLength(1)
        expect(validation).toContain('v_now >= v_batch.expires_at')
    })
    it('checks caller, owner, state, quality, sealed hashes, graph and full resolver authority', () => {
        const validation = body('validate_accession_confirmation_locked')
        for (const token of ['authorize_accession_preview_actor(p_actor)', 'owner_id=p_actor', "state <> 'preview_ready'", 'p_attested IS DISTINCT FROM TRUE',
            'p_expected_clients IS DISTINCT FROM v_clients', 'p_snapshot IS DISTINCT FROM v_snapshot', 'binding_set_digest', 'normalized_payload_hash',
            'template_claims_digest', 'client_count', 'sample_count', 'assignment_count', 'create_count', 'reuse_count',
            'parent_row', 'compatibilityGeneration', 'methodName', "v_snapshot->'pairs'", 'ACCESSION_CONFIRMATION_INVALID']) expect(validation).toContain(token)
    })
    it('independently binds the locked current revision to the sealed batch revision', () => {
        const validation = body('validate_accession_confirmation_locked')
        const gate = "v_snapshot->>'revisionNumber' IS DISTINCT FROM v_batch.revision::TEXT"
        expect(validation).toContain(gate)
        expect(validation.indexOf(gate)).toBeLessThan(validation.indexOf('clock_timestamp()'))
    })
    it('restores every JWT claim on success and exception and exposes only protected reader', () => {
        const validation = body('validate_accession_confirmation_locked')
        for (const setting of ['request.jwt.claims', 'request.jwt.claim.sub', 'request.jwt.claim.role']) {
            expect(validation).toContain(`current_setting('${setting}',true)`)
            expect(validation.match(new RegExp(`set_config\\('${setting.replaceAll('.', '\\.')}'`, 'g'))?.length).toBe(3)
        }
        expect(validation).toContain('EXCEPTION WHEN OTHERS THEN')
        expect(sql).toContain('FROM PUBLIC, anon, authenticated, service_role')
        expect(sql).not.toContain('GRANT EXECUTE ON FUNCTION public.validate_accession_confirmation_locked')
        expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.get_accession_confirmation_preparation(UUID,UUID) TO service_role')
        const reader = body('get_accession_confirmation_preparation')
        expect(reader.indexOf("v_batch.state='succeeded'")).toBeLessThan(reader.indexOf('accession_preview_bindings'))
    })
    it('retains runnable behavioral and multi-session runtime scenarios without claiming execution', () => {
        const fixture = existsSync('tests/accession-confirmation-validation.sql') ? readFileSync('tests/accession-confirmation-validation.sql', 'utf8') : ''
        for (const token of ['NOT RUN', 'ROLLBACK;', 'wrong owner', 'manager denial', 'quality', 'catalog', 'confidential',
            'clock_timestamp', 'creator', 'lifecycle', 'publisher', 'request.jwt.claims', 'validate_accession_confirmation_locked']) expect(fixture).toContain(token)
        expect(fixture).not.toMatch(/DISABLE (?:TRIGGER|ROW LEVEL SECURITY)|session_replication_role/)
    })
    it('retains actual authority mutations and concrete disposable multi-session setup', () => {
        const fixture = readFileSync('tests/accession-confirmation-validation.sql', 'utf8')
        for (const token of ['UPDATE public.assay_definitions', 'UPDATE public.clients', "method_name='Synthetic confirmation236 method drift'",
            'INSERT INTO public.samples', 'INSERT INTO public.results', 'is_confidential=TRUE',
            'v_before=v_after', 'accession-confirmation-concurrency.md']) expect(fixture).toContain(token)
        const path = 'tests/accession-confirmation-concurrency.md'
        const runbook = existsSync(path) ? readFileSync(path, 'utf8') : ''
        for (const token of ['NOT RUN', 'DISPOSABLE', 'confirmation_concurrency', 'task11_confirmation_args',
            'resolve_or_create_client_v2', 'deactivate_client_v1', 'publish_assay_sample_type_catalog',
            'pg_blocking_pids', 'pg_locks', 'ROLLBACK', 'validate_accession_confirmation_locked']) expect(runbook).toContain(token)
    })
    it('seeds confidential results without the removed assay method UUID column', () => {
        const fixture = readFileSync('tests/accession-confirmation-validation.sql', 'utf8')
        expect(fixture).toContain('INSERT INTO public.results(sample_id,assay_id,status)')
        expect(fixture).not.toMatch(/SELECT v_sample,id,method_id/)
    })
})

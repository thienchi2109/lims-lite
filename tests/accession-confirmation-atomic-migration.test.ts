// SOURCE ONLY: SQL transaction/trigger behavior remains a separately authorized disposable DB gate.
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
const path='supabase/migrations/237_add_atomic_accession_confirmation.sql'
const sql=existsSync(path)?readFileSync(path,'utf8'):''
const body=(name:string)=>sql.match(new RegExp(`CREATE(?: OR REPLACE)? FUNCTION public\\.${name}\\([^]*?AS \\$\\$([^]*?)\\$\\$;`))?.[1]??''
describe('atomic accession confirmation source contract',()=>{
    it('preserves immutable 233-236 and forward-corrects the broken receipt validator',()=>{
        const expected={
            '233_add_accession_preview_client_resolution.sql':'fc895bc7c2ea1976b80f145263a3e8dd7d672fe443f29650905473c2741254dc',
            '234_add_accession_preview_commitment.sql':'a4bb16cb004da4799c3084734a02f3eb3fbbb5904311c5ee0661ac5ff0a9ff53',
            '235_add_accession_import_provenance.sql':'afd069b663bee98feed3d9ea33d9654a3fe52e3bc38c054cd4c354259f67ceaa',
            '236_add_accession_confirmation_validation.sql':'c1e804b0f1293304c0650d7036a3c279d2c4f938cd80a22f270de571a2417803',
        }
        for(const [file,hash] of Object.entries(expected))expect(createHash('sha256').update(readFileSync('supabase/migrations/'+file)).digest('hex')).toBe(hash)
        expect(body('validate_accession_import_receipt')).not.toContain('assay.method_id')
        expect(sql).toContain('CREATE OR REPLACE FUNCTION public.validate_accession_import_receipt')
        expect(sql).toContain('method_name')
    })
    it('extends only expected guard/reasons and keeps helpers private',()=>{
        for(const token of ['DO $baseline$','pg_get_functiondef','ADD CONSTRAINT','ALREADY_IMPORTED','CONFIRMATION_FAILED',
            'ATTESTATION_REQUIRED','CONFIGURATION_UNAVAILABLE','CREATE OR REPLACE FUNCTION public.guard_accession_preview_mutation',
            'test_accession_confirmation_atomic_security()','FROM PUBLIC, anon, authenticated, service_role'])expect(sql).toContain(token)
        expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.confirm_accession_import')
        expect(sql).not.toContain('GRANT EXECUTE ON FUNCTION public.validate_accession_import_receipt')
    })
    it('short-circuits owned succeeded before new input and rejects terminal replay',()=>{
        const rpc=body('confirm_accession_import')
        for(const token of ['authorize_accession_preview_actor(p_actor)','owner_id=p_actor','FOR UPDATE',"v_batch.state='succeeded'",
            'get_accession_confirmation_preparation(p_actor,p_batch)',"v_batch.state <> 'preview_ready'",'ACCESSION_CONFIRMATION_TERMINAL'])expect(rpc).toContain(token)
        expect(rpc.indexOf("v_batch.state='succeeded'")).toBeLessThan(rpc.indexOf('p_preparation_failure IS NOT NULL'))
    })
    it('claims before business writes and explicitly validates inside one rollback block',()=>{
        const rpc=body('confirm_accession_import')
        const order=['validate_accession_confirmation_locked(','INSERT INTO public.accession_import_receipts',
            'INSERT INTO public.clients','INSERT INTO public.samples','INSERT INTO public.results',"SET state='succeeded'",'validate_accession_import_receipt(p_batch)','EXCEPTION WHEN OTHERS THEN']
        let last=-1;for(const token of order){const at=rpc.indexOf(token);expect(at).toBeGreaterThan(last);last=at}
        for(const token of ['generate_next_sample_id()','v_received','creation_audit_id',"operation='INSERT'",'changed_by=p_actor',
            'GET STACKED DIAGNOSTICS','CONSTRAINT_NAME',"SQLSTATE '23505'",'v_batch.expires_at'])expect(rpc).toContain(token)
        expect(rpc).not.toMatch(/resolve_or_create_client|accession_and_assign_tests|UPDATE public\.clients|pg_advisory/)
    })
    it('takes the sample-counter exclusion before sample locks without allocating an ID before acceptance',()=>{
        const rpc=body('confirm_accession_import')
        const counter=rpc.indexOf('LOCK TABLE public.sample_id_sequences IN SHARE ROW EXCLUSIVE MODE;')
        const validation=rpc.indexOf('validate_accession_confirmation_locked(')
        expect(counter).toBeGreaterThan(0)
        expect(counter).toBeLessThan(validation)
        expect(rpc.indexOf('generate_next_sample_id()')).toBeGreaterThan(validation)
    })
    it('restores all claims and never stores raw error detail in safe terminal outcomes',()=>{
        const rpc=body('confirm_accession_import')
        for(const key of ['request.jwt.claims','request.jwt.claim.sub','request.jwt.claim.role'])expect(rpc).toContain(`current_setting('${key}',true)`)
        expect(rpc).toContain('RETURNED_SQLSTATE')
        expect(rpc).not.toMatch(/PG_EXCEPTION_DETAIL|MESSAGE_TEXT|SQLERRM|RAISE NOTICE/)
        expect(rpc).toContain("SET state=v_state,reason_code=v_reason")
    })
    it('retains actual success/actor audit/failure injection and concrete concurrency scenarios NOT RUN',()=>{
        const fixture=existsSync('tests/accession-confirmation-atomic.sql')?readFileSync('tests/accession-confirmation-atomic.sql','utf8'):''
        for(const token of ['NOT RUN','ROLLBACK;','CREATE TRIGGER','pg_temp','client','sample','assignment','mapping','audit','ALREADY_IMPORTED',
            'changed_by','validate_accession_import_receipt','v_before','v_after'])expect(fixture).toContain(token)
        expect(fixture).not.toMatch(/DISABLE (?:TRIGGER|ROW LEVEL SECURITY)|session_replication_role/)
        const runbook=existsSync('tests/accession-confirmation-atomic-concurrency.md')?readFileSync('tests/accession-confirmation-atomic-concurrency.md','utf8'):''
        for(const token of ['NOT RUN','same-batch','cross-batch','pg_blocking_pids','ROLLBACK','expires_at','confirmation_received_at'])expect(runbook).toContain(token)
    })
})

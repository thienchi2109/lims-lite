// SOURCE ONLY: structural security regression; runtime SQL/lock behavior remains NOT RUN.
import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const path = 'supabase/migrations/240_add_accession_confirmation_status.sql'
const sql = () => readFileSync(path, 'utf8')
describe('lock-aware status migration source contract', () => {
    it('supplies the next forward-only status migration', () => { expect(existsSync(path)).toBe(true) })
    it('authorizes before locking, isolates NOWAIT and distinguishes absent rows', () => {
        const text = sql()
        expect(text).toContain('public.authorize_accession_preview_actor(p_actor)')
        expect(text.indexOf('ACCESSION_CONFIRMATION_FORBIDDEN')).toBeLessThan(text.indexOf('FOR UPDATE NOWAIT'))
        expect(text).toMatch(/FOR UPDATE NOWAIT;\s*IF NOT FOUND/)
        expect(text).toMatch(/EXCEPTION WHEN lock_not_available THEN/)
        expect(text).toContain("'state','processing'")
        expect(text).toContain('clock_timestamp()>=v_batch.expires_at')
    })
    it('keeps caller/grants closed, status volatile/read-only and registers security proof', () => {
        const text = sql()
        expect(text).toContain('VOLATILE SECURITY DEFINER SET search_path = public, pg_temp')
        expect(text).toContain('FROM PUBLIC, anon, authenticated, service_role')
        expect(text).toContain('TO service_role')
        expect(text).toContain('test_accession_confirmation_status_security()')
        expect(text).toContain('public.run_security_tests()')
        const body = text.split('CREATE FUNCTION public.get_accession_import_status')[1]?.split('$$;')[0]
        expect(body).toBeTruthy(); expect(body).not.toMatch(/\b(INSERT|UPDATE public\.|DELETE|TRUNCATE)\b/)
        expect(text).toContain('public.client_has_confidential_samples')
        expect(text).toContain('v_receipt.client_count<>v_receipt.create_count+v_receipt.reuse_count')
    })
    it('retains rollback-only fixture and explicit two-session lock instructions', () => {
        const fixture = readFileSync('tests/accession-confirmation-status.sql', 'utf8')
        expect(fixture).toContain('ROLLBACK;'); expect(fixture).toContain('42501')
        const runbook = readFileSync('tests/accession-confirmation-status-concurrency.md', 'utf8')
        expect(runbook).toContain('Session A'); expect(runbook).toContain('Session B'); expect(runbook).toContain('NOT RUN')
    })
})

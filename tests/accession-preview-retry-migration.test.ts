// SOURCE ONLY: keep SQL eligibility/locking proof distinct from an executed database fixture.
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

const path = 'supabase/migrations/241_guard_accession_preview_retry.sql'
const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : ''

describe('linked preview retry migration source', () => {
    it('adds a new forward-only migration instead of editing historical 233–240', () => {
        expect(existsSync(path)).toBe(true)
    })
    it('reuses owner-bound NOWAIT status in the same transaction before allocating a child', () => {
        const text = read(path)
        expect(text).toContain('CREATE OR REPLACE FUNCTION public.start_accession_preview')
        expect(text).toContain('public.authorize_accession_preview_actor(p_actor)')
        expect(text).toContain('public.get_accession_import_status(p_actor,p_retry_of)')
        expect(text.indexOf('public.get_accession_import_status(p_actor,p_retry_of)')).toBeLessThan(text.indexOf('INSERT INTO public.accession_preview_batches'))
        expect(text).toMatch(/NOT IN \('failed','rejected','expired','preview_ready'\)/)
        expect(text).not.toMatch(/UPDATE public\.accession_preview_batches/)
    })
    it('validates the historical start baseline and preserves closed grants/security registration', () => {
        const text = read(path)
        expect(text).toContain('cadd2bd966dcc96326af313fe719f36d71a8904abdc6ef40ac6abc51533bb371')
        expect(text).toContain('test_accession_confirmation_status_security()')
        expect(text).toContain('test_accession_preview_retry_security()')
        expect(text).toContain('FROM PUBLIC, anon, authenticated, service_role')
        expect(text).toContain('TO service_role')
        expect(text).toContain('public.run_security_tests()')
    })
    it('binds the resulting-state security check to the exact new start body', () => {
        const text = read(path)
        const body = text.match(/CREATE OR REPLACE FUNCTION public\.start_accession_preview[\s\S]*?AS \$\$([\s\S]*?)\$\$;/)?.[1]
        expect(body).toBeDefined()
        const hash = createHash('sha256').update(body ?? '').digest('hex')
        expect(text).toContain(`AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='${hash}'`)
    })
    it('retains a rollback fixture for same-owner eligibility and immutable parents', () => {
        const fixture = read('tests/accession-preview-retry.sql')
        expect(fixture).toContain('ROLLBACK;')
        expect(fixture).toContain('parent remains unchanged')
        expect(fixture).toContain('same owner')
        expect(fixture).toContain('succeeded')
        expect(fixture).toContain('preview_ready')
        expect(fixture).toContain('42501')
    })
})

// Source checks preserve history and the exact two-site recovery; PostgreSQL evidence is separate.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const directory = 'supabase/migrations/'
const recoveryPath = `${directory}243_recover_accession_import_maintenance.sql`
const historicalPath = `${directory}242_add_accession_import_maintenance.sql`
const policy = `DROP POLICY IF EXISTS accession_maintenance_deny_all ON public.accession_import_maintenance_authorizations;
CREATE POLICY accession_maintenance_deny_all ON public.accession_import_maintenance_authorizations
    FOR ALL TO PUBLIC USING (false) WITH CHECK (false);`
const previousCheck = "AND NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.accession_import_maintenance_authorizations'::REGCLASS)"
const policyCheck = `AND (SELECT count(*)=1 AND bool_and(polname='accession_maintenance_deny_all' AND polcmd='*'
        AND polpermissive AND polroles=ARRAY[0]::OID[]
        AND pg_get_expr(polqual,polrelid)='false' AND pg_get_expr(polwithcheck,polrelid)='false')
        FROM pg_policy WHERE polrelid='public.accession_import_maintenance_authorizations'::REGCLASS)`

describe('maintenance recovery from verified 241', () => {
    it('recovers the complete immutable 242 transaction with only the explicit deny policy and verifier correction', () => {
        expect(existsSync(recoveryPath)).toBe(true)
        const original = readFileSync(historicalPath, 'utf8').split('BEGIN;\n')[1]
        const recovery = readFileSync(recoveryPath, 'utf8').split('BEGIN;\n')[1]
        const rls = 'ALTER TABLE public.accession_import_maintenance_authorizations ENABLE ROW LEVEL SECURITY;'
        expect(original.split(rls)).toHaveLength(2)
        expect(original.split(previousCheck)).toHaveLength(2)
        expect(recovery).toBe(original.replace(rls, `${rls}\n${policy}`).replace(previousCheck, policyCheck))
        expect(recovery).toContain("OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='accession_maintenance_worker')")
        expect(recovery).toContain('public.test_accession_preview_retry_security() IS DISTINCT FROM TRUE')
        expect(recovery).toContain('public.run_security_tests()')
    })

    it('preserves every historical migration from 233 through the failed 242 attempt', () => {
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
        }
        for (const [file, hash] of Object.entries(hashes)) {
            expect(createHash('sha256').update(readFileSync(directory + file)).digest('hex'), file).toBe(hash)
        }
    })
})

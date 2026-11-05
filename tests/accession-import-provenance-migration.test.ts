// SOURCE ONLY: protects the migration's security/retention shape; SQL behavior needs authorized execution.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = 'supabase/migrations/235_add_accession_import_provenance.sql'
const sql = existsSync(migration) ? readFileSync(migration, 'utf8') : ''
const body = (name: string) => sql.match(new RegExp(`CREATE FUNCTION public\\.${name}\\([^]*?AS \\$\\$([^]*?)\\$\\$;`))?.[1] ?? ''

describe('accession import provenance migration source boundary', () => {
    it('preserves both applied migrations and leaves confirmation for later phases', () => {
        for (const [file, hash] of [
            ['233_add_accession_preview_client_resolution.sql', 'fc895bc7c2ea1976b80f145263a3e8dd7d672fe443f29650905473c2741254dc'],
            ['234_add_accession_preview_commitment.sql', 'a4bb16cb004da4799c3084734a02f3eb3fbbb5904311c5ee0661ac5ff0a9ff53'],
        ]) expect(createHash('sha256').update(readFileSync(`supabase/migrations/${file}`)).digest('hex')).toBe(hash)
        expect(sql).not.toMatch(/(?:CREATE OR REPLACE FUNCTION public\.guard_accession_preview_mutation|INSERT INTO public\.(?:clients|samples|results)|UPDATE public\.accession_preview_batches)/)
    })

    it('uses one durable success receipt as the globally unique intent claim', () => {
        expect(sql).toContain('CREATE TABLE public.accession_import_receipts')
        expect(sql).toMatch(/normalized_payload_hash TEXT NOT NULL UNIQUE/)
        expect(sql).toMatch(/batch_id UUID PRIMARY KEY REFERENCES public\.accession_preview_batches\(id\)/)
        expect(sql).not.toMatch(/UNIQUE\s*\([^)]*(?:owner_id|canonicalization_version)[^)]*normalized_payload_hash/)
        expect(sql).not.toMatch(/(?:ON DELETE CASCADE|INTERVAL|CREATE TABLE public\.[^\s]*(?:claim|payload))/i)
    })

    it('keeps typed provenance local, unique and free of retained workbook/profile fields', () => {
        expect(sql).toContain('PRIMARY KEY (batch_id, kind, row_number)')
        expect(sql).toContain('FOREIGN KEY (batch_id, parent_kind, parent_row)')
        expect(sql).toContain('UNIQUE (batch_id, kind, temporary_reference)')
        expect(sql).toContain('UNIQUE (batch_id, sample_id, assay_id)')
        for (const field of ['client_id', 'sample_id', 'result_id', 'assay_id', 'method_id', 'creation_audit_id']) expect(sql).toContain(`${field} UUID`)
        expect(sql).not.toMatch(/\b(?:filename|workbook_bytes|normalized_payload|name|date_of_birth|phone|address)\s+(?:TEXT|DATE|JSONB|BYTEA)/i)
    })

    it('validates the final graph once per receipt with a private callable validator', () => {
        expect(sql).toMatch(/CREATE CONSTRAINT TRIGGER[^]*?AFTER INSERT ON public\.accession_import_receipts[^]*?DEFERRABLE INITIALLY DEFERRED/)
        expect(sql).not.toMatch(/CREATE CONSTRAINT TRIGGER[^;]*ON public\.accession_import_mappings/)
        const validate = body('validate_accession_import_receipt')
        for (const token of ["state <> 'succeeded'", 'normalized_payload_hash', 'confirmation_received_at', 'client_count', 'sample_count', 'assignment_count', 'creation_audit_id', 'changed_by', "operation = 'INSERT'", 'ACCESSION_IMPORT_INCOMPLETE']) expect(validate).toContain(token)
        expect(sql).not.toMatch(/CREATE (?:CONSTRAINT )?TRIGGER[^;]*ON public\.(?:clients|samples|results)/)
    })

    it('requires active parent authority and current confidentiality for mapping reads', () => {
        const policies = sql.slice(sql.indexOf('DROP POLICY IF EXISTS'))
        for (const token of ['owner_id = auth.uid()', "get_user_role() = 'analyst'", "get_user_role() = 'manager'", 'deleted_at IS NULL', 'client_has_confidential_samples(client_id)', 'user_can_access_confidential()', 'FROM public.accession_import_receipts', 'FROM public.clients', 'FROM public.samples', 'FROM public.results']) expect(policies).toContain(token)
        expect(sql).toMatch(/ALTER TABLE public\.accession_import_receipts ENABLE ROW LEVEL SECURITY/)
        expect(sql).toMatch(/ALTER TABLE public\.accession_import_mappings ENABLE ROW LEVEL SECURITY/)
        expect(sql).not.toMatch(/(?:CREATE|DROP) POLICY[^;]*ON public\.(?:audit_logs|clients|samples|results)/)
    })

    it('hides hash, closes helper/table writes and registers security verification', () => {
        const receiptGrant = sql.match(/GRANT SELECT \(([^]*?)\) ON public\.accession_import_receipts/)?.[1] ?? ''
        expect(receiptGrant).toContain('batch_id')
        expect(receiptGrant).not.toContain('normalized_payload_hash')
        expect(sql).toContain('FROM PUBLIC, anon, authenticated, service_role')
        expect(sql).toContain('ALTER FUNCTION')
        expect(sql).toContain('OWNER TO postgres')
        expect(sql).toContain('SECURITY DEFINER SET search_path = public, pg_temp')
        expect(sql).toContain('test_accession_import_provenance_security()')
        expect(sql).toContain("relowner='postgres'::REGROLE")
        expect(sql).toContain('FROM pg_policy')
        expect(sql).toContain("'public.run_security_tests()'::REGPROCEDURE")
        expect(sql).not.toContain('GRANT EXECUTE ON FUNCTION public.validate_accession_import_receipt')
    })

    it('retains partial rollback-only runtime proof without disabling historical guards', () => {
        const path = 'tests/accession-import-provenance.sql'
        const fixture = existsSync(path) ? readFileSync(path, 'utf8') : ''
        for (const token of ['NOT RUN', 'BEGIN;', 'ROLLBACK;', 'SET LOCAL ROLE authenticated', 'SET LOCAL ROLE service_role', 'validate_accession_import_receipt', 'ACCESSION_IMPORT_INCOMPLETE', 'unbacked success', 'confidential', 'deactivated', 'duplicate intent']) expect(fixture).toContain(token)
        expect(fixture).not.toMatch(/DISABLE (?:TRIGGER|ROW LEVEL SECURITY)|session_replication_role|CREATE.*public\./)
    })

    it('anchors security drift checks to both complete policy expressions at creation', () => {
        const security = body('test_accession_import_provenance_security')
        for (const marker of ['__ACCESSION_IMPORT_RECEIPT_POLICY__', '__ACCESSION_IMPORT_MAPPING_POLICY__']) {
            expect(security).toContain(`pg_get_expr(polqual,polrelid) = '${marker}'`)
            expect(sql).toContain(`quote_literal('${marker}')`)
        }
        expect(security).not.toMatch(/\bLIKE\b/)
        const freeze = sql.match(/DO \$freeze_policies\$([^]*?)\$freeze_policies\$;/)?.[1] ?? ''
        expect(freeze).toContain("pg_get_functiondef('public.test_accession_import_provenance_security()'::REGPROCEDURE)")
        expect(freeze).toContain('INTO STRICT')
        expect(freeze).toContain('EXECUTE replace(replace(')
        expect(sql.indexOf('$freeze_policies$;')).toBeLessThan(sql.indexOf('ALTER FUNCTION public.test_accession_import_provenance_security() OWNER'))
    })
})

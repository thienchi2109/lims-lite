/**
 * CoA report authorization regression tests.
 *
 * Direct authenticated updates are disabled. Generation state transitions
 * must use the claim-bound SECURITY DEFINER RPCs introduced in Phase 4.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

function runSQL(query) {
    return execFileSync(
        'docker',
        [
            'exec',
            'lims-postgres',
            'psql',
            '-U',
            'postgres',
            '-d',
            'postgres',
            '-t',
            '-A',
            '-c',
            query,
        ],
        { encoding: 'utf8' },
    ).trim()
}

async function readWorkspaceFile(relativePath) {
    return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

test('migration 172 revokes direct authenticated CoA updates', async () => {
    const content = await readWorkspaceFile(
        'supabase/migrations/172_harden_coa_generation_transitions.sql',
    )

    assert.match(
        content,
        /REVOKE UPDATE ON TABLE public\.coa_reports FROM authenticated/,
    )
})

test('authenticated users can read but cannot update CoA reports', () => {
    const privileges = runSQL(`
        SELECT
            has_table_privilege(
                'authenticated',
                'public.coa_reports',
                'SELECT'
            ),
            has_table_privilege(
                'authenticated',
                'public.coa_reports',
                'UPDATE'
            );
    `)

    assert.equal(privileges, 't|f')
})

test('claim-bound CoA transition RPCs are SECURITY DEFINER', () => {
    const securityDefinerCount = runSQL(`
        SELECT COUNT(*)
        FROM pg_proc
        WHERE oid IN (
            'public.claim_coa_report_regeneration(uuid,integer)'::regprocedure,
            'public.complete_coa_report_generation(uuid,uuid,text,text,uuid)'::regprocedure,
            'public.fail_coa_report_generation(uuid,uuid,text,boolean)'::regprocedure
        )
          AND prosecdef
          AND EXISTS (
              SELECT 1
              FROM unnest(proconfig) AS setting
              WHERE setting = 'search_path=public, extensions'
          );
    `)

    assert.equal(securityDefinerCount, '3')
})

test('only authenticated users can execute CoA transition RPCs', () => {
    const privileges = runSQL(`
        SELECT
            bool_and(has_function_privilege('authenticated', oid, 'EXECUTE')),
            bool_and(NOT has_function_privilege('anon', oid, 'EXECUTE')),
            bool_and(NOT has_function_privilege('service_role', oid, 'EXECUTE'))
        FROM pg_proc
        WHERE oid IN (
            'public.claim_coa_report_regeneration(uuid,integer)'::regprocedure,
            'public.complete_coa_report_generation(uuid,uuid,text,text,uuid)'::regprocedure,
            'public.fail_coa_report_generation(uuid,uuid,text,boolean)'::regprocedure
        );
    `)

    assert.equal(privileges, 't|t|t')
})

test('registered security tests enforce the CoA provenance contract', () => {
    const result = runSQL(`
        SELECT passed
        FROM public.run_security_tests()
        WHERE test_name = 'CoA Report Provenance Guard';
    `)

    assert.equal(result, 't')
})

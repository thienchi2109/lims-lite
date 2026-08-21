import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/213_enforce_assay_sample_type_compatibility.sql',
)
const runtimeTestPath = join(
  process.cwd(),
  'tests/assay-sample-type-enforcement.test.sql',
)
const concurrencyTestPath = join(
  process.cwd(),
  'tests/assay-sample-type-enforcement-concurrency.test.sql',
)

const immutableMigrationHashes = new Map([
  ['204_add_sample_type_master_data.sql', 'e6bebc77449e3a4afeee278cf7c45823872c5245ff41b53eaf22896577fcb492'],
  ['205_recover_sample_type_master_data.sql', 'bfabbf645e4424f5e21fada5651ef1aa55a59b26af38464ea393e59d350c5de9'],
  ['206_add_assay_sample_type_compatibility_revision_core.sql', 'b8715e71762bde41b39ea5a441298adfd8c121e9816a9cdda79c56c2eadc3892'],
  ['207_add_compatibility_catalog_service_role_policies.sql', 'dff8e0ffc3f00ef66a4b5b4d858e15b480335d729c65115b2ea154222bbf9e7f'],
  ['208_add_assay_sample_type_catalog_rpcs.sql', 'd187066f5484875b2336de4e62b15c59c459076b22172f99e6c9c7e25bc08cd0'],
  ['209_expose_compatibility_catalog_stale_state.sql', 'f567ef736755cba2b1354827f04a8c0e7018f17720dfa55a7920d323894785e9'],
  ['210_allow_reviewed_compatibility_draft_hash.sql', '11f6dc8bb8d05c20b6b1456ca6c51cfb29508941a558ae271ff119305b2eeb42'],
  ['211_add_assay_sample_type_assignment_v2.sql', '221eedf69644e5c42749b35c029c6936a9cf777c2843a4e48db7e90fc03394a0'],
  ['212_recover_assay_sample_type_assignment_v2.sql', '489365236c355498c46ef8d7e72076c83f07ef08bbf160da3c7012de8d8791e3'],
])

const legacySignatures = [
  'public.create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID, TEXT, BOOLEAN)',
  'public.accession_and_assign_tests(UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT, BOOLEAN)',
  'public.assign_tests_to_sample(UUID, JSONB)',
]

const v2Signatures = [
  'public.create_sample_atomic_v2(UUID, TEXT, TIMESTAMPTZ, UUID, UUID, BOOLEAN, BIGINT)',
  'public.accession_and_assign_tests_v2(UUID, TEXT, TIMESTAMPTZ, JSONB, UUID, BOOLEAN, BIGINT)',
  'public.assign_tests_to_sample_v2(UUID, UUID, JSONB, BIGINT)',
]

function readMigration() {
  return existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : ''
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

function extractFunction(sql: string, name: string) {
  const normalized = normalizeSql(sql)
  return normalized.match(
    new RegExp(
      `CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\b[\\s\\S]*?\\$\\$;`,
      'i',
    ),
  )?.[0]
}

describe('assay sample-type database enforcement migration', () => {
  it('adds only migration 213 and preserves applied compatibility migrations', () => {
    expect(existsSync(migrationPath)).toBe(true)

    for (const [fileName, expectedHash] of immutableMigrationHashes) {
      const contents = readFileSync(
        join(process.cwd(), 'supabase/migrations', fileName),
      )
      expect(
        createHash('sha256').update(contents).digest('hex'),
        fileName,
      ).toBe(expectedHash)
    }
  })

  it('pins the reviewed Phase 7 telemetry precondition', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toContain(
      "v_expected_release_commit CONSTANT TEXT := '95aebce2b009914694717e51103e24cfd1ee99e5'",
    )
    expect(normalized).toContain(
      "current_setting('lims.migration_213_release_commit', TRUE)",
    )
    expect(normalized).toContain(
      "current_setting('lims.migration_213_telemetry_window_started_at', TRUE)",
    )
    expect(normalized).toContain(
      "current_setting('lims.migration_213_telemetry_window_ended_at', TRUE)",
    )
    expect(normalized).toContain(
      "current_setting('lims.migration_213_successful_legacy_assignments', TRUE)",
    )
    expect(normalized).toMatch(
      /v_release_commit IS NULL[\s\S]*v_release_commit IS DISTINCT FROM v_expected_release_commit[\s\S]*v_window_started_at IS NULL[\s\S]*v_window_ended_at IS NULL[\s\S]*v_window_started_at > TIMESTAMPTZ '2026-08-21T09:16:38Z'[\s\S]*v_window_ended_at < TIMESTAMPTZ '2026-08-21T09:23:28Z'[\s\S]*v_window_ended_at <= v_window_started_at[\s\S]*v_window_ended_at > clock_timestamp\(\)[\s\S]*clock_timestamp\(\) - v_window_ended_at > INTERVAL '15 minutes'[\s\S]*v_successful_legacy_assignments IS DISTINCT FROM 0/i,
    )
  })

  it('fails closed unless the published catalog is complete and current', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /count\(\*\)[\s\S]*status = 'published'[\s\S]*v_published_count <> 1/i,
    )
    expect(normalized).toMatch(
      /assay_definition\.deleted_at IS NULL[\s\S]*review\.assay_definition_id IS NULL/i,
    )
    expect(normalized).toMatch(
      /review\.assay_compatibility_generation IS DISTINCT FROM assay_definition\.compatibility_generation/i,
    )
    expect(normalized).toMatch(
      /review\.disposition = 'configured'[\s\S]*compatibility\.removed_at IS NULL/i,
    )
    expect(normalized).toMatch(
      /compatibility\.assay_compatibility_generation IS DISTINCT FROM assay_definition\.compatibility_generation/i,
    )
    expect(normalized).toMatch(
      /compatibility\.sample_type_compatibility_generation IS DISTINCT FROM sample_type\.compatibility_generation/i,
    )
  })

  it('retires legacy assignment RPCs and preserves exact v2 grants', () => {
    const normalized = normalizeSql(readMigration())

    for (const signature of legacySignatures) {
      expect(normalized).toContain(
        `REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC, anon, authenticated, service_role`,
      )
      expect(normalized).toContain(`DROP FUNCTION ${signature}`)
    }

    for (const signature of v2Signatures) {
      expect(normalized).toContain(
        `REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC, anon, authenticated, service_role`,
      )
      expect(normalized).toContain(
        `GRANT EXECUTE ON FUNCTION ${signature} TO authenticated`,
      )
    }
  })

  it('enforces compatibility on every new direct result insert', () => {
    const migration = readMigration()
    const normalized = normalizeSql(migration)
    const guard = extractFunction(
      migration,
      'enforce_result_sample_type_compatibility',
    )

    expect(guard).toBeDefined()
    expect(guard).toMatch(/RETURNS trigger/i)
    expect(guard).toMatch(/SET search_path = public, extensions/i)
    expect(guard).toMatch(
      /SELECT sample\.sample_type_id[\s\S]*FROM public\.samples AS sample[\s\S]*WHERE sample\.id = NEW\.sample_id AND sample\.deleted_at IS NULL;/i,
    )
    expect(guard).toContain(
      'PERFORM public.resolve_assay_sample_type_compatibility(',
    )
    expect(guard).toMatch(
      /PERFORM public\.resolve_assay_sample_type_compatibility\([\s\S]*SELECT sample\.sample_type_id[\s\S]*INTO v_locked_sample_type_id[\s\S]*FOR SHARE/i,
    )
    expect(guard).toMatch(
      /v_locked_sample_type_id IS DISTINCT FROM v_sample_type_id[\s\S]*ERRCODE = '40001'/i,
    )
    expect(guard).toContain('NEW.assay_id')
    expect(normalized).toContain(
      'CREATE TRIGGER results_enforce_sample_type_compatibility BEFORE INSERT ON public.results FOR EACH ROW EXECUTE FUNCTION public.enforce_result_sample_type_compatibility()',
    )
  })

  it('orders additive assignment locks before the sample row lock', () => {
    const assignment = extractFunction(
      readMigration(),
      'assign_tests_to_sample_v2',
    )

    expect(assignment).toBeDefined()
    expect(assignment).toMatch(
      /SELECT sample\.status, sample\.sample_type_id[\s\S]*WHERE sample\.id = p_sample_id AND sample\.deleted_at IS NULL;/i,
    )
    expect(assignment).toMatch(
      /resolve_sample_type_compatibility_revision\([\s\S]*resolve_assay_sample_type_compatibility\([\s\S]*SELECT sample\.status, sample\.sample_type_id[\s\S]*FOR UPDATE/i,
    )
    expect(assignment).toMatch(
      /FOR UPDATE;[\s\S]*v_stored_sample_type_id IS DISTINCT FROM p_sample_type_id/i,
    )
    expect(normalizeSql(readMigration())).toMatch(
      /pg_get_functiondef\('public\.assign_tests_to_sample_v2\(uuid,uuid,jsonb,bigint\)'\s*::REGPROCEDURE\)[\s\S]*strpos\(lower\(v_function_definition\), 'resolve_sample_type_compatibility_revision'\)[\s\S]*strpos\(lower\(v_function_definition\), 'for update'\)/i,
    )
  })

  it('locks sample type after the first result while preserving audit', () => {
    const migration = readMigration()
    const normalized = normalizeSql(migration)
    const guard = extractFunction(
      migration,
      'prevent_sample_type_change_after_result',
    )

    expect(guard).toBeDefined()
    expect(guard).toMatch(
      /IF NEW\.sample_type_id IS NOT DISTINCT FROM OLD\.sample_type_id AND NEW\.type IS NOT DISTINCT FROM OLD\.type THEN RETURN NEW/i,
    )
    expect(guard).toMatch(
      /EXISTS \(SELECT 1 FROM public\.results AS result WHERE result\.sample_id = OLD\.id\)/i,
    )
    expect(guard).toContain("ERRCODE = 'P1107'")
    expect(normalized).toContain(
      'CREATE TRIGGER samples_prevent_sample_type_change_after_result BEFORE UPDATE OF sample_type_id, type ON public.samples FOR EACH ROW EXECUTE FUNCTION public.prevent_sample_type_change_after_result()',
    )
    expect(normalized).toMatch(
      /audit_samples_trigger[\s\S]*trigger_audit_log\(\)[\s\S]*AFTER INSERT OR DELETE OR UPDATE/i,
    )
    expect(normalized).toMatch(
      /CREATE OR REPLACE FUNCTION public\.sync_sample_type_name_to_samples\(\)[\s\S]*NOT EXISTS \(SELECT 1 FROM public\.results AS result WHERE result\.sample_id = sample\.id\)/i,
    )
    expect(normalized).toMatch(
      /sample_types_sync_sample_projection[\s\S]*sync_sample_type_name_to_samples\(\)[\s\S]*tgenabled = 'O'/i,
    )
    expect(normalized).not.toMatch(/\bUPDATE public\.results\b/i)
    expect(normalized).not.toMatch(/\bDELETE FROM public\.results\b/i)
  })

  it('registers exact trigger, function, and grant checks in security tests', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toContain(
      'CREATE OR REPLACE FUNCTION public.test_assay_sample_type_enforcement()',
    )
    expect(normalized).toMatch(
      /results_enforce_sample_type_compatibility[\s\S]*enforce_result_sample_type_compatibility/i,
    )
    expect(normalized).toMatch(
      /samples_prevent_sample_type_change_after_result[\s\S]*prevent_sample_type_change_after_result/i,
    )
    expect(normalized).toMatch(
      /FOREACH v_signature IN ARRAY ARRAY\[[\s\S]*enforce_result_sample_type_compatibility\(\)[\s\S]*prevent_sample_type_change_after_result\(\)[\s\S]*sync_sample_type_name_to_samples\(\)[\s\S]*prosecdef[\s\S]*proconfig = ARRAY\[[\s\S]*pg_get_userbyid\(function_record\.proowner\) = 'postgres'[\s\S]*has_function_privilege\('authenticated', v_function, 'EXECUTE'\)/i,
    )
    expect(normalized).toMatch(
      /run_security_tests\(\)[\s\S]*Assay Sample-Type Enforcement/i,
    )
    expect(normalized).toMatch(
      /pg_get_functiondef\('public\.test_sample_quality_enforcement\(\)'::REGPROCEDURE\)[\s\S]*create_sample_atomic_v2/i,
    )
    expect(normalized).toMatch(
      /CREATE OR REPLACE FUNCTION public\.test_sample_accession_rpcs_require_analyst_role\(\)[\s\S]*create_sample_atomic_v2[\s\S]*accession_and_assign_tests_v2/i,
    )
  })

  it('defines rollback-only runtime coverage for history and new writes', () => {
    expect(existsSync(runtimeTestPath)).toBe(true)
    const normalized = normalizeSql(readFileSync(runtimeTestPath, 'utf8'))

    for (const signature of [
      'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)',
      'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)',
      'public.assign_tests_to_sample(uuid,jsonb)',
    ]) {
      expect(normalized).toContain(`to_regprocedure('${signature}') IS NOT NULL`)
    }
    expect(normalized).toContain(
      'SELECT public.create_sample_atomic_v2($1, $2, $3, $4, $5, $6, $7)',
    )
    expect(normalized).toMatch(
      /UPDATE public\.samples SET sample_type_id = v_sample_type_id, type = v_sample_type_name/i,
    )
    expect(normalized).toMatch(
      /audit_logs[\s\S]*operation = 'UPDATE'[\s\S]*changed_by = v_analyst_id/i,
    )
    expect(normalized).toMatch(
      /INSERT INTO public\.results \(sample_id, assay_id, method_id, status\)/i,
    )
    expect(normalized).toContain(
      'ALTER TABLE public.assay_sample_type_compatibilities DISABLE TRIGGER guard_assay_sample_type_compatibilities',
    )
    expect(normalized).toContain("WHEN SQLSTATE 'P1105'")
    expect(normalized).toContain("WHEN SQLSTATE 'P1107'")
    expect(normalized).toMatch(
      /historical result remains unchanged[\s\S]*new result is rejected after pair removal/i,
    )
    expect(normalized).toMatch(
      /UPDATE public\.sample_types[\s\S]*SET name = v_renamed_sample_type_name[\s\S]*result-bearing sample keeps historical type projection[\s\S]*result-free sample follows master rename/i,
    )
    expect(normalized).toMatch(
      /run_security_tests\(\)[\s\S]*test_name = 'Assay Sample-Type Enforcement'[\s\S]*v_security_runner_count = 1[\s\S]*COALESCE\(v_security_runner_passed, FALSE\)/i,
    )
    expect(normalized).toContain('ROLLBACK')
  })

  it('defines a two-session assignment versus master-rename drill', () => {
    expect(existsSync(concurrencyTestPath)).toBe(true)
    const concurrencySql = existsSync(concurrencyTestPath)
      ? readFileSync(concurrencyTestPath, 'utf8')
      : ''
    const normalized = normalizeSql(concurrencySql)

    expect(concurrencySql).toMatch(
      /SELECT sample_type\.id FROM public\.sample_types AS sample_type[\s\S]*FOR UPDATE/i,
    )
    expect(concurrencySql).toContain('SELECT pg_sleep(1)')
    expect(concurrencySql).toContain('first_pid=\\$!')
    expect(concurrencySql).toContain(
      'public.assign_tests_to_sample_v2',
    )
    expect(concurrencySql).toContain(
      "! grep -Eq 'deadlock detected|40P01'",
    )
    expect(normalized).toMatch(
      /COUNT\(\*\) = 1[\s\S]*FROM public\.results[\s\S]*sample_id = '95200000-0000-0000-0000-000000000010'/i,
    )
  })
})

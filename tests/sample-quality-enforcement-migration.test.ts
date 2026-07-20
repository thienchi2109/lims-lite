import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/190_enforce_sample_quality.sql',
)
const runtimeTestPath = join(
  process.cwd(),
  'tests/sample-quality-enforcement.test.sql',
)

const directInsertFixturePaths = [
  'tests/assay-management.test.sql',
  'tests/doctor-rbac-rls.test.sql',
  'tests/reporting-kpi-parity.test.sql',
  'tests/result-reference-assessments.test.sql',
  'tests/results-confidential-rls.test.sql',
  'tests/samples-confidential-page-rpc.test.sql',
  'tests/search-confidential-functions.test.sql',
  'tests/search.test.sql',
]

const legacySignatures = [
  'public.create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID, TEXT)',
  'public.accession_and_assign_tests(UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT)',
]

const qualityAwareSignatures = [
  'public.create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID, TEXT, BOOLEAN)',
  'public.accession_and_assign_tests(UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT, BOOLEAN)',
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

function sqlStatements(sql: string) {
  return normalizeSql(sql)
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
}

function extractFunctionDefinition(sql: string, functionName: string) {
  return normalizeSql(sql).match(
    new RegExp(
      `CREATE OR REPLACE FUNCTION public\\.${functionName}\\(\\)[\\s\\S]*?\\$\\$;`,
      'i',
    ),
  )?.[0]
}

function extractSampleInsertColumns(sql: string) {
  return Array.from(
    sql.matchAll(
      /\bINSERT\s+INTO\s+(?:public\.)?samples\s*\(([\s\S]*?)\)\s*VALUES\b/gi,
    ),
    (match) =>
      match[1]
        .split(',')
        .map((column) => column.trim().replace(/^"|"$/g, '').toLowerCase()),
  )
}

describe('sample quality enforcement migration', () => {
  it('pins the compatibility baseline before enforcing it', () => {
    const migration = readMigration()
    const normalized = normalizeSql(migration)

    expect(existsSync(migrationPath)).toBe(true)
    expect(migration).toContain('Security impact:')
    expect(migration).toContain('Historical data impact:')
    expect(normalized).toMatch(
      /to_regprocedure\s*\('public\.create_sample_atomic\(uuid,text,timestamp with time zone,uuid,text,boolean\)'\)/i,
    )
    expect(normalized).toMatch(
      /to_regprocedure\s*\('public\.accession_and_assign_tests\(uuid,text,timestamp with time zone,jsonb,text,boolean\)'\)/i,
    )
    expect(normalized).toMatch(
      /information_schema\.columns[\s\S]*column_name = 'sample_quality'[\s\S]*data_type = 'boolean'[\s\S]*is_nullable = 'YES'[\s\S]*column_default IS NULL/i,
    )
    expect(normalized).toMatch(
      /pg_get_functiondef\(v_create_quality\)[\s\S]*v_create_definition/i,
    )
    expect(normalized).toMatch(
      /pg_get_functiondef\(v_assign_quality\)[\s\S]*v_assign_definition/i,
    )
    expect(normalized).toContain(
      "v_create_definition NOT ILIKE '%p_sample_quality IS NULL%'",
    )
    expect(normalized).toContain(
      "v_create_definition NOT ILIKE '%''sample_quality'', sample_quality%'",
    )
    expect(normalized).toContain(
      "v_assign_definition NOT ILIKE '%p_sample_quality IS NULL%'",
    )
    expect(normalized).toContain(
      "v_assign_definition NOT ILIKE '%''sample_quality'', p_sample_quality%'",
    )
  })

  it('pins explicit security checker bodies before dropping legacy RPCs', () => {
    const normalized = normalizeSql(readMigration())
    const firstLegacyDrop = normalized.indexOf(
      'DROP FUNCTION public.create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID, TEXT)',
    )
    const publicCatalogSignatures = [
      'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)',
      'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)',
    ]
    const checkerExpectations = [
      {
        name: 'test_security_definer_rpc_execute_privileges',
        signatures: publicCatalogSignatures,
      },
      {
        name: 'test_security_definer_rpc_search_path',
        signatures: [
          'create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)',
          'accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)',
        ],
      },
      {
        name: 'test_sample_accession_rpcs_require_analyst_role',
        signatures: publicCatalogSignatures,
      },
    ]

    expect(firstLegacyDrop).toBeGreaterThan(-1)
    expect(normalized).not.toContain('DO $refresh_security_checkers$')

    for (const { name, signatures } of checkerExpectations) {
      const definition = extractFunctionDefinition(normalized, name)
      const definitionIndex = normalized.indexOf(
        `CREATE OR REPLACE FUNCTION public.${name}()`,
      )

      expect(definition, name).toBeDefined()
      expect(definitionIndex, name).toBeGreaterThan(-1)
      expect(definitionIndex, name).toBeLessThan(firstLegacyDrop)
      for (const signature of signatures) {
        expect(definition?.toLowerCase(), name).toContain(signature)
      }
    }

    for (const checkerVariable of [
      'v_execute_checker',
      'v_search_path_checker',
      'v_analyst_role_checker',
    ]) {
      expect(normalized).toMatch(
        new RegExp(
          `pg_get_functiondef\\(${checkerVariable}\\)[\\s\\S]*${checkerVariable}_definition`,
          'i',
        ),
      )
    }
  })

  it('matches the nested analyst-role literal emitted by pg_get_functiondef', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toContain(
      "v_analyst_role_checker_definition NOT ILIKE '%v_user_role <> ''''analyst''''%'",
    )
  })

  it('revokes and drops only the legacy accession signatures', () => {
    const statements = sqlStatements(readMigration())

    for (const signature of legacySignatures) {
      expect(statements).toContain(
        `REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC, anon, authenticated, service_role`,
      )
      expect(statements).toContain(`DROP FUNCTION ${signature}`)
    }

    for (const signature of qualityAwareSignatures) {
      expect(statements).toContain(
        `REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC, anon, authenticated, service_role`,
      )
      expect(statements).toContain(
        `GRANT EXECUTE ON FUNCTION ${signature} TO authenticated`,
      )
      expect(statements).not.toContain(`DROP FUNCTION ${signature}`)
    }
  })

  it('uses an insert-only trigger without backfilling or constraining historical NULL rows', () => {
    const migration = readMigration()
    const normalized = normalizeSql(migration)
    const triggerStatement = sqlStatements(migration).find((statement) =>
      /^CREATE TRIGGER samples_require_quality_on_insert\b/i.test(statement),
    )

    expect(normalized).toMatch(
      /CREATE FUNCTION public\.enforce_sample_quality_on_insert\(\) RETURNS trigger/i,
    )
    expect(normalized).toMatch(
      /IF NEW\.sample_quality IS NULL THEN RAISE EXCEPTION 'Sample quality is required' USING ERRCODE = '23502'/i,
    )
    expect(normalized).toMatch(
      /CREATE TRIGGER samples_require_quality_on_insert BEFORE INSERT ON public\.samples FOR EACH ROW EXECUTE FUNCTION public\.enforce_sample_quality_on_insert\(\)/i,
    )
    expect(triggerStatement).not.toMatch(/\bUPDATE\b/i)
    expect(normalized).not.toMatch(
      /\bUPDATE\s+(?:ONLY\s+)?public\.samples\b[^;]*\bsample_quality\s*=/i,
    )
    expect(normalized).not.toMatch(
      /ALTER TABLE public\.samples[\s\S]*sample_quality[\s\S]*SET NOT NULL/i,
    )
    expect(normalized).not.toMatch(
      /ADD CONSTRAINT[\s\S]*CHECK[\s\S]*sample_quality/i,
    )
  })

  it('updates the security runner for quality-aware RPCs and enforcement coverage', () => {
    const migration = readMigration()
    const normalized = normalizeSql(migration)

    for (const checker of [
      'test_security_definer_rpc_execute_privileges',
      'test_security_definer_rpc_search_path',
      'test_sample_accession_rpcs_require_analyst_role',
    ]) {
      expect(normalized).toMatch(
        new RegExp(
          `to_regprocedure\\('public\\.${checker}\\(\\)'\\)`,
          'i',
        ),
      )
    }
    expect(normalized).toContain(
      'CREATE OR REPLACE FUNCTION public.test_sample_quality_enforcement()',
    )
    expect(normalized).toMatch(
      /Sample Quality Enforcement'{1,2}::TEXT,\s*test_sample_quality_enforcement\(\)/i,
    )
    expect(normalized).toContain(
      "'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)'",
    )
    expect(normalized).toContain(
      "'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)'",
    )
    expect(normalized).toMatch(
      /audit_samples_trigger[\s\S]*trigger_audit_log[\s\S]*to_jsonb\(NEW\)/i,
    )
    expect(normalized).toMatch(
      /v_audit_definition[\s\S]*changed_by[\s\S]*auth\\?\.uid\(\)/i,
    )
    expect(normalized).toMatch(
      /public\.samples[\s\S]*relrowsecurity[\s\S]*Analysts can insert own samples/i,
    )
    expect(normalized).toMatch(
      /samples_require_quality_on_insert[\s\S]*BEFORE INSERT/i,
    )
    expect(normalized).toMatch(
      /run_security_tests\(\)[\s\S]*Sample Quality Enforcement/i,
    )
  })

  it('makes every direct sample fixture provide an explicit quality value', () => {
    for (const fixturePath of directInsertFixturePaths) {
      const sql = readFileSync(join(process.cwd(), fixturePath), 'utf8')
      const inserts = extractSampleInsertColumns(sql)

      expect(inserts.length, `${fixturePath} has no sample fixture`).toBeGreaterThan(
        0,
      )
      for (const columns of inserts) {
        expect(columns, fixturePath).toContain('sample_quality')
      }
    }
  })

  it('defines a post-apply runtime regression for enforcement and compatibility', () => {
    const runtimeTest = existsSync(runtimeTestPath)
      ? readFileSync(runtimeTestPath, 'utf8')
      : ''
    const normalized = normalizeSql(runtimeTest)

    expect(existsSync(runtimeTestPath)).toBe(true)
    expect(normalized).toMatch(
      /to_regprocedure\('public\.create_sample_atomic\(uuid,text,timestamp with time zone,uuid,text\)'\) IS NULL/i,
    )
    expect(normalized).toMatch(
      /to_regprocedure\('public\.accession_and_assign_tests\(uuid,text,timestamp with time zone,jsonb,text\)'\) IS NULL/i,
    )
    expect(normalized).toContain(
      'ALTER TABLE public.samples DISABLE TRIGGER samples_require_quality_on_insert',
    )
    expect(normalized).toContain(
      'ALTER TABLE public.samples ENABLE TRIGGER samples_require_quality_on_insert',
    )
    expect(normalized).toMatch(
      /INSERT INTO public\.samples[\s\S]*sample_quality[\s\S]*NULL/i,
    )
    expect(normalized).toMatch(
      /UPDATE public\.samples[\s\S]*sample_quality IS NULL/i,
    )
    expect(normalized).toMatch(
      /new_values->'sample_quality'[\s\S]*audit_logs[\s\S]*'false'::JSONB/i,
    )
    expect(normalized).toMatch(
      /SET LOCAL ROLE authenticated[\s\S]*request\.jwt\.claims[\s\S]*create_sample_atomic[\s\S]*changed_by = v_analyst_id/i,
    )
    expect(normalized).toMatch(
      /run_security_tests\(\)[\s\S]*test_name = 'Sample Quality Enforcement'[\s\S]*passed/i,
    )
  })
})

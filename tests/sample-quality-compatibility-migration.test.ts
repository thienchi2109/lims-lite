import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/189_add_sample_quality_compatibility.sql',
)

function readMigration() {
  return existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : ''
}

function normalizeSql(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sqlStatements(sql: string) {
  return normalizeSql(sql)
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
}

function extractQualityAwareFunction(sql: string, functionName: string) {
  const normalized = normalizeSql(sql)
  const match = normalized.match(
    new RegExp(
      `CREATE FUNCTION public\\.${functionName}\\([\\s\\S]*?p_sample_quality BOOLEAN\\s*\\) RETURNS JSONB[\\s\\S]*?AS \\$\\$[\\s\\S]*?\\$\\$;`,
      'i',
    ),
  )

  expect(match, `missing quality-aware ${functionName} overload`).not.toBeNull()
  return match?.[0] ?? ''
}

function expectNoDefaultOrBackfill(sql: string) {
  const normalized = normalizeSql(sql)

  expect(normalized).not.toMatch(
    /\bALTER TABLE(?: ONLY)? public\.samples ALTER(?: COLUMN)? sample_quality SET DEFAULT\b/i,
  )
  expect(normalized).not.toMatch(
    /\bUPDATE\s+(?:ONLY\s+)?public\.samples\b[^;]*\bSET\b[^;]*\bsample_quality\s*=/i,
  )
}

function expectLegacySignaturesRetained(sql: string) {
  const legacyDrops = sqlStatements(sql).filter(
    (statement) =>
      /^DROP\s+(?:FUNCTION|ROUTINE)\b/i.test(statement) &&
      /public\.(?:create_sample_atomic|accession_and_assign_tests)\s*\(/i.test(
        statement,
      ),
  )

  expect(legacyDrops).toEqual([])
}

function expectAuthenticatedOnlyGrants(sql: string) {
  const createSignature =
    'public.create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID, TEXT, BOOLEAN)'
  const assignSignature =
    'public.accession_and_assign_tests(UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT, BOOLEAN)'
  const statements = sqlStatements(sql)
  const grantStatements = statements.filter((statement) =>
    /^GRANT\b/i.test(statement),
  )
  const revokeStatements = statements.filter((statement) =>
    /^REVOKE\b/i.test(statement),
  )

  expect(revokeStatements).toEqual([
    `REVOKE ALL ON FUNCTION ${createSignature} FROM PUBLIC, anon, authenticated, service_role;`,
    `REVOKE ALL ON FUNCTION ${assignSignature} FROM PUBLIC, anon, authenticated, service_role;`,
  ].map((statement) => statement.slice(0, -1)))
  expect(grantStatements).toEqual([
    `GRANT EXECUTE ON FUNCTION ${createSignature} TO authenticated`,
    `GRANT EXECUTE ON FUNCTION ${assignSignature} TO authenticated`,
  ])
}

describe('sample quality compatibility migration', () => {
  it('adds a nullable sample quality column without a default or backfill', () => {
    const migration = readMigration()

    expect(existsSync(migrationPath)).toBe(true)
    expect(normalizeSql(migration)).toContain(
      'ALTER TABLE public.samples ADD COLUMN sample_quality BOOLEAN NULL;',
    )
    expectNoDefaultOrBackfill(migration)
    expect(migration).toContain('Security impact:')
    expect(migration).toContain('Historical data impact:')
  })

  it('detects PostgreSQL default and backfill syntax variants', () => {
    const migration = readMigration()

    expect(() =>
      expectNoDefaultOrBackfill(
        `${migration}
        ALTER TABLE public.samples ALTER sample_quality SET DEFAULT false;`,
      ),
    ).toThrow()
    expect(() =>
      expectNoDefaultOrBackfill(
        `${migration}
        UPDATE ONLY public.samples SET sample_quality = false;`,
      ),
    ).toThrow()
  })

  it('adds two independently hardened quality-aware overloads', () => {
    const migration = readMigration()
    const createFunction = extractQualityAwareFunction(
      migration,
      'create_sample_atomic',
    )
    const assignFunction = extractQualityAwareFunction(
      migration,
      'accession_and_assign_tests',
    )

    expect(createFunction).toMatch(
      /create_sample_atomic\(\s*p_client_id UUID,\s*p_client_name TEXT,\s*p_received_at TIMESTAMPTZ,\s*p_received_by UUID,\s*p_type TEXT,\s*p_sample_quality BOOLEAN\s*\)/i,
    )
    expect(assignFunction).toMatch(
      /accession_and_assign_tests\(\s*p_client_id UUID,\s*p_client_name TEXT,\s*p_received_at TIMESTAMPTZ,\s*p_tests JSONB,\s*p_type TEXT,\s*p_sample_quality BOOLEAN\s*\)/i,
    )

    for (const functionDefinition of [createFunction, assignFunction]) {
      expect(functionDefinition).toContain('SECURITY DEFINER')
      expect(functionDefinition).toContain(
        'SET search_path = public, extensions',
      )
      expect(functionDefinition).toContain("v_user_role <> 'analyst'")
      expect(functionDefinition).toContain('IF p_sample_quality IS NULL THEN')
      expect(functionDefinition).toMatch(
        /sample_quality,\s*received_at[\s\S]*?p_sample_quality,\s*COALESCE/i,
      )
    }

    expect(createFunction).toContain("'sample_quality', sample_quality")
    expect(assignFunction).toContain("'sample_quality', p_sample_quality")
  })

  it('preserves the authenticated-only execute privilege matrix', () => {
    const migration = readMigration()
    const normalized = normalizeSql(migration)

    expectAuthenticatedOnlyGrants(migration)
    expect(() =>
      expectAuthenticatedOnlyGrants(
        `${migration}
        GRANT EXECUTE ON FUNCTION public.create_sample_atomic(
          UUID, TEXT, TIMESTAMPTZ, UUID, TEXT, BOOLEAN
        ) TO service_role WITH GRANT OPTION;`,
      ),
    ).toThrow()
    expect(() =>
      expectAuthenticatedOnlyGrants(
        `${migration}
        GRANT ALL PRIVILEGES ON FUNCTION public.accession_and_assign_tests(
          UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT, BOOLEAN
        ) TO service_role;`,
      ),
    ).toThrow()

    for (const role of ['anon', 'service_role']) {
      expect(normalized).toContain(
        `has_function_privilege('${role}', v_create_quality, 'EXECUTE')`,
      )
      expect(normalized).toContain(
        `has_function_privilege('${role}', v_assign_quality, 'EXECUTE')`,
      )
    }
    expect(normalized).toContain(
      "has_function_privilege('authenticated', v_create_quality, 'EXECUTE')",
    )
    expect(normalized).toContain(
      "has_function_privilege('authenticated', v_assign_quality, 'EXECUTE')",
    )
  })

  it('retains legacy signatures and detects formatted drop statements', () => {
    const migration = readMigration()

    expect(migration).toContain(
      "to_regprocedure('public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text)')",
    )
    expect(migration).toContain(
      "to_regprocedure('public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text)')",
    )
    expectLegacySignaturesRetained(migration)
    expect(() =>
      expectLegacySignaturesRetained(
        `${migration}
        drop function if exists public.create_sample_atomic(
          uuid, text, timestamptz, uuid, text
        );`,
      ),
    ).toThrow()
    expect(() =>
      expectLegacySignaturesRetained(
        `${migration}
        DROP FUNCTION public.accession_and_assign_tests(
          uuid, text, timestamp with time zone, jsonb, text
        );`,
      ),
    ).toThrow()
    expect(() =>
      expectLegacySignaturesRetained(
        `${migration}
        DROP ROUTINE public.create_sample_atomic(
          uuid, text, timestamp with time zone, uuid, text
        );`,
      ),
    ).toThrow()
  })
})

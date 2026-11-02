// Source contracts only: these checks do not execute PostgreSQL or prove RLS.
// The rollback-only SQL fixture is reserved for the authorized runtime gate.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(process.cwd(), 'supabase/migrations/232_add_accession_template_snapshot.sql')

function readMigration(): string {
  return existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : ''
}

function snapshotFunction(): string {
  const sql = readMigration()
  const start = sql.indexOf('CREATE FUNCTION public.get_accession_template_snapshot()')
  const end = sql.indexOf('$$;', start)
  return sql.slice(start, end + 3).replace(/--[^\n]*/g, '').replace(/\s+/g, ' ')
}

describe('accession template snapshot authority (source only)', () => {
  it('adds a forward-only RPC after checking the schema/security baseline', () => {
    const sql = readMigration()
    expect(sql).toContain('DO $baseline$')
    expect(sql).toContain('DO $verification$')
    expect(sql).toContain('information_schema.columns')
    expect(sql).toContain('relrowsecurity')
    expect(sql).toContain('has_table_privilege')
    expect(sql).not.toMatch(/CREATE OR REPLACE|ALTER TABLE|CREATE POLICY|GRANT SELECT/i)
  })

  it('requires authenticated analyst before reading any catalog', () => {
    const sql = snapshotFunction()
    const guard = sql.indexOf("public.get_user_role() IS DISTINCT FROM 'analyst'")
    expect(guard).toBeGreaterThan(0)
    expect(guard).toBeLessThan(sql.indexOf('WITH published_revision'))
    expect(sql).toContain('auth.uid() IS NULL')
    expect(sql).toContain("ERRCODE = '42501'")
    expect(sql).toContain('STABLE SECURITY DEFINER SET search_path = public, pg_temp')
    expect(readMigration().replace(/\s+/g, ' ')).toContain(
      'REVOKE ALL ON FUNCTION public.get_accession_template_snapshot() FROM PUBLIC, anon, authenticated, service_role;',
    )
    expect(readMigration()).toContain('GRANT EXECUTE ON FUNCTION public.get_accession_template_snapshot() TO authenticated;')
  })

  it('rejects soft-deleted analyst profiles even when get_user_role still returns analyst', () => {
    const sql = snapshotFunction()
    expect(sql).toContain('FROM public.users AS caller')
    expect(sql).toContain('caller.id = auth.uid() AND caller.deleted_at IS NULL')
    expect(sql.indexOf('FROM public.users AS caller')).toBeLessThan(sql.indexOf('WITH published_revision'))
    expect(readMigration()).toContain("('users', 'deleted_at', 'timestamp with time zone', 'YES')")
  })

  it('reads revision, entities and pairs in one statement snapshot', () => {
    const sql = snapshotFunction()
    expect(sql).toContain('WITH published_revision AS MATERIALIZED')
    expect(sql).toContain("WHERE revision.status = 'published'")
    expect(sql).toContain('eligible_pairs AS MATERIALIZED')
    expect(sql).toContain('compatibility.revision_id = revision.id')
    expect(sql.match(/INTO v_snapshot/g)).toHaveLength(1)
    expect(sql).not.toMatch(/LIMIT 1|FOR UPDATE/)
    expect(sql).toContain("'revisionNumber', revision.revision_number::TEXT")
    expect(sql).toContain("'revisionId', revision.id")
  })

  it('filters stale, removed, deleted and unconfigured pairs against canonical generations', () => {
    const sql = snapshotFunction()
    for (const predicate of [
      'compatibility.removed_at IS NULL', "review.disposition = 'configured'",
      'assay.deleted_at IS NULL', 'sample_type.deleted_at IS NULL',
      'review.assay_compatibility_generation = assay.compatibility_generation',
      'compatibility.assay_compatibility_generation = assay.compatibility_generation',
      'compatibility.sample_type_compatibility_generation = sample_type.compatibility_generation',
    ]) expect(sql).toContain(predicate)
    expect(sql).not.toContain('assay_sample_type_candidates')
  })

  it('returns unique referenced entities with lossless code/UUID/generation and labels', () => {
    const sql = snapshotFunction()
    for (const key of ['sampleTypes', 'assays', 'pairs', 'sampleTypeId', 'assayDefinitionId', 'importCode', 'compatibilityGeneration', 'methodName']) {
      expect(sql).toContain(`'${key}'`)
    }
    expect(sql).toContain("'compatibilityGeneration', sample_type.compatibility_generation::TEXT")
    expect(sql).toContain("'compatibilityGeneration', assay.compatibility_generation::TEXT")
    expect(sql).toContain('FROM eligible_pairs AS pair WHERE pair.sample_type_id = sample_type.id')
    expect(sql).toContain('FROM eligible_pairs AS pair WHERE pair.assay_definition_id = assay.id')
    expect(sql).toContain('SELECT DISTINCT compatibility.sample_type_id, compatibility.assay_definition_id')
    expect(sql).toContain('ORDER BY sample_type.import_code')
    expect(sql).toContain('ORDER BY assay.import_code')
  })

  it('fails closed on missing published revision or no eligible pair', () => {
    const sql = snapshotFunction()
    expect(sql).toContain('IF v_snapshot IS NULL')
    expect(sql).toContain("jsonb_array_length(v_snapshot -> 'pairs') = 0")
    expect(sql).toContain("RAISE EXCEPTION 'ACCESSION_TEMPLATE_CATALOG_UNAVAILABLE'")
    expect(sql).toContain("ERRCODE = 'P0001'")
  })

  it('preserves immutable catalog migrations and legacy publish/read contracts', () => {
    for (const [file, digest] of [
      ['205_recover_sample_type_master_data.sql', 'bfabbf645e4424f5e21fada5651ef1aa55a59b26af38464ea393e59d350c5de9'],
      ['206_add_assay_sample_type_compatibility_revision_core.sql', 'b8715e71762bde41b39ea5a441298adfd8c121e9816a9cdda79c56c2eadc3892'],
      ['208_add_assay_sample_type_catalog_rpcs.sql', 'd187066f5484875b2336de4e62b15c59c459076b22172f99e6c9c7e25bc08cd0'],
      ['210_allow_reviewed_compatibility_draft_hash.sql', '11f6dc8bb8d05c20b6b1456ca6c51cfb29508941a558ae271ff119305b2eeb42'],
    ]) {
      expect(createHash('sha256').update(readFileSync(join(process.cwd(), 'supabase/migrations', file))).digest('hex')).toBe(digest)
    }
    expect(readMigration()).not.toMatch(/(?:CREATE|DROP) FUNCTION public\.(?:get_published_assay_sample_type_catalog|publish_assay_sample_type_catalog_revision)\b/)
  })
})

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/206_add_assay_sample_type_compatibility_revision_core.sql',
)

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

describe('assay sample-type compatibility revision migration', () => {
  it('pins the Phase 1 baseline and runs atomically', () => {
    const migration = readMigration()
    const normalized = normalizeSql(migration)

    expect(existsSync(migrationPath)).toBe(true)
    expect(migration).toContain('Security impact:')
    expect(migration).toContain('Historical data impact:')
    expect(normalized).toMatch(/^BEGIN;/i)
    expect(normalized).toMatch(/COMMIT;$/i)
    expect(normalized).toMatch(
      /LOCK TABLE public\.assay_definitions IN ACCESS EXCLUSIVE MODE/i,
    )
    expect(normalized).toMatch(
      /LOCK TABLE public\.sample_types, public\.samples, public\.results IN SHARE ROW EXCLUSIVE MODE/i,
    )

    for (const tableName of [
      'assay_definitions',
      'sample_types',
      'samples',
      'results',
      'audit_logs',
    ]) {
      expect(normalized).toContain(
        `to_regclass('public.${tableName}') IS NULL`,
      )
    }

    for (const tableName of [
      'assay_sample_type_catalog_revisions',
      'assay_sample_type_reviews',
      'assay_sample_type_compatibilities',
      'assay_sample_type_candidates',
    ]) {
      expect(normalized).toContain(
        `to_regclass('public.${tableName}') IS NOT NULL`,
      )
    }

    expect(normalized).toMatch(
      /table_name = 'sample_types'[\s\S]*column_name = 'compatibility_generation'[\s\S]*data_type = 'bigint'[\s\S]*is_nullable = 'NO'/i,
    )
    expect(normalized).toMatch(
      /table_name = 'samples'[\s\S]*column_name = 'sample_type_id'[\s\S]*data_type = 'uuid'[\s\S]*is_nullable = 'NO'/i,
    )
    expect(normalized).toMatch(
      /table_name = 'results'[\s\S]*column_name = 'assay_id'[\s\S]*data_type = 'uuid'[\s\S]*is_nullable = 'NO'/i,
    )
    expect(normalized).toContain(
      "tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE",
    )
    expect(normalized).toContain(
      "tgname = 'sample_types_maintain_lifecycle'",
    )
    expect(normalized).toContain(
      "tgfoid = 'public.maintain_sample_type_lifecycle()'::REGPROCEDURE",
    )
  })

  it('adds database-owned assay lifecycle generation', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /ALTER TABLE public\.assay_definitions ADD COLUMN compatibility_generation BIGINT NOT NULL DEFAULT 1/i,
    )
    expect(normalized).toMatch(
      /ADD CONSTRAINT assay_definitions_compatibility_generation_positive CHECK \(compatibility_generation >= 1\)/i,
    )
    expect(normalized).toMatch(
      /CREATE FUNCTION public\.maintain_assay_compatibility_generation\(\) RETURNS TRIGGER/i,
    )
    expect(normalized).toMatch(
      /IF TG_OP = 'INSERT' THEN NEW\.compatibility_generation := 1/i,
    )
    expect(normalized).toMatch(
      /NEW\.method_name IS DISTINCT FROM OLD\.method_name[\s\S]*OR \(NEW\.deleted_at IS NULL\) IS DISTINCT FROM \(OLD\.deleted_at IS NULL\)[\s\S]*NEW\.compatibility_generation := OLD\.compatibility_generation \+ 1/i,
    )
    expect(normalized).toMatch(
      /CREATE TRIGGER assay_definitions_maintain_compatibility_generation BEFORE INSERT OR UPDATE OF method_name, deleted_at, compatibility_generation ON public\.assay_definitions FOR EACH ROW EXECUTE FUNCTION public\.maintain_assay_compatibility_generation\(\)/i,
    )
  })

  it('creates revision headers with single-draft and single-published invariants', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /CREATE TABLE public\.assay_sample_type_catalog_revisions \([\s\S]*revision_number BIGINT NOT NULL[\s\S]*status TEXT NOT NULL[\s\S]*source_revision_id UUID[\s\S]*created_actor_type TEXT NOT NULL[\s\S]*created_by UUID[\s\S]*content_hash TEXT[\s\S]*published_by UUID[\s\S]*published_at TIMESTAMPTZ[\s\S]*publish_reason TEXT[\s\S]*superseded_by UUID[\s\S]*superseded_at TIMESTAMPTZ/i,
    )
    expect(normalized).toMatch(
      /CHECK \(status IN \('draft', 'published', 'superseded'\)\)/i,
    )
    expect(normalized).toMatch(
      /CHECK \(created_actor_type IN \('system_migration', 'manager'\)\)/i,
    )
    expect(normalized).toMatch(
      /CHECK \(\(revision_number = 1 AND source_revision_id IS NULL\) OR \(revision_number > 1 AND source_revision_id IS NOT NULL\)\)/i,
    )
    expect(normalized).toMatch(
      /CREATE UNIQUE INDEX uq_assay_sample_type_catalog_one_draft ON public\.assay_sample_type_catalog_revisions \(\(TRUE\)\) WHERE status = 'draft'/i,
    )
    expect(normalized).toMatch(
      /CREATE UNIQUE INDEX uq_assay_sample_type_catalog_one_published ON public\.assay_sample_type_catalog_revisions \(\(TRUE\)\) WHERE status = 'published'/i,
    )
  })

  it('creates review, allowlist, and historical candidate snapshots', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /CREATE TABLE public\.assay_sample_type_reviews \([\s\S]*revision_id UUID NOT NULL[\s\S]*assay_definition_id UUID NOT NULL[\s\S]*disposition TEXT NOT NULL[\s\S]*assay_compatibility_generation BIGINT NOT NULL[\s\S]*reviewed_by UUID[\s\S]*reviewed_at TIMESTAMPTZ[\s\S]*reason TEXT/i,
    )
    expect(normalized).toMatch(
      /CHECK \(disposition IN \('configured', 'not_assignable'\)\)/i,
    )
    expect(normalized).toMatch(
      /UNIQUE \(revision_id, assay_definition_id\)/i,
    )

    expect(normalized).toMatch(
      /CREATE TABLE public\.assay_sample_type_compatibilities \([\s\S]*revision_id UUID NOT NULL[\s\S]*assay_definition_id UUID NOT NULL[\s\S]*sample_type_id UUID NOT NULL[\s\S]*assay_compatibility_generation BIGINT NOT NULL[\s\S]*sample_type_compatibility_generation BIGINT NOT NULL[\s\S]*provenance TEXT NOT NULL[\s\S]*source_candidate_id UUID[\s\S]*removed_at TIMESTAMPTZ/i,
    )
    expect(normalized).toMatch(
      /CHECK \(provenance IN \('manual', 'historical_candidate'\)\)/i,
    )
    expect(normalized).toMatch(
      /UNIQUE \(revision_id, assay_definition_id, sample_type_id\)/i,
    )

    expect(normalized).toMatch(
      /CREATE TABLE public\.assay_sample_type_candidates \([\s\S]*revision_id UUID NOT NULL[\s\S]*assay_definition_id UUID NOT NULL[\s\S]*sample_type_id UUID NOT NULL[\s\S]*provenance TEXT NOT NULL DEFAULT 'historical_observation'[\s\S]*observation_count BIGINT NOT NULL[\s\S]*first_observed_at TIMESTAMPTZ NOT NULL[\s\S]*last_observed_at TIMESTAMPTZ NOT NULL[\s\S]*assay_compatibility_generation BIGINT NOT NULL[\s\S]*sample_type_compatibility_generation BIGINT NOT NULL[\s\S]*decision TEXT/i,
    )
    expect(normalized).toMatch(
      /CHECK \(provenance = 'historical_observation'\)/i,
    )
    expect(normalized).toMatch(
      /CHECK \(decision IS NULL OR decision IN \('accepted', 'rejected'\)\)/i,
    )
  })

  it('bootstraps revision 1 and candidates without granting authority', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /INSERT INTO public\.assay_sample_type_catalog_revisions \([\s\S]*revision_number[\s\S]*status[\s\S]*source_revision_id[\s\S]*created_actor_type[\s\S]*creation_reason[\s\S]*\) VALUES \([\s\S]*1[\s\S]*'draft'[\s\S]*NULL[\s\S]*'system_migration'[\s\S]*'Initial compatibility catalog bootstrap'/i,
    )
    expect(normalized).toMatch(
      /INSERT INTO public\.assay_sample_type_candidates \([\s\S]*SELECT[\s\S]*result\.assay_id[\s\S]*sample\.sample_type_id[\s\S]*'historical_observation'[\s\S]*count\(\*\)[\s\S]*min\(result\.created_at\)[\s\S]*max\(result\.created_at\)[\s\S]*GROUP BY[\s\S]*result\.assay_id[\s\S]*sample\.sample_type_id/i,
    )
    expect(normalized).not.toMatch(
      /INSERT INTO public\.assay_sample_type_reviews\b/i,
    )
    expect(normalized).not.toMatch(
      /INSERT INTO public\.assay_sample_type_compatibilities\b/i,
    )
  })

  it('makes published catalog content immutable and every mutation auditable', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /CREATE FUNCTION public\.guard_compatibility_revision_mutation\(\) RETURNS TRIGGER/i,
    )
    expect(normalized).toMatch(
      /OLD\.status = 'published'[\s\S]*NEW\.status = 'superseded'/i,
    )
    expect(normalized).toMatch(
      /OLD\.status = 'superseded'[\s\S]*RAISE EXCEPTION/i,
    )
    expect(normalized).toMatch(
      /CREATE FUNCTION public\.guard_compatibility_entry_mutation\(\) RETURNS TRIGGER/i,
    )
    expect(normalized).toMatch(
      /IF TG_OP = 'DELETE' THEN RAISE EXCEPTION/i,
    )
    expect(normalized).toMatch(
      /v_revision_status IS DISTINCT FROM 'draft'[\s\S]*RAISE EXCEPTION/i,
    )

    for (const [tableName, triggerName] of [
      [
        'assay_sample_type_catalog_revisions',
        'audit_assay_sample_type_catalog_revisions',
      ],
      ['assay_sample_type_reviews', 'audit_assay_sample_type_reviews'],
      [
        'assay_sample_type_compatibilities',
        'audit_assay_sample_type_compatibilities',
      ],
      ['assay_sample_type_candidates', 'audit_assay_sample_type_candidates'],
    ]) {
      expect(normalized).toMatch(
        new RegExp(
          `CREATE TRIGGER ${triggerName} AFTER INSERT OR UPDATE OR DELETE ON public\\.${tableName} FOR EACH ROW EXECUTE FUNCTION public\\.trigger_audit_log\\(\\)`,
          'i',
        ),
      )
    }
  })

  it('keeps catalog tables internal until Phase 3 RPCs exist', () => {
    const normalized = normalizeSql(readMigration())

    for (const tableName of [
      'assay_sample_type_catalog_revisions',
      'assay_sample_type_reviews',
      'assay_sample_type_compatibilities',
      'assay_sample_type_candidates',
    ]) {
      expect(normalized).toContain(
        `ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY`,
      )
      expect(normalized).toContain(
        `REVOKE ALL ON TABLE public.${tableName} FROM PUBLIC, anon, authenticated, service_role`,
      )
      expect(normalized).toContain(
        `GRANT SELECT ON TABLE public.${tableName} TO service_role`,
      )
    }

    expect(normalized).not.toMatch(/\bCREATE POLICY\b/i)
    expect(normalized).not.toMatch(
      /GRANT (?:INSERT|UPDATE|DELETE) ON TABLE public\.assay_sample_type_/i,
    )
  })

  it('verifies bootstrap integrity and preserves assignment behavior', () => {
    const normalized = normalizeSql(readMigration())
    const createdFunctions = Array.from(
      normalized.matchAll(
        /CREATE(?: OR REPLACE)? FUNCTION public\.([a-z0-9_]+)\(/gi,
      ),
      (match) => match[1],
    )

    expect(createdFunctions).toEqual([
      'maintain_assay_compatibility_generation',
      'guard_compatibility_revision_mutation',
      'guard_compatibility_entry_mutation',
    ])
    expect(normalized).toMatch(
      /count\(\*\) INTO v_revision_count FROM public\.assay_sample_type_catalog_revisions WHERE revision_number = 1 AND status = 'draft' AND source_revision_id IS NULL/i,
    )
    expect(normalized).toMatch(
      /count\(\*\) INTO v_candidate_count FROM public\.assay_sample_type_candidates/i,
    )
    expect(normalized).toMatch(
      /count\(\*\) INTO v_expected_candidate_count FROM \(SELECT DISTINCT result\.assay_id, sample\.sample_type_id FROM public\.results AS result JOIN public\.samples AS sample ON sample\.id = result\.sample_id\)/i,
    )
    expect(normalized).toMatch(
      /count\(\*\) INTO v_review_count FROM public\.assay_sample_type_reviews/i,
    )
    expect(normalized).toMatch(
      /count\(\*\) INTO v_compatibility_count FROM public\.assay_sample_type_compatibilities/i,
    )
    expect(normalized).toMatch(
      /new_values ->> 'created_actor_type' = 'system_migration'/i,
    )
    expect(normalized).not.toMatch(
      /CREATE(?: OR REPLACE)? FUNCTION public\.(?:resolve|publish|clone|update)_assay_sample_type/i,
    )
    expect(normalized).not.toMatch(
      /CREATE(?: OR REPLACE)? FUNCTION public\.(?:accession_and_assign_tests|assign_tests_to_sample|create_sample_atomic)\(/i,
    )
    expect(normalized).not.toMatch(
      /DROP FUNCTION [^;]*(?:accession_and_assign_tests|assign_tests_to_sample|create_sample_atomic)/i,
    )
    expect(normalized).not.toMatch(/\bALTER TABLE public\.results\b/i)
  })
})

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/229_restore_active_assay_availability.sql',
)

const immutableMigrationHashes = new Map([
  ['206_add_assay_sample_type_compatibility_revision_core.sql', 'b8715e71762bde41b39ea5a441298adfd8c121e9816a9cdda79c56c2eadc3892'],
  ['207_add_compatibility_catalog_service_role_policies.sql', 'dff8e0ffc3f00ef66a4b5b4d858e15b480335d729c65115b2ea154222bbf9e7f'],
  ['208_add_assay_sample_type_catalog_rpcs.sql', 'd187066f5484875b2336de4e62b15c59c459076b22172f99e6c9c7e25bc08cd0'],
  ['209_expose_compatibility_catalog_stale_state.sql', 'f567ef736755cba2b1354827f04a8c0e7018f17720dfa55a7920d323894785e9'],
  ['210_allow_reviewed_compatibility_draft_hash.sql', '11f6dc8bb8d05c20b6b1456ca6c51cfb29508941a558ae271ff119305b2eeb42'],
  ['211_add_assay_sample_type_assignment_v2.sql', '221eedf69644e5c42749b35c029c6936a9cf777c2843a4e48db7e90fc03394a0'],
  ['212_recover_assay_sample_type_assignment_v2.sql', '489365236c355498c46ef8d7e72076c83f07ef08bbf160da3c7012de8d8791e3'],
  ['213_enforce_assay_sample_type_compatibility.sql', '5b37a7422d2a69a99e1bf7dd7eaa5e68fd9ce4467b1551babdd30594abdf2269'],
])

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

describe('active assay availability recovery migration', () => {
  it('preserves applied compatibility migrations and adds migration 229', () => {
    for (const [fileName, expectedHash] of immutableMigrationHashes) {
      const contents = readFileSync(
        join(process.cwd(), 'supabase/migrations', fileName),
      )
      expect(
        createHash('sha256').update(contents).digest('hex'),
        fileName,
      ).toBe(expectedHash)
    }

    expect(existsSync(migrationPath)).toBe(true)
  })

  it('uses one guarded transaction with an explicit rollback strategy', () => {
    const migration = readMigration()
    const normalized = normalizeSql(migration)

    expect(normalized).toMatch(/^BEGIN;/i)
    expect(normalized).toContain('SET LOCAL search_path TO public, extensions;')
    expect(normalized).toContain('pg_advisory_xact_lock(208110)')
    expect(migration).toMatch(/Rollback strategy:/i)
    expect(normalized).toMatch(/COMMIT;$/i)
  })

  it('fails closed unless the reviewed production baseline still matches', () => {
    const normalized = normalizeSql(readMigration())

    for (const requiredRelation of [
      'auth.users',
      'public.assay_definitions',
      'public.audit_logs',
      'public.sample_types',
      'public.users',
      'public.assay_sample_type_catalog_revisions',
      'public.assay_sample_type_reviews',
      'public.assay_sample_type_candidates',
      'public.assay_sample_type_compatibilities',
    ]) {
      expect(normalized).toContain(`to_regclass('${requiredRelation}')`)
    }

    for (const requiredProcedure of [
      'public.clone_assay_sample_type_catalog_revision(bigint,text)',
      'public.compute_assay_sample_type_catalog_hash(uuid)',
      'public.update_assay_sample_type_catalog_review(uuid,uuid,text,text,uuid[],jsonb,timestamp with time zone)',
      'public.review_assay_sample_type_catalog_revision(uuid,timestamp with time zone)',
      'public.publish_assay_sample_type_catalog_revision(uuid,timestamp with time zone,text)',
    ]) {
      expect(normalized).toContain(`to_regprocedure('${requiredProcedure}')`)
    }

    expect(normalized).toContain("revision.revision_number = 1")
    expect(normalized).toContain("revision.status = 'published'")
    expect(normalized).toContain("revision.status = 'draft'")
    expect(normalized).toContain("sample_type.import_code = 'LM-000001'")
    expect(normalized).toContain('assay_definition.deleted_at IS NULL')
    expect(normalized).toContain('v_active_assay_count IS DISTINCT FROM 84')
    expect(normalized).toContain('v_configured_assay_count IS DISTINCT FROM 25')
    expect(normalized).toContain('v_hidden_active_assay_count IS DISTINCT FROM 59')
    expect(normalized).toContain(
      "v_expected_source_content_hash CONSTANT TEXT := '0cdcea589e48a88d6ed2c51619436bc872e6400b7ccc1d9f75db900ce49b165a'",
    )
    expect(normalized).toContain(
      'v_source_stored_content_hash IS DISTINCT FROM v_expected_source_content_hash',
    )
    expect(normalized).toContain(
      'v_source_computed_content_hash IS DISTINCT FROM v_expected_source_content_hash',
    )
    expect(normalized).toContain(
      "'public.trigger_audit_log()'::REGPROCEDURE",
    )
    expect(normalized).toContain('v_audit_trigger_count IS DISTINCT FROM 4')
    for (const triggerName of [
      'audit_assay_sample_type_catalog_revisions',
      'audit_assay_sample_type_reviews',
      'audit_assay_sample_type_candidates',
      'audit_assay_sample_type_compatibilities',
    ]) {
      expect(normalized).toContain(`'${triggerName}'`)
    }
  })

  it('uses the active system manager and existing catalog RPC workflow', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toContain(
      "v_system_actor_id CONSTANT UUID := '00000000-0000-0000-0000-000000000000'",
    )
    expect(normalized).toContain("user_profile.role = 'manager'")
    expect(normalized).toContain('auth_user.deleted_at IS NULL')
    expect(normalized).toContain(
      '(auth_user.banned_until IS NULL OR auth_user.banned_until <= now())',
    )
    expect(normalized).toContain(
      "set_config('request.jwt.claims', jsonb_build_object(",
    )
    expect(normalized).toContain("'role', 'authenticated'")
    expect(normalized).toContain('auth.uid() IS DISTINCT FROM v_system_actor_id')
    expect(normalized).toContain(
      "public.get_user_role() IS DISTINCT FROM 'manager'",
    )
    expect(normalized).toContain(
      'public.clone_assay_sample_type_catalog_revision(',
    )
    expect(normalized).toContain(
      'public.update_assay_sample_type_catalog_review(',
    )
    expect(normalized).toContain(
      'public.review_assay_sample_type_catalog_revision(',
    )
    expect(normalized).toContain(
      'public.publish_assay_sample_type_catalog_revision(',
    )
  })

  it('chains optimistic revision tokens through update, review, and publish', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /v_clone_result := public\.clone_assay_sample_type_catalog_revision\([\s\S]*v_revision_updated_at := \(v_clone_result ->> 'updatedAt'\)::TIMESTAMPTZ/i,
    )
    expect(normalized).toMatch(
      /v_update_result := public\.update_assay_sample_type_catalog_review\([\s\S]*v_candidate_decisions, v_revision_updated_at\); v_revision_updated_at := \(v_update_result ->> 'updatedAt'\)::TIMESTAMPTZ/i,
    )
    expect(normalized).toMatch(
      /v_review_result := public\.review_assay_sample_type_catalog_revision\(v_draft_revision_id, v_revision_updated_at\); v_revision_updated_at := \(v_review_result ->> 'updatedAt'\)::TIMESTAMPTZ/i,
    )
    expect(normalized).toMatch(
      /v_publish_result := public\.publish_assay_sample_type_catalog_revision\(v_draft_revision_id, v_revision_updated_at,/i,
    )
  })

  it('restores exactly the active not-assignable assays for Mau', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /FROM public\.assay_sample_type_reviews AS review JOIN public\.assay_definitions AS assay_definition[\s\S]*review\.revision_id = v_draft_revision_id[\s\S]*review\.disposition = 'not_assignable'[\s\S]*assay_definition\.deleted_at IS NULL/i,
    )
    expect(normalized).toContain(
      "jsonb_build_object('candidate_id', candidate.id, 'decision',",
    )
    expect(normalized).toContain(
      "WHEN candidate.sample_type_id = v_blood_sample_type_id THEN 'accepted'",
    )
    expect(normalized).toContain(
      'ARRAY[v_blood_sample_type_id]::UUID[]',
    )
    expect(normalized).toContain("'configured'")
    expect(normalized).toContain('v_recovered_assay_count := v_recovered_assay_count + 1')
    expect(normalized).toContain(
      'v_recovered_assay_count IS DISTINCT FROM 59',
    )
  })

  it('verifies revision 2 visibility and soft-delete boundaries before commit', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toContain('revision.revision_number = 2')
    expect(normalized).toContain("revision.status = 'superseded'")
    expect(normalized).toContain('v_final_configured_assay_count IS DISTINCT FROM 84')
    expect(normalized).toContain('v_final_hidden_active_assay_count IS DISTINCT FROM 0')
    expect(normalized).toContain('v_final_blood_mapping_count IS DISTINCT FROM 84')
    expect(normalized).toContain('v_soft_deleted_mapping_count IS DISTINCT FROM 0')
    expect(normalized).toContain('compatibility.removed_at IS NULL')
    expect(normalized).toContain('assay_definition.deleted_at IS NOT NULL')
    expect(normalized).not.toMatch(
      /\b(?:UPDATE|DELETE FROM) public\.assay_definitions\b/i,
    )

    for (const assayCode of [
      'CT-000260',
      'CT-000261',
      'CT-000277',
      'CT-000278',
    ]) {
      expect(normalized).toContain(`'${assayCode}'`)
    }
    expect(normalized).toContain('v_reported_assay_mapping_count IS DISTINCT FROM 4')
    expect(normalized).toContain('v_target_revision_audit_count < 3')
    expect(normalized).toContain('v_source_revision_audit_count < 1')
    expect(normalized).toContain(
      'v_recovered_review_audit_count IS DISTINCT FROM 59',
    )
    expect(normalized).toContain(
      'v_compatibility_audit_count IS DISTINCT FROM 84',
    )
  })
})

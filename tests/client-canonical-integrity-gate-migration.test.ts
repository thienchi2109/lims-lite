import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationPath =
  'supabase/migrations/231_enforce_client_canonical_integrity.sql'
const migration230Path =
  'supabase/migrations/230_remove_clients_unique_identity.sql'

function readMigration() {
  return readFileSync(migrationPath, 'utf8')
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

describe('client canonical integrity gate migration', () => {
  it('keeps migration 230 immutable and reserves the next migration number', () => {
    expect(
      createHash('sha256')
        .update(readFileSync(migration230Path, 'utf8'))
        .digest('hex'),
    ).toBe(
      '2cd5448f6be5ee19825f31b4d23e956f9ecd611bea3c2f378f1e1e9b1bbbcbcb',
    )
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('uses a bounded forward-only transaction with security impact', () => {
    const migration = readMigration()
    const normalized = normalizeSql(migration)

    expect(migration).toContain('Security impact:')
    expect(migration).toContain('Historical data impact:')
    expect(migration).toContain('Irreversible:')
    expect(normalized).toMatch(/^BEGIN;/i)
    expect(normalized).toContain("SET LOCAL lock_timeout = '5s';")
    expect(normalized).toContain("SET LOCAL statement_timeout = '60s';")
    expect(normalized).toContain(
      'SET LOCAL search_path TO public, extensions;',
    )
    expect(normalized).toMatch(/COMMIT;$/i)
    expect(migration).toContain('Migration 230 SHA-256:')
  })

  it('checks the post-230 baseline before adding the canonical projection guard', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toContain('DO $baseline$')
    expect(normalized).toContain("'public.clients'::REGCLASS")
    expect(normalized).toContain("conname = 'clients_unique_identity'")
    expect(normalized).toContain('clients_unique_trusted_government_identity')
    expect(normalized).toContain(
      'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)',
    )
    expect(normalized).toContain(
      'public.sync_client_name_snapshot()',
    )
    expect(normalized).toContain(
      'clients_canonical_projection_check',
    )
    expect(normalized).toContain(
      'client.normalized_name IS DISTINCT FROM public.normalize_client_name_v1(client.name)',
    )
    expect(normalized).toContain(
      'client.normalized_phone IS DISTINCT FROM public.normalize_client_phone_v1(client.phone)',
    )
    expect(normalized).toContain(
      'client.government_identity_trusted IS DISTINCT FROM',
    )
  })

  it('preserves trusted identity and rejects broad authenticated writes', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toContain(
      "pg_get_indexdef('public.clients_unique_trusted_government_identity'::REGCLASS)",
    )
    expect(normalized).toContain(
      'government_identity_type, government_identity_value',
    )
    expect(normalized).toContain('government_identity_trusted')
    expect(normalized).toContain('government_identity_value IS NOT NULL')
    expect(normalized).toContain(
      "has_table_privilege('authenticated', 'public.clients', 'UPDATE')",
    )
    expect(normalized).toContain(
      "has_table_privilege('authenticated', 'public.clients', 'DELETE')",
    )
    expect(normalized).toContain(
      "has_table_privilege('authenticated', 'public.clients', 'TRUNCATE')",
    )
    expect(normalized).toContain(
      "has_column_privilege('authenticated', 'public.clients', v_column, 'UPDATE')",
    )
    expect(normalized).toContain('FROM pg_policy')
    expect(normalized).toContain(
      "'Authenticated users can read clients'",
    )
    expect(normalized).toContain("'Analysts can create clients'")
    expect(normalized).toContain(
      "'Analysts and managers can update clients'",
    )
    expect(normalized).toContain("'Managers can delete clients'")
    expect(normalized).toContain('auth.uid()')
    expect(normalized).toContain('get_user_role()')
  })

  it('does not restore legacy or accidental normalized uniqueness', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).not.toMatch(
      /CREATE\s+UNIQUE\s+(?:INDEX|CONSTRAINT)[\s\S]{0,180}(?:normalized_phone|normalized_name|date_of_birth)/i,
    )
    expect(normalized).not.toMatch(
      /ADD\s+CONSTRAINT\s+clients_unique_identity/i,
    )
    expect(normalized).not.toMatch(
      /DROP\s+CONSTRAINT\s+clients_unique_identity/i,
    )
  })

  it('registers a stable security test without weakening lifecycle audit contracts', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toContain(
      'CREATE OR REPLACE FUNCTION public.test_client_canonical_integrity_security()',
    )
    expect(normalized).toContain('SET search_path = public, extensions')
    expect(normalized).toContain('search_path=public, extensions')
    expect(normalized).toContain(
      'test_client_canonical_integrity_security()',
    )
    expect(normalized).toContain('FROM PUBLIC, anon, service_role')
    expect(normalized).toContain('TO authenticated')
    for (const operation of [
      'CLIENT_DEACTIVATED',
      'CLIENT_RESTORED',
      'CLIENT_IDENTITY_CORRECTED',
    ]) {
      expect(normalized).toContain(`'${operation}'`)
    }
    expect(normalized).toContain("ERRCODE = 'P1116'")
  })
})

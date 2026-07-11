// Docker-backed fixtures for the Issue 74 schema-170 rollout tests.
// All mutating operations target a disposable clone of the persistent database.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const claimColumns = [
  'generation_claim_id', 'generation_claimed_by',
  'generation_claimed_at', 'generation_previous_status',
];
export const reason = 'Approved legacy pending remediation for Issue 74';
export const approvalReference = 'CHG-2026-074';
export const auditedReason = `${reason} | Approval reference: ${approvalReference}`;
export const preflightSql = readFileSync(
  new URL('../scripts/coa-claim-rollout-preflight.sql', import.meta.url),
  'utf8',
);
export const remediationSql = readFileSync(
  new URL('../scripts/coa-legacy-pending-remediation.sql', import.meta.url),
  'utf8',
);

function runCommand(args, input) {
  const result = spawnSync('rtk', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    input,
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function runPsql(sql, variables = {}, database = 'postgres') {
  const variableArgs = Object.entries(variables)
    .flatMap(([name, value]) => ['-v', `${name}=${value}`]);
  return runCommand([
    'docker', 'exec', '-i', 'lims-postgres', 'psql',
    '-U', 'postgres', '-d', database, '-X', '-qAt',
    '-v', 'ON_ERROR_STOP=1', ...variableArgs,
  ], sql);
}

export function assertPsqlPassed(result) {
  assert.equal(
    result.status,
    0,
    `psql failed:\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}

export function assertPsqlFailed(result, expectedMessage) {
  assert.notEqual(result.status, 0, 'Expected psql to fail');
  assert.match(`${result.stdout}\n${result.stderr}`, expectedMessage);
}

export function databaseFingerprint() {
  const result = runPsql(`
SELECT jsonb_build_object(
    'coa_rows', (SELECT COUNT(*) FROM public.coa_reports),
    'audit_rows', (SELECT COUNT(*) FROM public.audit_logs),
    'schema_hash', (
        SELECT md5(string_agg(
            column_name || ':' || data_type || ':' || is_nullable,
            ',' ORDER BY ordinal_position
        ))
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'coa_reports'
    ),
    'pending_rows', (
        SELECT COUNT(*) FROM public.coa_reports WHERE status = 'pending'
    ),
    'claim_columns', (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coa_reports'
          AND column_name LIKE 'generation_%'
    )
)::text;
`);
  assertPsqlPassed(result);
  return JSON.parse(result.stdout.trim());
}

export function databaseExists(database) {
  const result = runPsql(
    `SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${database}');`,
  );
  assertPsqlPassed(result);
  return result.stdout.trim() === 't';
}

export function createDisposableDatabase() {
  const database = `coa_claim_${process.pid}_${Date.now()}`;
  assertPsqlPassed(runCommand([
    'docker', 'exec', 'lims-postgres', 'createdb',
    '-U', 'supabase_admin', '-O', 'postgres', database,
  ]));
  try {
    assertPsqlPassed(runCommand([
      'docker', 'exec', 'lims-postgres', 'sh', '-lc',
      `pg_dump -U postgres -d postgres | `
        + `psql -q -U supabase_admin -d ${database} -v ON_ERROR_STOP=1`,
    ]));
    return database;
  } catch (error) {
    runCommand([
      'docker', 'exec', 'lims-postgres', 'dropdb',
      '-U', 'supabase_admin', '--force', database,
    ]);
    throw error;
  }
}

export function dropDisposableDatabase(database) {
  assertPsqlPassed(runCommand([
    'docker', 'exec', 'lims-postgres', 'dropdb',
    '-U', 'supabase_admin', '--force', database,
  ]));
}

export function loadFixture(database) {
  const result = runPsql(`
SELECT jsonb_build_object(
    'report_id', report.id,
    'source_submission_id', submission.id,
    'accountable_user_id', accountable_user.id
)::text
FROM public.coa_reports AS report
JOIN public.sample_submissions AS submission
  ON submission.sample_id = report.sample_id
CROSS JOIN LATERAL (
    SELECT id FROM public.users
    WHERE deleted_at IS NULL AND role IN ('analyst', 'manager')
    ORDER BY id LIMIT 1
) AS accountable_user
WHERE report.status = 'ready'
  AND report.deleted_at IS NULL
  AND report.signature_id IS NOT NULL
ORDER BY report.created_at
LIMIT 1;
`, {}, database);
  assertPsqlPassed(result);
  const fixture = JSON.parse(result.stdout.trim());
  assert.ok(fixture.report_id, 'A ready CoA report fixture is required');
  assert.ok(fixture.source_submission_id, 'A source submission fixture is required');
  assert.ok(fixture.accountable_user_id, 'An accountable user fixture is required');
  return fixture;
}

export function dropClaimColumnsExcept(keptColumns = []) {
  const columns = claimColumns.filter((column) => !keptColumns.includes(column));
  return columns.length === 0 ? '' : `
ALTER TABLE public.coa_reports
${columns.map((column) => `    DROP COLUMN ${column} CASCADE`).join(',\n')};
`;
}

export function schema170Prelude() {
  return `
BEGIN;
SET LOCAL client_min_messages = error;
${dropClaimColumnsExcept()}
UPDATE public.coa_reports
SET status = 'failed', error_message = 'Test-only schema-170 normalization'
WHERE status = 'pending';
`;
}

export function candidateReportUpdate(timestamp) {
  return `
WITH candidate AS (
    SELECT id FROM public.coa_reports
    WHERE status = 'ready' AND deleted_at IS NULL
    ORDER BY created_at LIMIT 1
)
UPDATE public.coa_reports AS report
SET status = 'pending', error_message = NULL,
    generated_at = ${timestamp}, updated_at = ${timestamp}
FROM candidate
WHERE report.id = candidate.id;
`;
}

export function remediationSetup(fixture, status, timestamp) {
  const errorMessage = status === 'pending' ? 'NULL' : "'Existing failure'";
  return `
BEGIN;
SET LOCAL client_min_messages = error;
${dropClaimColumnsExcept()}
UPDATE public.coa_reports
SET status = 'failed', error_message = 'Test-only schema-170 normalization'
WHERE status = 'pending';
ALTER TABLE public.coa_reports
DISABLE TRIGGER prevent_coa_report_identity_change;
UPDATE public.coa_reports
SET source_submission_id = '${fixture.source_submission_id}'::uuid,
    status = '${status}', error_message = ${errorMessage},
    created_at = ${timestamp}, generated_at = ${timestamp}, updated_at = ${timestamp}
WHERE id = '${fixture.report_id}'::uuid;
ALTER TABLE public.coa_reports
ENABLE TRIGGER prevent_coa_report_identity_change;
`;
}

export function remediationVariables(fixture, commitRemediation = 'false') {
  return {
    report_id: fixture.report_id,
    accountable_user_id: fixture.accountable_user_id,
    reason,
    approval_reference: approvalReference,
    stale_before: '2024-01-01T00:00:00Z',
    commit_remediation: commitRemediation,
  };
}

export function assertRemediationEvidence(result, fixture) {
  assertPsqlPassed(result);
  const line = result.stdout.split('\n').find(
    (output) => output.includes('"evidence_type": "coa_legacy_remediation"'),
  );
  assert.ok(line, `Missing remediation evidence:\n${result.stdout}`);
  assert.deepEqual(JSON.parse(line), {
    accountable_user_id: fixture.accountable_user_id,
    approval_reference: approvalReference,
    audited_reason: auditedReason,
    evidence_type: 'coa_legacy_remediation',
    new_status: 'failed',
    old_status: 'pending',
    preserved: {
      artifact_fields: true,
      id: true,
      sample_id: true,
      signature_id: true,
      source_submission_id: true,
      version: true,
    },
    reason,
    report_id: fixture.report_id,
  });
}

export function assertCommittedRemediation(database, fixture) {
  const result = runPsql(`
SELECT jsonb_build_object(
    'status', report.status,
    'reason', report.error_message,
    'accountable_user_id', audit.changed_by,
    'old_status', audit.old_values ->> 'status',
    'new_status', audit.new_values ->> 'status',
    'audit_reason', audit.new_values ->> 'error_message'
)::text
FROM public.coa_reports AS report
JOIN LATERAL (
    SELECT * FROM public.audit_logs
    WHERE table_name = 'coa_reports'
      AND record_id = report.id
      AND operation = 'UPDATE'
      AND changed_by = '${fixture.accountable_user_id}'::uuid
      AND old_values ->> 'status' = 'pending'
      AND new_values ->> 'status' = 'failed'
    ORDER BY changed_at DESC, id DESC
    LIMIT 1
) AS audit ON true
WHERE report.id = '${fixture.report_id}'::uuid;
`, {}, database);
  assertPsqlPassed(result);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    accountable_user_id: fixture.accountable_user_id,
    audit_reason: auditedReason,
    new_status: 'failed',
    old_status: 'pending',
    reason: auditedReason,
    status: 'failed',
  });
}

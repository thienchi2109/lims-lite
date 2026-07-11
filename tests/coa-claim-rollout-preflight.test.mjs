import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  assertCommittedRemediation,
  assertPsqlFailed,
  assertPsqlPassed,
  assertRemediationEvidence,
  candidateReportUpdate,
  createDisposableDatabase,
  databaseExists,
  databaseFingerprint,
  dropClaimColumnsExcept,
  dropDisposableDatabase,
  loadFixture,
  preflightSql,
  remediationSetup,
  remediationSql,
  remediationVariables,
  runPsql,
  schema170Prelude,
} from './coa-claim-rollout-test-support.mjs';

const runbook = readFileSync(
  new URL('../docs/coa-claim-rollout-remediation.md', import.meta.url),
  'utf8',
);
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);
const oldTimestamp = "'2020-01-01T00:00:00Z'::timestamptz";

test('Issue 74 Docker integration is isolated in one disposable database', async (t) => {
  const persistentFingerprint = databaseFingerprint();
  let database;
  try {
    database = createDisposableDatabase();
    const fixture = loadFixture(database);

    await t.test('schema-170 clean preflight passes', () => {
      const result = runPsql(
        `${schema170Prelude()}\n${preflightSql}\nROLLBACK;`,
        {},
        database,
      );
      assertPsqlPassed(result);
      assert.match(result.stdout, /COA_CLAIM_PREFLIGHT_OK_SCHEMA_170/);
    });

    for (const [label, timestamp] of [
      ['recent', 'clock_timestamp()'],
      ['old', oldTimestamp],
    ]) {
      await t.test(`schema-170 preflight blocks ${label} pending`, () => {
        const sql = `${schema170Prelude()}\n`
          + `${candidateReportUpdate(timestamp)}\n${preflightSql}`;
        assertPsqlFailed(
          runPsql(sql, {}, database),
          /coa-claim-rollout-remediation\.md/,
        );
      });
    }

    for (const keptCount of [1, 2, 3]) {
      await t.test(`preflight rejects ${keptCount} partial claim columns`, () => {
        const columns = dropClaimColumnsExcept(
          [
            'generation_claim_id',
            'generation_claimed_by',
            'generation_claimed_at',
            'generation_previous_status',
          ].slice(0, keptCount),
        );
        assertPsqlFailed(
          runPsql(`BEGIN;\n${columns}\n${preflightSql}`, {}, database),
          /partial.*generation claim columns/i,
        );
      });
    }

    for (const requiredVariable of [
      'report_id',
      'accountable_user_id',
      'reason',
      'approval_reference',
    ]) {
      await t.test(`remediation rejects missing ${requiredVariable}`, () => {
        const variables = remediationVariables(fixture);
        delete variables[requiredVariable];
        assertPsqlFailed(
          runPsql(remediationSql, variables, database),
          new RegExp(`${requiredVariable} is required`),
        );
      });
    }

    await t.test('remediation rejects a non-pending report', () => {
      const setup = remediationSetup(fixture, 'failed', oldTimestamp);
      assertPsqlFailed(
        runPsql(
          `${setup}\n${remediationSql}`,
          remediationVariables(fixture),
          database,
        ),
        /must be pending/i,
      );
    });

    await t.test('remediation rejects active generation', () => {
      const setup = remediationSetup(fixture, 'pending', 'clock_timestamp()');
      assertPsqlFailed(
        runPsql(
          `${setup}\n${remediationSql}`,
          remediationVariables(fixture),
          database,
        ),
        /active.*stale criterion|stale criterion.*active/i,
      );
    });

    for (const [label, offset] of [['recent', -5], ['future', 5]]) {
      await t.test(`remediation rejects a ${label} stale cutoff`, () => {
        const variables = remediationVariables(fixture);
        variables.stale_before = new Date(
          Date.now() + offset * 60 * 1000,
        ).toISOString();
        const setup = remediationSetup(fixture, 'pending', oldTimestamp);
        assertPsqlFailed(
          runPsql(`${setup}\n${remediationSql}`, variables, database),
          /at least 15 minutes/i,
        );
      });
    }

    await t.test('dry-run audits attribution and preserves provenance', () => {
      const setup = remediationSetup(fixture, 'pending', oldTimestamp);
      const result = runPsql(
        `${setup}\n${remediationSql}`,
        remediationVariables(fixture),
        database,
      );
      assertRemediationEvidence(result, fixture);
      assert.match(result.stdout, /transaction rolled back/i);
    });

    await t.test('approved remediation commits report and audit state', () => {
      const setup = remediationSetup(fixture, 'pending', oldTimestamp);
      const result = runPsql(
        `${setup}\n${remediationSql}`,
        remediationVariables(fixture, 'true'),
        database,
      );
      assertRemediationEvidence(result, fixture);
      assertCommittedRemediation(database, fixture);
    });
  } finally {
    if (database) {
      dropDisposableDatabase(database);
      assert.equal(databaseExists(database), false);
    }
    assert.deepEqual(databaseFingerprint(), persistentFingerprint);
  }
});

test('remediation uses accountable-user attribution and approval evidence', () => {
  assert.match(remediationSql, /accountable_user_id/);
  assert.doesNotMatch(remediationSql, /operator_id/);
  assert.match(remediationSql, /Approval reference:/);
});

test('runbook enforces maintenance and honest attribution evidence', () => {
  assert.match(runbook, /docker compose stop app rest kong nginx/);
  assert.match(runbook, /ps --status running --services app rest kong nginx/);
  assert.match(runbook, /pg_stat_activity/);
  assert.match(runbook, /PostgREST/);
  assert.match(runbook, /preflight.*không.*cross-command lock/is);
  assert.match(
    runbook,
    /171_add_coa_generation_claims\.sql[\s\S]*run_security_tests[\s\S]*compose start/is,
  );
  assert.match(runbook, /postgres[\s\S]*auth\.uid\(\)/i);
  assert.match(runbook, /host OS[\s\S]*UTC[\s\S]*commit SHA/is);
});

test('runbook safely transports operator-entered free text', () => {
  for (const variable of ['REASON', 'APPROVAL_REFERENCE', 'FORWARD_CORRECTION']) {
    assert.match(runbook, new RegExp(`read -r .*${variable}`));
    assert.doesNotMatch(runbook, new RegExp(`${variable}=['"]`));
  }
  assert.match(runbook, /-v "reason=\$REASON"/);
  assert.match(runbook, /-v "approval_reference=\$APPROVAL_REFERENCE"/);
  assert.match(runbook, /-v "correction_reason=\$FORWARD_CORRECTION"/);
  assert.match(runbook, /set_config\('lims\.coa_forward_report_id'/);
  assert.doesNotMatch(runbook, /current_setting\('report_id'/);
  assert.match(runbook, /Forward correction audit row was not recorded/);
});

test('package exposes the focused Node regression command', () => {
  assert.equal(
    packageJson.scripts['test:coa-claim-rollout'],
    'node --test --test-concurrency=1 tests/coa-claim-rollout-preflight.test.mjs',
  );
});

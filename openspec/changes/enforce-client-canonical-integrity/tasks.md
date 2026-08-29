## 1. Baseline Evidence

- [ ] 1.1 Add `tests/client-canonical-integrity-preflight.sql` as a read-only
  `ON_ERROR_STOP` preflight that fails on unresolved collisions, projection
  drift, catalog/ACL/RLS/RPC/audit mismatch, or a successful direct legacy
  mutation caller.
- [ ] 1.2 Define the preflight predicates: trusted identity duplicates across
  active and inactive rows; canonical projection equality against
  `normalize_client_name_v1`, `normalize_client_phone_v1`,
  `normalize_client_government_identity_v1`, and
  `classify_client_government_identity_v1`; and unresolved phone/name-DOB
  candidate pairs excluding current, valid `confirmed_distinct` adjudications.
- [ ] 1.3 Capture non-PII aggregate output in
  `openspec/changes/enforce-client-canonical-integrity/gate-a-preflight-evidence.md`
  with commit SHA, database timestamp, counts, catalog assertions, and result.
- [ ] 1.4 Verify migration 230 SHA-256
  `2cd5448f6be5ee19825f31b4d23e956f9ecd611bea3c2f378f1e1e9b1bbbcbcb`,
  absence of `clients_unique_identity`, exact resolver/accession signatures,
  trigger metadata, trusted identity index, security-test function metadata,
  and `run_security_tests()` registration without editing or reapplying 230.
- [ ] 1.5 Verify the existing client RLS policy set is unchanged:
  `Authenticated users can read clients`, `Analysts can create clients`,
  `Analysts and managers can update clients`, and the inert
  `Managers can delete clients` policy. Assert `auth.uid() IS NOT NULL` for
  SELECT, `get_user_role() IN ('analyst', 'manager')` for INSERT and UPDATE
  `USING`/`WITH CHECK`, and manager-only DELETE policy text while table-level
  DELETE remains denied.

## 2. Gate A Database Enforcement

- [ ] 2.1 Verify migration 231 is unused in the repository and approved
  deployment checkout; if occupied, select the actual next number before
  creating a migration.
- [ ] 2.2 Add a failing static contract test at
  `tests/client-canonical-integrity-gate-migration.test.ts` for the
  next-numbered migration's baseline assertions, projection checks, explicit
  role checks, fixed `search_path`, security comments, and forward-only shape.
- [ ] 2.3 Migrate `upsertClient()` so the route and shadow handler delegate to
  `resolve_or_create_client_v2` or fail closed; prove no successful direct
  `public.clients` upsert with `onConflict: 'name,date_of_birth'`. Keep the
  compatibility entry point for observation; do not delete it in Gate A.
- [ ] 2.4 Implement canonical projection consistency guards and preserve
  `clients_unique_trusted_government_identity` exactly on trusted typed
  identities across active and inactive rows. Do not add unique constraints on
  normalized phone or name/date-of-birth.
- [ ] 2.5 Verify the exact post-230 ACL: authenticated has no table-level
  UPDATE/DELETE/TRUNCATE, no UPDATE on identity/canonical/lifecycle columns,
  and UPDATE only on `gender`, `phone`, `address`,
  `health_insurance_num`, and `expiry_date`. Preserve resolver RPC grants and
  internal manager checks.

## 3. Verification And Deployment

- [ ] 3.1 Add `tests/client-canonical-integrity-gate.test.sql` as rollback-only
  runtime coverage for trusted identity conflicts, normalized phone and
  name/date-of-birth candidate conflicts, confirmed-distinct adjudications,
  restore/correction conflicts, atomic audit failure, unchanged sample/result
  history, and security outcomes.
- [ ] 3.2 Extend or add a multi-session concurrency rehearsal based on
  `tests/client-resolution-caller-cutover-concurrency.test.sql`; verify at
  most one trusted identity succeeds and all losers have no partial writes.
- [ ] 3.3 Assert one explicit lifecycle audit event per successful operation
  (in addition to any generic row-level trigger audit):
  `CLIENT_DEACTIVATED`, `CLIENT_RESTORED`, and
  `CLIENT_IDENTITY_CORRECTED`, including reason, actor, record UUID, status,
  corrected fields where applicable, and `P1116` rollback on audit failure.
- [ ] 3.4 Run the preflight, `run_security_tests()`, the named SQL suites,
  `npm run test:run -- tests/client-canonical-integrity-gate-migration.test.ts`,
  focused client/accession regressions, `npm run typecheck`, `npm run lint`,
  React Doctor, health checks, browser smoke, and Vietnamese outcome checks.
- [ ] 3.5 Apply only the committed next-numbered migration in the approved
  Docker environment and verify catalog, ACL, RLS, RPC metadata, audit evidence,
  and unchanged sample/result history.
- [ ] 3.6 Record the forward-only rollback rehearsal and Gate A release
  evidence; never edit or rerun migration 230.

## 4. Observation Handoff

- [ ] 4.1 Monitor the agreed post-enforcement observation window for successful
  legacy lookup, upsert, hard-delete, and compatibility-adapter usage.
- [ ] 4.2 Publish PII-free aggregate and code-search evidence for the Gate B
  decision without changing legacy branches in this change.
- [ ] 4.3 Create a separate approved proposal before removing proven-unused
  legacy paths, obsolete RPC grants, or application compatibility branches.

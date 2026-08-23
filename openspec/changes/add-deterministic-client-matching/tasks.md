## 1. Phase 1 - Establish the Non-Regressive Foundation

Boundary: baseline evidence, tests, and one forward-only additive migration.
Existing columns, policies, RPCs, routes, response shapes, and callers remain
usable. No cleanup, canonical enforcement, hard-delete revocation, or
user-visible matching change occurs in this phase.

- [x] 1.1 Add passing characterization tests that lock current raw name/DOB,
  phone, QR, upsert, authorization, confidentiality, audit, and Vietnamese error
  contracts; add failing target tests only in the phase that implements each
  intentional behavior change.
- [x] 1.2 Add read-only aggregate SQL for client counts, placeholders, invalid
  identities, collisions, audit evidence, and sample links without selecting
  row-level PII; record the production baseline through the approved SSH path.
- [x] 1.3 Add a next-numbered migration with baseline assertions and nullable
  canonical government-identity, normalized name/phone, trust, and soft-delete
  audit fields.
- [x] 1.4 Lock the PostgreSQL 15.1 normalization algorithm and versioned
  Vietnamese fixtures: NFC, trim, whitespace collapse, and
  `lower(... COLLATE "und-x-icu")` with diacritics preserved.
- [x] 1.5 Add database triggers that derive canonical projections on every
  legacy or v2 INSERT/UPDATE; preserve existing RLS, audit triggers, grants,
  fixed `search_path`, and behavior while adding non-unique candidate indexes.
- [x] 1.6 Add rollback-only SQL tests for normalization, lifecycle defaults,
  confidentiality, RLS, grants, audit evidence, and unchanged legacy callers.
- [x] 1.7 Commit the migration, sync the home-server checkout, apply only that
  committed migration through SSH, run `run_security_tests()`, and verify focused
  client/accession tests, typecheck, lint, production health, and legacy smoke.

## 2. Phase 2 - Deliver Audited Client Lifecycle and Adjudication

Boundary: manager-only backend and Vietnamese maintenance UI are deployed
additively first. Only after production proof, a separate forward-only gate
revokes hard DELETE and protects lifecycle fields while preserving the
temporarily authoritative legacy identity updates and compatible analyst access
to explicitly allowed non-identity profile edits. Existing accession screens
remain unchanged.

- [x] 2.1 Add failing SQL/application tests for manager deactivation,
  restoration, correction, collision adjudication, required reasons, stale
  requests, audit failure, and active-identity conflicts.
- [x] 2.2 Add SECURITY DEFINER lifecycle and adjudication RPCs with explicit
  manager role checks, fixed `search_path`, minimal grants, stable SQLSTATEs, and
  atomic audit persistence.
- [x] 2.3 Ensure restoration keeps the same UUID, never rewrites sample/result
  links, never auto-merges identities, and fails closed on active conflicts.
- [x] 2.4 Add Vietnamese manager views for active/inactive state, correction,
  deactivation, restoration, and unresolved collisions with explicit reasons
  and confirmation summaries.
- [x] 2.5 Expose only the minimum conflict evidence needed for adjudication; map
  backend failures to sanitized Vietnamese errors without PII-rich logs or URLs.
- [x] 2.6 Run focused SQL/UI tests, `run_security_tests()`, typecheck, lint,
  React Doctor, manager/analyst browser smoke, and existing accession regression
  checks before additive deployment of the replacement workflow.
- [x] 2.7 After production smoke proves the replacement path, apply a separate
  committed forward-only guard migration that revokes hard DELETE and broad
  direct lifecycle-field UPDATE, preserves legacy identity updates plus allowed
  profile edits until Phase 6, reruns security/regression suites, and retains a
  tested forward-only rollback.

## 3. Phase 3 - Classify and Adjudicate Legacy Identity Data

Boundary: forward-only cleanup and explicit manager decisions. Resolver callers,
uniqueness guards, direct-mutation guards, and legacy-path retirement remain
disabled.

- [x] 3.1 Add a forward-only classification migration that maps invalid,
  `BACKFILL-*`, and placeholder values to nullable/untrusted canonical state
  without inventing replacement identities.
- [x] 3.2 Commit and apply only that classification migration through the
  approved home-server path, then run rollback-only SQL,
  `run_security_tests()`, and projection reconciliation checks.
- [x] 3.3 Add checkpoint assertions and aggregate reports for every unresolved
  canonical government identity, phone, name/DOB, and inactive-history conflict.
- [x] 3.4 Use the Phase 2 workflow to adjudicate the two known duplicate
  untrusted identifier groups without automatic merge or sample relinking.
- [x] 3.5 Re-run the zero-blocker checkpoint after adjudication, archive only
  non-PII aggregate evidence, and verify existing app health, client
  maintenance, allowed profile edits, and accession smoke.

## 4. Phase 4 - Add the Transactional Resolver Contract

Boundary: two ordered additive gates. Gate A deploys typed compatibility and
localized error handling while legacy callers remain authoritative. Gate B adds
resolver/RPC v2 and trusted-ID uniqueness only after Gate A is production-ready.
No caller selects v2 yet; existing successful workflows remain unchanged, while
unsafe duplicate trusted IDs fail closed through the localized compatibility
contract instead of leaking PostgreSQL errors.

- [x] 4.1 Add failing SQL tests for typed CCCD/CMND precedence, unknown strong
  identities, lifecycle, accent-only names, phone guards, duplicates, cross-key
  disagreement, restricted candidates, missing identity, and all four outcomes.
- [x] 4.2 Add resolver/RPC v2 returning `matched`, `not_found`, `ambiguous`, or
  `conflict`, accepting raw validated values, normalizing only in PostgreSQL,
  and returning stable reason codes plus only minimal authorized identifiers.
- [x] 4.3 Add transactional resolve-and-create behavior where only `not_found`
  may create. Acquire a sorted lock set for every applicable government-ID,
  name/DOB, and real-phone key, re-resolve under lock, and re-resolve any trusted
  uniqueness violation.
- [x] 4.4 Enforce analyst/manager authorization, confidentiality filtering, RLS,
  fixed `search_path`, minimal grants, audit behavior, and PII-minimized failures.
- [x] 4.5 Return a non-disclosing `conflict` reason with no client identifier for
  confidential/restricted candidates; prohibit creation and test
  confidential-only and mixed-visibility candidate sets.
- [x] 4.6 Add strict Zod/TypeScript contracts and centralized Vietnamese labels:
  `Đã khớp`, `Không tìm thấy khách hàng`,
  `Không thể xác định duy nhất`, and `Xung đột thông tin`.
- [x] 4.7 Add actionable Vietnamese reason mapping with optional
  sheet/row/temporary-reference context and prove raw DB errors and unnecessary
  PII are never returned.
- [x] 4.8 Gate A: add server-only and `src/lib/api-client.ts` adapter boundaries
  without direct client imports from `src/app/actions/*`; wire sanitized
  trusted-identity conflict handling into existing routes while preserving all
  compatible success responses.
- [x] 4.9 Gate A: deploy the compatibility layer and pass focused contract tests,
  typecheck, lint, browser smoke, and legacy caller regressions before database
  uniqueness is enabled.
- [x] 4.10 Gate B: reconcile canonical projections, apply the committed
  resolver/trusted typed CCCD/CMND uniqueness migration after the Phase 3 clean
  checkpoint, reload schema cache, and add concurrency/cross-key regressions.
- [x] 4.11 Gate B: run SQL rollback suites, `run_security_tests()`, production
  health checks, localized legacy collision smoke, and verify v2 remains
  unselected by all callers.

## 5. Phase 5 - Prove Parity with Read-Only Shadow Comparison

Boundary: v2 is evaluated but never controls responses or mutations. Shadow mode
is server-controlled, deploy-safe, and independently disabled without rolling
back schema.

- [x] 5.1 Add a server-controlled shadow switch for eligible manual, QR, and
  upsert requests; browser input cannot enable or configure it.
- [x] 5.2 Compare non-mutating legacy and v2 evaluators against the same
  pre-mutation snapshot, with zero response or mutation influence.
- [x] 5.3 Persist only caller category, machine outcome/reason, a random
  request-scoped correlation ID, and timestamps under a bounded retention
  policy; exclude client UUIDs, names, phones, government IDs, DOB, hashes,
  fingerprints, source coordinates, and payloads.
- [x] 5.4 Add tests for shadow isolation, failure containment, authorization,
  performance budgets, and zero mutation side effects.
- [x] 5.5 Deploy shadow mode, observe an agreed evidence window, review every
  discrepancy category, and block Phase 6 until acceptance criteria pass.

## 6. Phase 6 - Cut Over Existing Callers Behind Rollback Controls

Boundary: caller adoption is controlled by server-side switches and uses ordered
deployment checkpoints. A truly read-only lookup consumer may cut over alone.
Any workflow that can create a client or sample SHALL move lookup,
resolve-and-create, and sample mutation atomically; it SHALL NOT expose v2
`not_found` while submitting through legacy upsert. Public routes,
request/response shapes, scanner transport/parser, allowed profile edits,
sample/result workflows, and unrelated client features remain compatible.

- [x] 6.1 Add failing tests for `matched`, `not_found`, `ambiguous`, and
  `conflict`, including inactive/restricted reasons, while locking scanner
  camera/Web Serial, QR parsing, address fields, confidentiality, allowed profile
  edits, CoA raw-phone authentication, and sample selection behavior.
- [x] 6.2 Route only lookup-only consumers through v2 behind a server-controlled
  switch; show Vietnamese outcomes and prohibit analyst override. Keep every
  creation-capable manual/QR flow entirely on its current path at this checkpoint.
- [x] 6.3 Complete lookup-only focused tests, shadow comparison, typecheck, lint,
  React Doctor, browser smoke, and tested switch rollback before enabling any
  eligible read-only consumer.
- [x] 6.4 Add failing regressions proving matched requests never update identity
  or address, only `not_found` can create, and unresolved/restricted outcomes
  produce zero client, sample, or result mutation.
- [x] 6.5 Add versioned sample/accession mutation RPCs that lock and revalidate
  active client state, derive `client_name`, and atomically create or link the
  client and sample inside the same transaction.
- [x] 6.6 Deploy all v2-capable mutation adapters with their switches disabled,
  reconcile canonical projections again, and prove the clean baseline has not
  drifted since Phase 3.
- [x] 6.7 Cut over each creation-capable manual/QR/upsert/accession workflow as
  one unit behind its own server-controlled switch, preserving compatible
  success responses and never pairing v2 lookup with legacy mutation.
- [x] 6.8 Return Vietnamese `Xung đột thông tin` or
  `Không thể xác định duy nhất` instead of overwriting unsafe matches.
- [x] 6.9 Observe all mutation callers on v2 while the legacy constraint/path
  remains structurally available; complete production smoke and a tested switch
  rollback before crossing the retirement gate.
- [ ] 6.10 Irreversible retirement gate: after code search and production
  evidence show every raw name/DOB upsert is disabled, apply a forward-only
  migration that removes the legacy UNIQUE (`name`, `date_of_birth`) constraint
  and blocks direct identity UPDATE outside audited manager/v2 contracts.
- [ ] 6.11 Document that switch rollback ends at task 6.10; post-gate recovery
  SHALL use a new forward-only application/database release and SHALL NOT restore
  name/DOB uniqueness after valid same-name/DOB clients can exist.
- [ ] 6.12 Add same-name/DOB distinct-person, legacy-constraint removal,
  direct-update denial, compatibility, and forward-only rollback coverage.
- [ ] 6.13 Verify sample linkage, snapshot naming, statuses, results, audit, RLS,
  QR/manual flows, unrelated search, and all other existing app workflows remain
  unchanged outside the intentional matching behavior.
- [ ] 6.14 Complete immediate-blast-radius tests, typecheck, lint, React Doctor,
  shadow evidence review, production browser smoke, health checks, and
  post-retirement forward-only recovery rehearsal before declaring Phase 6
  complete.

## 7. Phase 7 - Enforce Canonical Integrity and Retire Legacy Paths

Boundary: two separately reviewable deploy gates. Gate A enables forward-only
database enforcement only after cleanup and caller adoption are proven. Gate B
retires legacy paths only after a post-enforcement observation window; it may be
deferred without weakening the enforced contract. Applied migrations remain
immutable, and every rollback is a new forward-only migration.

- [ ] 7.1 Gate A: assert zero unresolved canonical collisions, no authoritative
  legacy mutation callers, fully reconciled canonical projections, complete
  lifecycle audit coverage, and successful Phase 6 production evidence.
- [ ] 7.2 Gate A: validate the Phase 4 trusted typed CCCD/CMND uniqueness across
  active/inactive clients, then add remaining normalized-phone and canonical
  candidate integrity guards without making name/DOB a unique identity.
- [ ] 7.3 Gate A: verify hard DELETE and broad identity/lifecycle UPDATE are
  already denied, remove only temporary bypass grants, and preserve explicitly
  allowed profile edits; policy changes use `DROP POLICY IF EXISTS`, explicit
  role checks, fixed `search_path`, and minimal grants.
- [ ] 7.4 Gate A: add rollback-only SQL coverage for uniqueness, restore
  conflicts, concurrency, RLS, audit, hard-delete denial, resolver outcomes, and
  unchanged sample/result history.
- [ ] 7.5 Gate A: apply only the committed enforcement migration, run
  `run_security_tests()`, full client/accession and immediate-blast-radius
  regressions, production health checks, browser smoke, and the prepared
  forward-only rollback rehearsal.
- [ ] 7.6 Observation gate: confirm telemetry, aggregate evidence, and code search
  show no remaining successful legacy lookup, upsert, hard-delete, or
  compatibility-adapter use during the agreed window.
- [ ] 7.7 Gate B: remove only proven-unused application branches and obsolete RPC
  grants/contracts, using a separate forward-only migration where required.
- [ ] 7.8 Gate B: rerun full client/accession regressions, sample/result blast
  radius, typecheck, lint, React Doctor, SQL security suites, browser smoke,
  Vietnamese outcome checks, audit/RLS verification, and rollback documentation.
- [ ] 7.9 Strict-validate and archive this OpenSpec change, update #107/#111
  traceability, close or file implementation follow-ups, and sync local, origin,
  and the approved deployment checkout.

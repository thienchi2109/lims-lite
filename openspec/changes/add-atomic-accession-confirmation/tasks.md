# Atomic Accession Confirmation Implementation Plan

> For agentic workers: implement only the phase released by root. Root owns integration, tracking, commit/push and independent SPEC/STANDARDS review. Approved #112/#113 remain decision authority. Runtime operations require the separately released Phase 4 home-server scope; this source workspace never operates production containers.

## 0. Artifact and schema checkpoint — no implementation release

- [x] 0.1 Root reviewed proposal/design/spec against TASK-11/#139, current schema and approved #112/#113. Initial independent SPEC/STANDARDS findings were corrected: terminal duplicate state, active/current confidentiality-aware reads and explicit final validation inside the business savepoint; exact lock order and schema-only Phase 1 fixture limits are documented.
- [x] 0.2 Root accepted the corrected source checkpoint and released Phase 1 on 2026-11-05. Combined receipt/global claim, typed provenance, private final validator plus one deferred receipt safety check, active reader predicates and coarse write-table exclusion are accepted implementation choices. Later source phases remain root-gated; no DB/runtime/deploy release.

## 1. Phase 1 — global successful claim, receipt and provenance

- [x] 1.1 Rechecked unused next migration 235 and immutable 233/234 hashes; inspected source signatures, constraints, grants, policies and audit baseline without runtime operations.
- [x] 1.2 Retained source RED (6 failures/1 pass before SQL; security refinement 1 failure/6 passes) and partial rollback-only Phase 1 fixture using pending deferred rows for all three mapping kinds, shape/uniqueness/RLS/denied writes and explicit unbacked-success rejection. Historical guards/RLS/audit remain enabled; full positive success awaits Phase 3.
- [x] 1.3 Added 235 receipt/global hash claim and typed mappings with noncascading FKs, kind-scoped ref/entity uniqueness and one private creation-time final validator/deferred receipt safety belt; no per-mapping full scan, payload or business count caps.
- [x] 1.4 Added active current owner-analyst/manager parent-receipt gates, current active-client/confidentiality/sample/result reads, hidden hash and private immutable/fixed-path helpers; registered owner/policy/grant security verification without widening business/audit reads. SQL runtime NOT RUN.
- [x] 1.5 Root independently verified final source GREEN 25/25 across migration 232/233/234/235 contracts, touched test ESLint, typecheck, strict OpenSpec and whitespace checks. Policy-anchor correction retained RED 1 failure/7 passes. New SQL/test files remain below 350 lines. SQL runtime/security/atomicity NOT RUN.
- [x] 1.6 Root accepted Phase 1 SOURCE after independent SPEC/STANDARDS review and correction/re-review of policy drift verification; final hashes and evidence are recorded. Phase 2 remains unreleased and runtime remains INCOMPLETE.

## 2. Phase 2 — trusted preparation and locked validation

- [x] 2.1 Retained preparation/source RED for caller/owner/attestation, bytes/hash, retained-key HMAC, malformed graph/counts and authority drift; review corrections retain separate revision/scenario and invalid method-column RED evidence.
- [x] 2.2 Added server-only preparation reusing parser/snapshot/resolver/intent/bindings/config, authorized succeeded receipt shortcut before file/attestation/keys/config/expiry, retained key versions and fail-closed metadata/HMAC checks.
- [x] 2.3 Added migration 236 with private locked validation, service/current active actor and owner/state checks, sealed metadata/bindings, exact ordered final-mode locks, current snapshot/resolver/graph authority, explicit sealed/current revision equality and post-validation acceptance clock.
- [x] 2.4 Preserved/restored all three JWT claim settings around verified actor context; preparation persists no receipt timestamp, official IDs or business writes. Retained pure validation business/provenance/audit-count assertions; SQL runtime NOT RUN.
- [x] 2.5 Retained actual rollback-only authority drift scenarios and concrete disposable-only multi-session commands/assertions/cleanup for writer contention and TTL. SQL runtime NOT RUN; full publisher/single-accession rehearsal and Phase 3 business outcomes remain INCOMPLETE.
- [x] 2.6 Root independently verified 6 files / 112 tests, touched lint, typecheck, strict OpenSpec, historical migration hashes and whitespace; SPEC/STANDARDS PASS after corrections. Phase 2 SOURCE accepted; Phase 3 unreleased and blocked on the pre-existing 235 method-column defect documented in evidence.md.

## 3. Phase 3 — atomic business confirmation and terminal outcomes

- [x] 3.1 Retained initial RED 23 failures and counter-order RED 1 failure, then focused adapter/source regressions for one handoff, same receipt, terminal no replay, safe failure, private dedup and unknown outcomes. SQL receipt-time assertions retained NOT RUN.
- [x] 3.2 Added forward-only migration 237 with guard/reason extensions and correction of 235's invalid assay method column; historical 233–236 remain unchanged. User approved method_id NULL with sealed/current methodName checks.
- [x] 3.3 Added service-only atomic entrypoint reusing the locked validator, one business exception subtransaction, safe outer terminal persistence and all three JWT settings restored. Counter table exclusion precedes Phase 2 locks; runtime behavior NOT RUN.
- [x] 3.4 Added claim-first direct business writes, all mappings/exact-actor INSERT audit links, common accepted DB time/actor, commit-path official IDs and explicit final validation inside the savepoint. No single-accession RPC loop; imported result/mapping method_id NULL by user decision.
- [x] 3.5 Added authorized receipt-first same-batch success, nonreplayable other terminal states and private ALREADY_IMPORTED handling before preparation failure and after rollback, including winner-created-client drift.
- [x] 3.6 Added strict server adapter with one atomic RPC for prepared/controlled failure handoffs, no HTTP endpoint or blind retry; uncertain RPC outcomes remain OUTCOME_UNKNOWN.
- [x] 3.7 Retained disposable rollback-only SQL success/graph/actor-audit assertions and five-stage failure injection with exact business/claim/mapping/audit counts and safe outer failure. SQL NOT RUN.
- [x] 3.8 Retained concrete same/cross-batch, external writer/counter, expiry-wait and accepted-before-deadline commands/assertions/cleanup. Shared synthetic COMMITs require separate disposable DB authorization. SQL concurrency/deadlock proof NOT RUN.
- [x] 3.9 Root independently verified 19 files / 304 tests, touched lint, typecheck, strict OpenSpec, immutable hashes and whitespace; independent SPEC/STANDARDS PASS. Phase 3 SOURCE accepted; Phase 4/runtime/exit gates remain unreleased.

## 4. Separately authorized home-server runtime and exit gates

Runtime recovery checkpoint: disposable migration 235 passed; 236 failed compilation and fully rolled back; 237 was not executed. New standalone 238 reconstructs 236/237 in one transaction from the verified 235 baseline, correcting only the confirmed CASE parser issue. Apply committed 235 then 238; skip immutable historical 236/237. Production remains at 233/234. Recovery 238, fixtures/concurrency and service smoke are NOT RUN pending source acceptance and explicit runtime release; all exit gates remain unchecked.

- [ ] 4.1 Obtain operation-specific runtime release, verify committed exact revisions/immutable hashes and actual baseline from home-server checkout; no runtime authorization is implied by source release.
- [ ] 4.2 Apply only new committed migrations through authorized home-server SSH/Docker path; run `run_security_tests()` after each and capture exact privileges/RLS/owners/search paths/final invariants.
- [ ] 4.3 Execute rollback-only SQL behavioral/security/rollback fixtures and genuine multi-session concurrency/TTL scenarios; capture PII-free assertions and verify synthetic cleanup/baseline counts.
- [ ] 4.4 Perform separately authorized rollout-compatible service RPC smoke and record exact source/deployed/database revision; do not claim HTTP/UI/recovery/capacity acceptance from SQL success.
- [ ] 4.5 Root accepts evidence for TASK-11 scope and hands service signature, lock/expiry, terminal/unknown-outcome, receipt/privacy and retention boundaries to TASK-12; keep TASK-7/12/13 limits explicit.

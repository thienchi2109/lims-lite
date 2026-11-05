# Atomic Accession Confirmation Implementation Plan

> For agentic workers: implement only the phase released by root. Root owns integration, tracking, commit/push and independent SPEC/STANDARDS review. Approved #112/#113 remain decision authority. No production/SSH/Docker/DB operations in this source session.

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

- [ ] 3.1 Add focused source/helper regressions and retain expected RED for one atomic handoff, same receipt, terminal no replay, common DB receipt time, safe failure and private dedup outcomes.
- [ ] 3.2 Add new forward-only migration extending the batch mutation guard/reason constraints for validated success and safe confirmation terminal outcomes without changing historical SQL.
- [ ] 3.3 Add service-only atomic entrypoint using the Phase 2 locked validation helper, one inner business subtransaction and outer safe failure persistence; preserve verified actor context and restore original claims.
- [ ] 3.4 Insert unique receipt claim, new clients, assigned samples, pending results, all mappings/exact-actor audit links and batch success/audit together; explicitly invoke final graph validator inside the business exception block before success returns, use common DB received_at/actor and official IDs only during commit, with no single-accession RPC loop.
- [ ] 3.5 Return authorized same-batch committed receipt without repeat writes/audit or file requirement; make global hash collision non-disclosing and other terminal attempts nonreplayable.
- [ ] 3.6 Wire narrow server adapter to the atomic service RPC with strict output validation and no HTTP endpoint or blind automatic retries.
- [ ] 3.7 Retain SQL fixture injecting failure after client, sample, final assignment, mappings and audit, asserting before/after business/claim/mapping/audit counts and safe outer terminal outcome; verify actual graph and audit actor links on success.
- [ ] 3.8 Retain multi-session scenarios for same-batch/cross-batch concurrency, external client/lifecycle/catalog writers, expiry while locked and accepted-before-deadline completion; specify commands/assertions and cleanup, not mock lock proof.
- [ ] 3.9 Run scoped tests GREEN plus immediate parser/resolver/template/commitment blast radius, touched-file lint, typecheck, strict OpenSpec and diff checks; freeze for root independent SPEC/STANDARDS review.

## 4. Separately authorized home-server runtime and exit gates

- [ ] 4.1 Obtain operation-specific runtime release, verify committed exact revisions/immutable hashes and actual baseline from home-server checkout; no runtime authorization is implied by source release.
- [ ] 4.2 Apply only new committed migrations through authorized home-server SSH/Docker path; run `run_security_tests()` after each and capture exact privileges/RLS/owners/search paths/final invariants.
- [ ] 4.3 Execute rollback-only SQL behavioral/security/rollback fixtures and genuine multi-session concurrency/TTL scenarios; capture PII-free assertions and verify synthetic cleanup/baseline counts.
- [ ] 4.4 Perform separately authorized rollout-compatible service RPC smoke and record exact source/deployed/database revision; do not claim HTTP/UI/recovery/capacity acceptance from SQL success.
- [ ] 4.5 Root accepts evidence for TASK-11 scope and hands service signature, lock/expiry, terminal/unknown-outcome, receipt/privacy and retention boundaries to TASK-12; keep TASK-7/12/13 limits explicit.

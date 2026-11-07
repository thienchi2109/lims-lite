## 0. Checkpoint 0 — artifacts only

- [x] 0.1 Independently review proposal/design/spec/tasks against TASK-13/#141, approved template/atomic contracts, current API client and TASK-12 evidence; verify links, `rtk proxy openspec validate add-vietnamese-accession-import-workflow --strict --no-interactive`, `rtk proxy openspec status --change add-vietnamese-accession-import-workflow --json` and `rtk proxy git diff --check`.
- [x] 0.2 Root accepts this documentation-only checkpoint and records the explicit stop before Phase 1; all source/runtime gates remain unchecked, and later phases require their own review release.

## 1. Phase 1 — entry, file, preview and complete errors (one session)

- [ ] 1.1 After checkpoint 0 release, inspect existing dialog/form/loading/query patterns and add focused accessible interaction tests first; record RED for missing entry, file boundary, pending/cancel, valid preview/client resolution and complete row errors.
- [ ] 1.2 Add “Nhập từ Excel” beside the template action in `AccessionPageHeader` on `/analyst/accession`; retain mobile wrapping and walkthrough, keyboard/focus/labels, and no duplicate `/samples` entry.
- [ ] 1.3 Add memory-only file selection with clear Vietnamese `0 < size < 10,000,000` decimal byte guidance, boundary checks at 9,999,999 / 10,000,000 / 10,000,001, existing pending/cancel controls and stale-response protection; do not claim abort proves server rollback.
- [ ] 1.4 Use `createAccessionPreviewClient`; render immutable summary/create-reuse decisions, existing/unchanged client values and all row errors with sheet/row/column/reason/remedy. Reject malformed/unavailable responses, keep confirm unavailable, and add no count caps or persisted file/payload/error cache.
- [ ] 1.5 Record GREEN for focused accessible interaction tests including cancellation/replacement and full errors; run touched-file ESLint, `rtk npm run typecheck`, relevant repo React checks, OpenSpec strict validation and diff checks. Check app/API client immediate blast radius only; report mock/source evidence accurately.
- [ ] 1.6 STOP: root independently reviews Phase 1 diff, RED→GREEN and source evidence, accepts the bounded result and explicitly releases Phase 2 before further code.

## 2. Phase 2 — attestation, confirmation and receipt (separate session)

- [ ] 2.1 Before implementation, trace an existing owner-authorized receipt-to-committed-sample/official-ID read. If unavailable, STOP Phase 2 and return the concrete contract gap for separate scoped approval; do not invent receipt fields, query the DB directly from UI or accept counts as official IDs. All following Phase 2 tasks depend on this gate.
- [ ] 2.2 Add focused accessible interaction tests first and record RED for explicit unchecked attestation, identical-file confirm, success receipt/official IDs, pending/double-click, changed-file invalidation, role loss, expiry and authority/content drift.
- [ ] 2.3 Add confirmation only for the current valid unexpired immutable preview with original `File` and explicit “tất cả mẫu đã lấy, đạt chất lượng” attestation; call `confirmAccessionClient` through `api-client.ts`, reuse pending controls and never edit/reconstruct preview authority.
- [ ] 2.4 Clear stale preview/attestation on file change and give Vietnamese new-preview guidance on role loss, expiry or drift. Preserve unknown/processing after dispatched timeout/abort; block further mutation without a rollback/failed claim until Phase 3 lookup interaction is delivered.
- [ ] 2.5 Show authorized durable receipt and official IDs from the verified read, server receipt time and counts; refresh affected existing sample/accession queries using current keys only after confirmed success.
- [ ] 2.6 Record GREEN for Phase 2 focused tests and immediate blast radius; run touched-file lint, typecheck, relevant React checks, OpenSpec strict and diff checks. Do not infer runtime acceptance from mocks.
- [ ] 2.7 STOP: root independently reviews Phase 2 implementation, verified official-ID read and source evidence; accept only complete receipt/ID behavior and explicitly release Phase 3.

## 3. Phase 3 — status, retry and recovery (separate session)

- [ ] 3.1 Add focused accessible interaction tests first and record RED for unknown→lookup→success, processing, no blind replay/new upload while unresolved, refresh, file loss, eligible linked retry and owner isolation.
- [ ] 3.2 Use `fetchAccessionConfirmationStatusClient` to look up uncertain outcomes before retry; announce lookup pending, keep unknown/preparing/processing unresolved and block confirmation/new uploads/attempts. Do not add automatic replay or an unbounded polling loop.
- [ ] 3.3 Restore authorized success by validated batch UUID locator after refresh without file/payload persistence; display the same receipt/verified IDs, clear sensitive state on actor/role changes and disclose no other owner's batch/receipt.
- [ ] 3.4 For unlocked valid `preview_ready`, require exact original-file reselection or an explicit eligible linked new preview; for failed/rejected/expired use `retryAccessionPreviewClient` with parent linkage. Preserve parent history and server owner/lock/byte checks; never rebuild payload from metadata.
- [ ] 3.5 Record GREEN for Phase 3 focused tests, keyboard/focus/status announcements and immediate blast radius; run touched-file lint, typecheck, relevant React checks, OpenSpec strict and diff checks, keeping source and runtime evidence separate.
- [ ] 3.6 STOP: root independently reviews Phase 3 diff/evidence and records source acceptance, known runtime limits and a handoff for separately authorized browser verification.

## 4. Browser/runtime acceptance — separately authorized home-server session

- [ ] 4.1 Obtain operation-specific authorization and verify exact app/backend/migration revisions on the home server before build/deployment/runtime work; workspace remains source-control only, with no production operations implied by fixture or pending migration files.
- [ ] 4.2 Run deployed browser through app/proxy using synthetic data: download → upload → preview → attestation/confirm → status/receipt/official IDs, plus focused expiry/drift/unknown/file-loss/owner checks. Record revisions, timestamps, actors and actual outcomes; mocks/local PASS do not replace this lane.
- [ ] 4.3 Root reviews runtime evidence and hands full DB/HTTP/end-to-end budgets, capacity, atomicity, security, no-retention and fault matrix to TASK-7/#134 without ticking those gates from a UI smoke.

Checkpoint 0 accepted (2026-11-07): independent Spec/Standards reviews PASS after correcting the normalized-payload wording to forbid browser exposure and preserve transient server processing. Root independently ran OpenSpec strict/status (4/4 artifacts), local-link/scope/line-count checks and `git diff --check`: PASS. Only the two artifact gates are accepted; all 22 source/runtime tasks and TASK-13 acceptance criteria remain unchecked. No app/test/backend/SQL/dependency or runtime changes; application tests/typecheck/React checks NOT RUN for this documentation-only checkpoint. STOP before Phase 1 for user review; no UI phase is released automatically.

## 0. Checkpoint 0 — artifacts only

- [x] 0.1 Independently review proposal/design/spec/tasks against TASK-13/#141, approved template/atomic contracts, current API client and TASK-12 evidence; verify links, `rtk proxy openspec validate add-vietnamese-accession-import-workflow --strict --no-interactive`, `rtk proxy openspec status --change add-vietnamese-accession-import-workflow --json` and `rtk proxy git diff --check`.
- [x] 0.2 Root accepts this documentation-only checkpoint and records the explicit stop before Phase 1; all source/runtime gates remain unchecked, and later phases require their own review release.

## 1. Phase 1 — entry, file, preview and complete errors (one session)

- [x] 1.1 After checkpoint 0 release, inspect existing dialog/form/loading/query patterns and add focused accessible interaction tests first; record RED for missing entry, file boundary, pending/cancel, valid preview/client resolution and complete row errors.
- [x] 1.2 Add “Nhập từ Excel” beside the template action in `AccessionPageHeader` on `/analyst/accession`; retain mobile wrapping and walkthrough, keyboard/focus/labels, and no duplicate `/samples` entry.
- [x] 1.3 Add memory-only file selection with clear Vietnamese `0 < size < 10,000,000` decimal byte guidance, boundary checks at 9,999,999 / 10,000,000 / 10,000,001, existing pending/cancel controls and stale-response protection; do not claim abort proves server rollback.
- [x] 1.4 Use `createAccessionPreviewClient`; render immutable summary/create-reuse decisions, existing/unchanged client values and all row errors with sheet/row/column/reason/remedy. Reject malformed/unavailable responses, keep confirm unavailable, and add no count caps or persisted file/payload/error cache.
- [x] 1.5 Record GREEN for focused accessible interaction tests including cancellation/replacement and full errors; run touched-file ESLint, `rtk npm run typecheck`, relevant repo React checks, OpenSpec strict validation and diff checks. Check app/API client immediate blast radius only; report mock/source evidence accurately.
- [x] 1.6 STOP: root independently reviews Phase 1 diff, RED→GREEN and source evidence and accepts the bounded result. Phase 2 requires a separate explicit release before further code.

## 2. Phase 2 — attestation, confirmation and receipt (separate session)

- [x] 2.1 Before implementation, trace an existing owner-authorized receipt-to-committed-sample/official-ID read. If unavailable, STOP Phase 2 and return the concrete contract gap for separate scoped approval; do not invent receipt fields, query the DB directly from UI or accept counts as official IDs. All following Phase 2 tasks depend on this gate.
- [x] 2.2 Add focused accessible interaction tests first and record RED for explicit unchecked attestation, identical-file confirm, success receipt/official IDs, pending/double-click, changed-file invalidation, role loss, expiry and authority/content drift.
- [x] 2.3 Add confirmation only for the current valid unexpired immutable preview with original `File` and explicit “tất cả mẫu đã lấy, đạt chất lượng” attestation; call `confirmAccessionClient` through `api-client.ts`, reuse pending controls and never edit/reconstruct preview authority.
- [x] 2.4 Clear stale preview/attestation on file change and give Vietnamese new-preview guidance on role loss, expiry or drift. Preserve unknown/processing after dispatched timeout/abort; block further mutation without a rollback/failed claim until Phase 3 lookup interaction is delivered.
- [x] 2.5 Show authorized durable receipt and official IDs from the verified read, server receipt time and counts; refresh affected existing sample/accession queries using current keys only after confirmed success.
- [x] 2.6 Record GREEN for Phase 2 focused tests and immediate blast radius; run touched-file lint, typecheck, relevant React checks, OpenSpec strict and diff checks. Do not infer runtime acceptance from mocks.
- [x] 2.7 STOP: root independently reviews Phase 2 implementation, verified official-ID read and source evidence; accept only complete receipt/ID behavior. Phase 3 requires a separate explicit release.

## 3. Phase 3 — status, retry and recovery (separate session)

- [x] 3.1 Add focused accessible interaction tests first and record RED for unknown→lookup→success, processing, no blind replay/new upload while unresolved, refresh, file loss, eligible linked retry and owner isolation.
- [x] 3.2 Use `fetchAccessionConfirmationStatusClient` to look up uncertain outcomes before retry; announce lookup pending, keep unknown/preparing/processing unresolved and block confirmation/new uploads/attempts. Do not add automatic replay or an unbounded polling loop.
- [x] 3.3 Restore authorized success by validated batch UUID locator after refresh without file/payload persistence; display the same receipt/verified IDs, clear sensitive state on actor/role changes and disclose no other owner's batch/receipt.
- [x] 3.4 For unlocked valid `preview_ready`, require exact original-file reselection or an explicit eligible linked new preview; for failed/rejected/expired use `retryAccessionPreviewClient` with parent linkage. Preserve parent history and server owner/lock/byte checks; never rebuild payload from metadata.
- [x] 3.5 Record GREEN for Phase 3 focused tests, keyboard/focus/status announcements and immediate blast radius; run touched-file lint, typecheck, relevant React checks, OpenSpec strict and diff checks, keeping source and runtime evidence separate.
- [x] 3.6 STOP: root independently reviews Phase 3 diff/evidence and records source acceptance, known runtime limits and a handoff for separately authorized browser verification.

## 4. Browser/runtime acceptance — separately authorized home-server session

- [ ] 4.1 Obtain operation-specific authorization and verify exact app/backend/migration revisions on the home server before build/deployment/runtime work; workspace remains source-control only, with no production operations implied by fixture or pending migration files.
- [ ] 4.2 Run deployed browser through app/proxy using synthetic data: download → upload → preview → attestation/confirm → status/receipt/official IDs, plus focused expiry/drift/unknown/file-loss/owner checks. Record revisions, timestamps, actors and actual outcomes; mocks/local PASS do not replace this lane.
- [ ] 4.3 Root reviews runtime evidence and hands full DB/HTTP/end-to-end budgets, capacity, atomicity, security, no-retention and fault matrix to TASK-7/#134 without ticking those gates from a UI smoke.

Checkpoint 0 accepted (2026-11-07): independent Spec/Standards reviews PASS after correcting the normalized-payload wording to forbid browser exposure and preserve transient server processing. Root independently ran OpenSpec strict/status (4/4 artifacts), local-link/scope/line-count checks and `git diff --check`: PASS. At that exit only the two artifact gates were accepted; all 22 source/runtime tasks and TASK-13 acceptance criteria were unchecked. No app/test/backend/SQL/dependency or runtime changes; application tests/typecheck/React checks NOT RUN for that documentation-only checkpoint. Stopped before Phase 1 for user review.

## Phase 1 source acceptance — 2026-11-07

User explicitly released Phase 1 only. Worker `gpt-6.1-sol/high` reused Luna `gpt-6-luna/max` findings: shared Dialog/FormDialogContent, Input/Label, Button, Alert, Table and existing API abort support; no suitable shared Excel/error renderer or success wire schema existed. The feature-local response validator reuses the existing validation-error schema. Only the header, one preview module and its test changed in application source; no API/backend/dependency changes.

Root independently observed RED: 20/20 interaction tests failed on the absent “Nhập từ Excel” button before implementation. After implementation and the final Vietnamese label refinements, root reran GREEN: **78/78** across 5 files (20 preview interactions, 10 header, 2 page, 5 preview API client, 41 confirmation API client). Scoped ESLint, typecheck, staged-file React Doctor **100/100** (all 3 changed source files), OpenSpec strict and diff checks PASS. Independent Spec/Standards review PASS; keyboard Enter/Escape/focus return is tested, not assumed from the dialog primitive.

Reproduce from the repository root:

```bash
rtk npm run test:run -- 'src/app/(dashboard)/analyst/accession/accession-import-preview.test.tsx' 'src/app/(dashboard)/analyst/accession/accession-page-header.test.tsx' 'src/app/(dashboard)/analyst/accession/page.test.tsx' src/lib/api-client.accession-preview.test.ts src/lib/api-client.accession-confirmation.test.ts
rtk proxy node_modules/.bin/eslint 'src/app/(dashboard)/analyst/accession/accession-page-header.tsx' 'src/app/(dashboard)/analyst/accession/accession-import-preview.tsx' 'src/app/(dashboard)/analyst/accession/accession-import-preview.test.tsx'
rtk npm run typecheck
rtk proxy node_modules/.bin/react-doctor . --verbose --offline --yes --diff 6cc3ac5 --no-lint
rtk proxy openspec validate add-vietnamese-accession-import-workflow --strict --no-interactive
rtk proxy git diff --check
```

**At the Phase 1 exit: SOURCE ONLY, 8/24 tasks accepted, stopped before Phase 2.** All 16 later source/runtime tasks were unchecked and the official-ID reader was unresolved. Real-browser viewport/app-proxy smoke, build/deployment, SQL and production operations NOT RUN; mocks/source checks do not satisfy those gates. The subsequent explicit user releases and source evidence are recorded below.

## Phase 2 reader gate — 2026-11-07

Gate 2.1 initially found no app reader. The user separately approved the five-file source-only reader scope recorded in the design. The new file-free samples GET reuses existing owner/status authorization and authenticated session RLS; it projects only committed sample IDs, reads all pages and rejects incomplete/duplicate/malformed data. Compact receipt/status, SQL, grants/policies and dependencies are unchanged.

Root independently observed behavioral RED in the existing client test module (reader missing; module loads). The new route suite separately had structural RED before the route existed. Final root GREEN: **174/174 across 8 files**, including 14 new client and 29 new route cases plus 131 existing cases. Scoped five-file ESLint, typecheck and independent Spec/Standards review PASS. Byte comparison confirms the API client's baseline is unchanged outside the new reader block/import. Its existing mixed line endings were preserved; the exact whitespace gate is `rtk proxy git -c core.whitespace=cr-at-eol diff --check` (PASS), with no repository config change or baseline rewrite.

**SOURCE ONLY, 9/24 tasks accepted.** Root releases tasks 2.2–2.7 for the already authorized Phase 2 UI; Phase 3 remains unreleased. Source/mock guard tests do not prove deployed RLS: SQL, runtime/browser and production operations NOT RUN.

## Phase 2 UI source acceptance — 2026-11-07

Reader prerequisite is isolated in commit `cbf007a`. Worker `gpt-6.1-sol/high` implemented Phase 2 UI after its source gate; read-only Luna `gpt-6-luna/max` verified shared Checkbox/Label, acknowledgement, SampleIdCell and existing sample/search query patterns. The old schema/preview display moved into one feature-local results file; no shared hook/service or new dependency was introduced.

Root independently observed **18/18 RED** on the missing attestation/confirmation/expiry UI before production edits. Review then found a cache gap when known success returned after header unmount: root reproduced the existing case RED (zero invalidations), worker moved only succeeded cache invalidation before the lifetime guard, and the same case went GREEN. UI state and ID reads remain guarded; accepted work is not canceled by dialog close, and unknown blocks new uploads across close/reopen. Receipt success survives separate ID-read failure. Phase 3 navigation/refresh recovery is not implemented by this local guard.

Final root verification: **192/192 across 9 files**, six-file scoped ESLint, typecheck, OpenSpec strict and CRLF-aware whitespace PASS; staged offline React Doctor **100/100**, scanning all **11** changed source files against `9891d0a`. Independent Spec/Standards review PASS after the unmount-cache fix. Reproduce the source tests:

```bash
rtk npm run test:run -- 'src/app/(dashboard)/analyst/accession/accession-import-confirmation.test.tsx' 'src/app/(dashboard)/analyst/accession/accession-import-preview.test.tsx' 'src/app/(dashboard)/analyst/accession/accession-page-header.test.tsx' 'src/app/(dashboard)/analyst/accession/page.test.tsx' src/lib/api-client.accession-confirmation.test.ts 'src/app/api/accession-confirmation/[batchId]/samples/route.test.ts' src/lib/accession-preview/status.test.ts 'src/app/api/accession-confirmation/[batchId]/route.test.ts' src/lib/api-client.accession-preview.test.ts
rtk npm run typecheck
rtk proxy node_modules/.bin/react-doctor . --verbose --offline --yes --diff 9891d0a --no-lint
rtk proxy openspec validate add-vietnamese-accession-import-workflow --strict --no-interactive
rtk proxy git -c core.whitespace=cr-at-eol diff 9891d0a --check
```

**SOURCE ONLY, 15/24 tasks accepted. STOP before Phase 3.** All nine Phase 3/browser-runtime tasks remain unchecked; Backlog AC #1/#2 accepted, #3/#4/#5 remain open. No SQL/grant/policy, deployment or production operations occurred; real-browser viewport/app-proxy/RLS smoke and TASK-7 capacity/fault evidence remain NOT RUN/separate. Source/mocks do not prove runtime acceptance.

## Phase 3 source evidence — 2026-11-08

User released Phase 3 only. Worker `gpt-6.1-sol/high` reused the existing status/retry/receipt clients and UI controls. Read-only Luna `gpt-6-luna/max` confirmed that `AuthenticatedQueryBoundary` already keys its provider by `principalKey`, remounting descendants on actor/role changes; no new auth listener, provider, backend, dependency or schema was added. A small feature-local controller owns requests and a single raw validated batch UUID in `sessionStorage`; workbook, preview, receipt, IDs and errors remain in memory. Recovery requires opening the dialog and explicit status lookup, with no polling or automatic confirmation replay.

Unknown/preparing/processing remain blocked across close/reopen and locator recovery. When the file/preview was lost, eligible `preview_ready`, failed, rejected or expired attempts use an explicit linked new preview through the existing retry client; no summary/expiry/payload is reconstructed. Known parent linkage survives file changes and local expiry. Denied status/ID reads clear private presentation and the locator; ordinary ID-read errors preserve the committed receipt. Requests from an unmounted/previous principal cannot restore private data or write the locator, while known success still invalidates the existing sample/search caches after unmount. If browser storage is unavailable, the in-memory unresolved guard remains; refresh persistence depends on session storage availability.

Root independently observed **21 + 4 behavioral RED cases** before implementation, including real principal-boundary remounts. Review added and independently reproduced **3 RED** cases for status-shaped ordinary previews and malformed/wrong-parent retry status; **2 RED** cases for loss of known success on a resolved-unknown lookup and missing live pending announcement; and **2 RED** races where original IDs resolve during/after an unknown lookup. Strict shared schema/parent checks, live status text and same-success request ownership fixed those cases without a new abstraction. Existing test harnesses isolate session storage; the prior unmount regression now expects a recovered unknown guard and still asserts both cache invalidations and no stale receipt/IDs.

Final root GREEN: **224/224 across 10 files**, including **32** new recovery cases. Five-file scoped ESLint, typecheck and staged offline React Doctor **100/100 on all 5 changed source files** PASS. OpenSpec strict and CRLF-aware whitespace checks PASS. Independent Spec and Standards/quality reviews PASS; root accepts tasks 3.1–3.6. **21/24 tasks accepted**, Backlog AC #1–#4 complete; AC #5 and all three runtime tasks remain open. STOP before browser/runtime release.

```bash
rtk npm run test:run -- 'src/app/(dashboard)/analyst/accession/accession-import-recovery.test.tsx' 'src/app/(dashboard)/analyst/accession/accession-import-confirmation.test.tsx' 'src/app/(dashboard)/analyst/accession/accession-import-preview.test.tsx' 'src/app/(dashboard)/analyst/accession/accession-page-header.test.tsx' 'src/app/(dashboard)/analyst/accession/page.test.tsx' src/lib/api-client.accession-confirmation.test.ts 'src/app/api/accession-confirmation/[batchId]/samples/route.test.ts' src/lib/accession-preview/status.test.ts 'src/app/api/accession-confirmation/[batchId]/route.test.ts' src/lib/api-client.accession-preview.test.ts
rtk npm run typecheck
rtk proxy node_modules/.bin/react-doctor . --verbose --offline --yes --diff 070c27a --no-lint
rtk proxy openspec validate add-vietnamese-accession-import-workflow --strict --no-interactive
rtk proxy git -c core.whitespace=cr-at-eol diff 070c27a --check
```

**SOURCE ONLY.** Browser/runtime tasks 4.1–4.3 remain NOT RUN and require a separate release. Next runtime verification must bind synthetic actors, exact app/backend revisions and timestamps on the authorized home-server environment; exercise download→upload→preview→confirm→status/receipt, refresh/file loss, linked retries, owner denial and app/proxy viewport/focus behavior. No SQL, Docker, SSH, deployment or production operations occurred in Phase 3. TASK-7 retains capacity, budgets, atomicity, security, no-retention and full fault certification; these source/mocked interactions do not establish live authorization/RLS or real-browser acceptance.

## Deployment preflight — 2026-11-08

User subsequently authorized app deployment and backend/migration compatibility verification. [Preflight evidence](deployment-preflight-2026-11-08.md): candidate production-bound image for `bd3b0a2` built successfully on the home server and rollback image preserved; root independently verified image/revision/source labels and the active old app remains healthy. Promotion NOT RUN at that checkpoint: production lacks recovery/maintenance RPCs, preview configuration/Compose forwarding and measured policy/proxy controls. Additional TASK-7/production SQL/configuration scope was presented and then explicitly approved by the user; prerequisite work is now in progress. No SQL, runtime config or service replacement occurred during the preflight. Do not infer rollout or browser acceptance from this candidate. Tasks 4.1–4.3 remain open, **21/24**, until verified.

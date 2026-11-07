## Context

[TASK-13 / #141](https://github.com/thienchi2109/lims-lite/issues/141) follows the [partition](../../../docs/superpowers/specs/2026-11-02-import-implementation-partition.md), [template contract](../../../docs/superpowers/specs/2026-11-01-excel-template-contract-design.md), [atomic contract](../../../docs/superpowers/specs/2026-11-01-atomic-import-provenance-contract-design.md) and [TASK-12 design](../add-accession-confirmation-recovery/design.md). TASK-11 has 28/28 accepted tasks and TASK-12 has 27/27 with **ISOLATED ONLY** acceptance; their evidence does not establish production rollout. Checkpoint 0 changes documentation only.

Current source anchors:

| Boundary | Existing authority / reuse |
| --- | --- |
| Entry | `src/app/(dashboard)/analyst/accession/accession-page-header.tsx`: `AccessionPageHeader`, template `Button`, `Loader2`, `aria-busy`, `flex-wrap` and `WalkthroughTrigger` |
| Accessible surface / tests | `src/components/ui/dialog.tsx`, `src/components/ui/form-dialog-content.tsx`; `src/app/(dashboard)/analyst/accession/accession-page-header.test.tsx` covers keyboard/focus, pending, retry and walkthrough behavior |
| Preview mutation | `src/lib/api-client.ts`: `createAccessionPreviewClient(file, retryOfBatchId?, { signal })`; `POST /api/accession-preview` accepts `file` and optional `retryOfBatchId` |
| Preview display | `src/lib/accession-preview/server.ts`: `ok`, `batchId`, `previewCreatedAt`, `expiresAt`, counts for clients/samples/assignments/create/reuse, and client row/disposition/input/existingValues/unchangedFields |
| Errors and status | `src/lib/accession-preview/http-contract.ts`: `PreviewValidationResponseSchema`, `accessionConfirmationStatusSchema`, `accessionReceiptSchema`; full row locations/messages, allowlisted outcomes and compact receipt |
| Confirm / lookup / retry | `src/lib/api-client.ts`: `confirmAccessionClient`, `fetchAccessionConfirmationStatusClient`, `retryAccessionPreviewClient`; `src/app/api/accession-confirmation/[batchId]/route.ts` |
| Query refresh | `src/types/query-keys.ts`: `sampleKeys.all`; `src/hooks/use-samples.ts` uses that key for existing sample invalidation. Confirm active consumers before wiring success refresh. |

## Goals / Non-Goals

**Goals:** Deliver an accessible Vietnamese analyst flow through three independently reviewed source sessions. Preserve the existing file/preview/attestation/receipt boundaries and status-first retry. Make every failure actionable without inventing a business result.

**Non-Goals:** New parser, resolver, canonicalization, transaction, generic workflow service, dependency, business count cap, backend/schema change, production operation or TASK-7 capacity/fault certification. Do not introduce a second entry on `/samples`.

## Decisions

### 1. One accession entry and small local UI composition

Place “Nhập từ Excel” beside the template button in `AccessionPageHeader`, preserving its wrapping action region and walkthrough. Reuse existing accessible dialog/sheet, labels, alerts, table and pending patterns after targeted inspection; keep feature state close to its UI. A local component split is justified only by responsibility/size, with the repo's practical 250–350 line target. No generic state-machine service or global store is needed.

An additional route or `/samples` entry would duplicate the approved accession entry. A custom overlay would repeat the repo's focus/keyboard behavior. Source phases must prove keyboard opening, Escape/cancel where allowed, focus return, associated file/attestation labels, announced pending/error states and mobile wrapping.

### 2. Phase 1 ends at a complete read-only preview

Accept an XLSX selection with `0 < file.size < 10_000_000` decimal bytes; server validation remains authoritative. Show the exact ceiling in Vietnamese and test 9,999,999 / 10,000,000 / 10,000,001 bytes. Do not replace byte guards with client/sample/assignment count caps or implement a browser workbook parser.

Call `createAccessionPreviewClient` through the existing API boundary, disable duplicate submissions while pending and provide cancellation through its signal support. Clear abandoned UI state and ignore stale responses when the selection changes or the flow closes. Cancellation stops waiting/admission where possible; it does not prove server rollback or deletion of a preview already sealed.

Render server counts, create/reuse dispositions, existing values and unchanged-field explanations without editing the immutable preview. For invalid workbooks, retain the full returned error list in memory: sheet, row, column/header, reason and a Vietnamese remedy using the existing error code/message contract. Pagination/scrolling must preserve access to every error; never slice a list into a successful or partial preview. An unavailable/malformed/over-budget response stays an error. No confirm action exists in this phase.

Keep `File`, preview clients and row errors only in browser memory. Do not persist them in local/session storage, IndexedDB, URL/history, durable query caches, logs, analytics or error reports. Release references on replacement/close/logout as appropriate. Batch UUID alone may support an authorized recovery locator in Phase 3; it grants no access and contains no source data.

### 3. Phase 2 adds explicit attestation and one confirmation

Enable confirm only for the current valid unexpired preview and an unchecked-by-default attestation that all samples have been collected and meet quality requirements. Expiry is based on server `expiresAt`; client time is guidance, while the server decides admission. Changing file bytes/selection clears the preview and attestation. Role loss, authority/catalog/client drift, changed content or expiry requires a new preview rather than browser repair.

Use `confirmAccessionClient(batchId, originalFile, true)`. It already performs status preflight, checks the source ceiling and sends only the original `File` plus literal `acceptableQuality=true`. Do not compute or send browser authority hashes, normalize/rebuild the workbook or directly import server actions. Disable repeated activation during the request. After dispatch, abort/timeout/closed UI cannot assert rollback; `unknown` or `processing` must remain unresolved and block further mutation, with status/retry interaction completed in Phase 3.

Show the authorized committed receipt's batch ID, server receipt time and counts; invalidate existing affected accession/sample queries only after confirmed success using the repo's existing keys. Official sample identifiers are an explicit readiness dependency: current `accessionReceiptSchema` contains batch/owner IDs, counts and receipt time, not sample mappings. Before Phase 2 implementation, trace an existing owner-authorized receipt-to-committed-sample read. If no such path exists, stop Phase 2 and return the concrete interface gap for separate scoped approval. Do not invent identifiers, infer them from counts, extend the receipt silently or claim Phase 2 accepted without them.

### 4. Phase 3 preserves uncertainty and file-free success recovery

Use `fetchAccessionConfirmationStatusClient` for status and `retryAccessionPreviewClient` for an eligible linked preview; these already enforce status-before-mutation and owner checks remain server-side. Reuse normal pending controls; avoid an automatic retry loop or new polling abstraction. A batch recovery locator must survive refresh without retaining the workbook, client rows or errors; validate its UUID before lookup and reauthorize every read. On account/role changes clear displayed sensitive state, and never reveal another owner's receipt/batch details.

| Observed state | UI action |
| --- | --- |
| `preparing`, `processing`, `unknown` | Explain that the outcome is being checked; offer status lookup, block confirm/replay and new uploads/attempts for this flow while unresolved. Transport errors stay unknown. |
| `succeeded` | Show the same committed receipt and authorized IDs without asking for a source file. |
| Unlocked `preview_ready` | Confirm only with the exact original bytes while valid. If the file was lost, allow selecting the exact file again or explicitly starting an eligible linked new preview; never reconstruct payload from metadata. |
| `failed`, `rejected`, `expired` | Explain the safe outcome and start a new linked preview when requested; never reset the parent. |
| Authorization denied | Clear private presentation, show the Vietnamese denial/login path and disclose no foreign batch/receipt. |

File reselection is not evidence of byte identity; the server verifies it. A linked attempt uses `retryOfBatchId`, with current SQL status/lock/owner checks as final authority. No automatic POST follows a GET merely because a status changed.

### 5. Separate review and evidence lanes

Stop after checkpoint 0 for independent root artifact review, then after each Phase 1/2/3 session for source review and authorization to continue. Each source session begins with focused accessible interaction tests failing for its missing behavior, then records GREEN, touched-file lint, typecheck, relevant React checks and OpenSpec strict validation. Mocked timeout/expiry/drift/owner scenarios prove UI handling only.

Runtime is a separate authorized home-server session: deployed browser through app/proxy, synthetic download → upload → preview → confirm → status/receipt, recording exact revisions, timestamps and actors. No workspace container or DB operation is permitted. Full DB/HTTP/end-to-end budgets, capacity, atomicity, security, retention and fault matrix remain TASK-7/#134. Fixtures and pending migrations are not production readiness evidence.

## Risks / Trade-offs

- Official identifiers lack a proven current browser read path → block Phase 2 at its readiness gate and return the smallest specific contract gap.
- Response loss can hide a successful commit → preserve unknown, use status first and recover the existing receipt without file replay.
- Workbook/preview data can contain PII → memory-only feature state, no durable caches/telemetry, clear stale data and reauthorize recovery.
- Large valid files/errors can exceed safe runtime budgets → preserve fail-closed server admission and complete errors; TASK-7 measures capacity rather than adding count caps.
- Small source sessions leave later actions unavailable temporarily → each checkpoint exposes only completed behavior and makes its incomplete scope explicit in the review handoff.

## Migration Plan

No database migration is planned. Source changes ship only after their individual review gates; production build/deployment/browser checks require separate home-server authorization and verified prerequisite revisions. App rollback follows the existing release procedure and must not revert durable receipts, audit/provenance or applied migrations.

## Open Questions

- **Unresolved interface, not a new product decision:** Which existing authorized read links a committed batch receipt to official sample identifiers? Phase 2 must establish it or stop for scoped follow-up; the compact HTTP receipt alone is insufficient.

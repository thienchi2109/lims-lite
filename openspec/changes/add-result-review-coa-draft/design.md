## Context

An analyst currently sends a completed sample directly from `in_progress` to
`review` after a short confirmation. The manager can see the results, but the
analyst has no document-level review step and no recorded conclusion about
whether each entered result is within or outside the configured reference
range.

The existing CoA stack already renders sample information and result columns
for value, unit, reference range, and method. The existing signed submission
workflow uses `sample_submissions` and the `SECURITY DEFINER`
`submit_sample_for_review` RPC. These are the correct integration points, but
the preview itself must remain an ephemeral client-side document: it cannot
create a CoA record, upload a document, calculate a final-document hash, or
mutate workflow state.

Stakeholders are analysts, who need a convenient final review before sending,
and managers, who need to see the analyst's recorded conclusion alongside the
submitted result context. The feature must preserve the audit and RLS
boundaries used by the existing Part 11-aware submission flow.

## Goals / Non-Goals

**Goals:**

- Replace the minimal analyst submission confirmation with a Vietnamese draft
  CoA review dialog.
- Show the exact sample context and all entered results, including unit,
  method, and configured reference range, before an analyst submits.
- Require one explicit manual assessment, `within_reference` or
  `outside_reference`, for every result before the `Gửi phê duyệt` action is
  available.
- Preserve the analyst's assessment and the reviewed result context as
  immutable, auditable submission snapshots.
- Keep the existing signature, authorization, result-completeness, and
  `in_progress` to `review` safeguards intact.
- Make the snapshots available to managers and prefer the recorded reference
  range when a final CoA is generated after approval.
- Bind every CoA created after this change to the exact approved submission
  that supplied its assessment snapshots.

**Non-Goals:**

- The application does not infer or calculate whether a result is inside or
  outside its reference range.
- The draft is not a new CoA lifecycle state and is not persisted in
  `coa_reports`, object storage, audit logs, or a document hash.
- This change does not alter manager approval, rejection, electronic-signature,
  or final-CoA release semantics.
- This change does not add a third assessment state, free-text assessment note,
  automatic validation rule, or reference-range configuration UI.

## Decisions

### 1. Extend the canonical CoA template with a draft mode

The draft SHALL extend the existing CoA template entry point and its existing
sample, result, metadata, and stylesheet helpers. It SHALL be a draft mode of
the canonical CoA document, not an independent document renderer. The dialog
will use a wide or full-screen, scrollable document surface so the analyst can
compare all results in one place. It will show a prominent
`BẢN NHÁP - CHƯA GỬI DUYỆT` watermark and omit signatures, manager approval
information, and approval date.

The draft result table will add a `Đánh giá` column. Each row will use a
shadcn `RadioGroup` with two visible `RadioGroupItem` choices, rather than a
collapsed `Select`, so analysts can scan both conclusions and the selected
state without opening another control. The group provides a required, mutually
exclusive choice:

- `Trong khoảng tham chiếu`
- `Ngoài khoảng tham chiếu`

The application will render the configured reference range but will not
preselect, derive, color-classify, or otherwise determine the conclusion. The
footer will contain the confirmation message
`Bạn có chắc chắn muốn gửi các kết quả này để cấp quản lý phê duyệt không?`,
an action to return to editing, and `Gửi phê duyệt`. The submit action remains
disabled until every result has an assessment.

Draft-specific code is limited to the draft watermark, suppression of
final-document certification sections, an optional `Đánh giá` result-cell slot,
and the review-footer controls. It SHALL NOT copy or reimplement CoA document
markup, section layout, result grouping, styles, escaping, or CoA data mapping.
If the current HTML-rendering boundary cannot host interactive assessment
controls directly, the existing template SHALL be refactored into shared
canonical presentation primitives used by both final static output and draft
interactive output. A separate `DraftCoA` document renderer, copied template
files, or copied CoA stylesheet are prohibited.

Alternative considered: show a compact confirmation table separate from the
CoA. Rejected because it duplicates the document view that the analyst needs
to inspect and makes cross-checking sample context, methods, values, and
reference ranges less direct.

### 2. Keep the canonical draft mode ephemeral

The draft mode reads existing data only. It uses the same canonical CoA
document layout while omitting final-document-only sections and adding only the
draft watermark and assessment controls.

Opening the dialog reads existing data only. Closing it, using `Quay lại chỉnh
sửa`, or changing assessments only updates local UI state. No draft HTML,
`coa_reports` row, upload, hash, workflow-state update, or audit event is
created until the analyst completes the existing signed submission flow.

Alternative considered: create a temporary persisted CoA report and delete it
on cancel. Rejected because deletion conflicts with the application's
append-only/audit posture and would create unnecessary compliance artifacts.

### 3. Store immutable per-result snapshots linked to each submission

Create an append-only `result_reference_assessments` table. Each row links one
`sample_submissions` record to one `results` record and records:

- the result identifier;
- the assessment enum, `within_reference` or `outside_reference`;
- snapshots of assay name, entered value, unit, method name, and configured
  reference range displayed for that submission;
- analyst identifier and assessment timestamp.

A uniqueness constraint on `(submission_id, result_id)` enforces one
assessment per submitted result. Foreign keys use restrictive deletion
semantics so a signed submission cannot lose its result context. The table will
have an audit trigger and comments documenting its record-linking purpose.

Snapshots, rather than joins to mutable assay configuration, preserve what the
analyst reviewed. The analyst ID and timestamp are duplicated intentionally
from `sample_submissions` to make the per-result assessment record independently
auditable.

Alternative considered: add mutable assessment columns to `results`. Rejected
because resubmission would overwrite the previous conclusion and no longer
bind an assessment to the signature/submission event that certified it.

### 4. Extend the submission RPC with a complete assessment payload

Replace the callable one-argument `submit_sample_for_review(UUID)` RPC with
`submit_sample_for_review(UUID, JSONB)`. The payload contains exactly one
assessment and reviewed revision token for every result. The server treats the
payload as a declaration, not as the source of document content:

1. Re-run the current role, ownership, signature, sample-status, and
   all-result-complete validations.
2. Lock and load the submitted results and their assay definitions.
3. Reject an incomplete, duplicate, foreign-result, invalid-enum, or stale
   payload without creating any record or changing sample state.
4. Create the signed `sample_submissions` row using the existing numbering and
   supersession behavior.
5. Insert one assessment snapshot for each server-loaded result.
6. Move the sample to `review` and return the existing success shape.

The payload's revision tokens represent the result and assay configuration
shown in the draft. If either changes after the dialog opened, the RPC fails
without state change and the client reloads the sample before the analyst
reopens the review. Snapshot values, units, methods, and ranges are always
constructed from the locked database rows, never trusted from the browser.

The obsolete one-argument RPC will be removed or made unavailable in the same
migration so no caller can bypass mandatory assessment validation. Grants will
remain limited to `authenticated`; the function's `SECURITY DEFINER`,
`search_path`, and explicit revoke/grant pattern will match the current secure
submission function.

Alternative considered: insert assessments before opening the dialog and
update them at submission. Rejected because cancellation would leave persisted
draft data and updateable assessment history.

### 5. Enforce database-only writes and scoped read access

RLS will deny direct inserts, updates, and deletes of assessment rows. The
submission RPC is the only write path. Analysts can read records associated
with their own submissions; managers can read records for samples they are
authorized to approve. Existing sample and tenant/role predicates remain the
source of authorization truth.

The manager approval detail query will fetch the latest active submission and
its assessment snapshots. It will show the same Vietnamese label, `Đánh giá`,
with the snapshot value and range, rather than recalculating the conclusion.

Alternative considered: permit the analyst client to insert snapshots through
RLS. Rejected because it would allow unsigned or partial records outside the
atomic workflow transition.

### 6. Bind final CoA reports to their approved submission

Add a nullable `coa_reports.source_submission_id` foreign key to
`sample_submissions` with restrictive deletion semantics. It is nullable only
to preserve historic CoA reports created before this change. Every new CoA
report created through the approval workflow SHALL have this source ID, and the
ID SHALL be immutable after report creation. A database guard SHALL reject any
update that changes a non-null source ID, including a status-update or retry
path.

During manager approval/completion, the workflow will lock the sample and
resolve its one active submission from the signed submission chain:
`sample_id = current sample` and `superseded_by IS NULL`. The workflow will
persist that exact ID when it queues or creates the CoA report. The CoA renderer
will then load assessment snapshots and reference ranges by
`coa_reports.source_submission_id`; it SHALL NOT re-run a "latest submission"
query at render or retry time.

When a CoA generation attempt fails and is retried, the retry SHALL preserve
the report's stored source submission ID. If a report is amended, the
replacement report SHALL explicitly retain or declare its source submission ID
as part of the amendment record; it must never infer a different source based
on timestamp or current assay configuration.

This creates an immutable record linkage:

```text
coa_reports.source_submission_id
  -> sample_submissions.id
  -> result_reference_assessments.submission_id
```

Historic reports without a source ID retain the existing assay-definition
fallback. New reports do not use that fallback.

Alternative considered: resolve the newest submission every time a CoA is
rendered. Rejected because a later resubmission or retry could silently change
the signed assessment context of an already approved report.

## Risks / Trade-offs

- **Draft diverges from the final CoA template** -> Extend one canonical
  template and shared presentation primitives; prohibit copied document
  renderers, markup, styles, and data mapping. Add focused rendering tests for
  both modes.
- **A result or configured range changes while the dialog is open** -> Submit
  revision tokens and reject stale payloads atomically; refresh the analyst
  view before a new review begins.
- **A legacy caller invokes the old RPC signature** -> Remove or revoke the
  one-argument signature in the migration and update the only client mutation
  bridge in the same change.
- **Incomplete or tampered browser payload bypasses disabled UI** -> The RPC
  compares the exact server-loaded result set to the payload and rolls back on
  any mismatch.
- **Historical CoA data has no assessment snapshots** -> Final CoA resolution
  falls back to current assay configuration only for reports predating this
  change; no old records are rewritten.
- **A CoA retry uses a later submission** -> Persist
  `coa_reports.source_submission_id` during approval/completion and prohibit
  the renderer or retry worker from resolving a new source by timestamp.
- **The additional review can slow urgent submission** -> Keep all assessments
  in the single document table and preserve the existing submission path once
  the analyst has completed the review.

## Migration Plan

1. Add the assessment enum and append-only snapshot table with restrictive
   foreign keys, unique constraint, comments, RLS policies, audit trigger, and
   security-test coverage. Add the immutable `coa_reports.source_submission_id`
   link, index, and compatibility treatment for historic reports.
2. Replace the RPC signature, preserving current signature and status
   validations while adding exact-set, enum, and stale-revision validation plus
   atomic snapshot insertion.
3. Update the result read model and client mutation contract, then add the
   draft CoA dialog and assessment state.
4. Extend manager approval/completion and CoA queue creation to persist the
   exact active submission as each new report's source. Load final CoA
   snapshots only through that stored source ID.
5. Apply the migration through Docker, run `run_security_tests()`, and execute
   focused database, component, and CoA-rendering regression tests.

Rollback before use consists of reverting the application and replacing the
two-argument RPC with a function that maintains the desired workflow policy.
After submissions contain snapshots, rollback must retain the table and audit
records; application reads can ignore the table, but records must not be
deleted or rewritten.

## Open Questions

None. The assessment set is intentionally limited to the two explicit manual
conclusions agreed for this change.

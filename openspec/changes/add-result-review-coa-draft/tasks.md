## Phase 1: Secure assessment snapshot foundation

- [x] 1.1 Locate current callers of `submit_sample_for_review`, signed
  submission tests, direct-write protections, and relevant result/assay
  revision fields. Record the existing signature, ownership, status,
  completeness, numbering, and supersession behavior.
  - Recorded: the live one-argument `submit_sample_for_review(UUID)` remains
    analyst-only and signature-gated; it locks the sample, requires
    `in_progress`, requires at least one non-empty result, atomically numbers
    submissions, links resubmissions through `superseded_by`, and clears
    rejection metadata. It has no separate sample-owner check. Result and assay
    revision tokens are `results.updated_at` and
    `assay_definitions.updated_at`; snapshot display values use `name`, `value`,
    `units`, `method_name`, and `normal_range`.
- [x] 1.2 Add failing database regression tests for exact per-result
  assessments, duplicate/foreign/invalid payload values, stale review data,
  transaction rollback, direct-write denial, and resubmission history.
- [x] 1.3 Add a migration defining the two-value assessment enum and append-only
  `result_reference_assessments` table with restrictive foreign keys, unique
  `(submission_id, result_id)` constraint, comments, audit trigger, RLS, grants,
  and documented security impact.
- [x] 1.4 Implement
  `submit_sample_for_review_with_assessments(UUID, JSONB)` with the existing
  secure checks plus server-side exact-result-set, enum, and revision-token
  validation. Lock database rows, construct snapshots server-side, and create
  the submission, snapshots, and status transition atomically.
- [x] 1.5 Apply the migration through Docker and run
  `SELECT * FROM run_security_tests();`. Keep the existing one-argument RPC and
  client caller unchanged for this phase.

## Phase 2: Mandatory analyst draft review

- [x] 2.1 Add failing focused TypeScript/component tests for the watermark,
  omitted final certification content, visible ranges, manual-only assessment
  choices, disabled `Gửi phê duyệt`, cancellation, stale-data failure, and
  successful query invalidation.
- [x] 2.2 Extend result read models, Zod schemas, and client types with
  `normal_range` and the result/assay revision data required by the reviewed
  submission contract.
- [x] 2.3 Extend the canonical CoA template with a draft mode that reuses
  document structure, sample/result layout, styles, escaping, grouping, and
  data mapping. Add only draft watermarking, suppressed certification content,
  the injectable `Đánh giá` cell, and the review footer.
- [x] 2.4 Replace the minimal analyst confirmation with a responsive Vietnamese
  draft CoA dialog. Keep assessments in local state, route the validated payload
  through `src/lib/api-client.ts`, and refresh the analyst view after a
  successful submission.
- [x] 2.5 Move the application caller to
  `submit_sample_for_review_with_assessments`. Once focused tests prove the
  assessment-aware path, remove or revoke the legacy one-argument
  `submit_sample_for_review(UUID)` RPC in a secure migration and re-run
  `run_security_tests()`.

## Phase 3: Manager assessment review

- [ ] 3.1 Add failing focused tests proving that manager approval detail renders
  the submitted snapshot assessment, value, unit, method, and reference range
  without recalculating the conclusion.
- [ ] 3.2 Extend approval read models and manager detail UI to consume immutable
  snapshot data for the active submission.
- [ ] 3.3 Invalidate and refetch manager queries after a reviewed submission,
  rejection, and resubmission. Verify that prior submission history remains
  visible where the existing workflow exposes it.

## Phase 4: Final CoA provenance

- [ ] 4.1 Add failing database and CoA regression tests for immutable report
  source binding, reference-range changes after submission, rejected and
  replaced submissions, historic-report fallback, failed generation retry, and
  regeneration.
- [ ] 4.2 Add a migration for nullable `coa_reports.source_submission_id` with
  restrictive foreign key, index, comments, immutability guard, historic-report
  compatibility, RLS/grant review, and documented security impact.
- [ ] 4.3 Update manager approval/completion and CoA queue creation to resolve
  the approved active submission under lock and persist it as
  `source_submission_id`.
- [ ] 4.4 Update final CoA data resolution, retries, and regeneration to load
  snapshots and ranges through the immutable source ID. Retain the existing
  assay-range fallback only for historic reports without a source ID.
- [ ] 4.5 Apply the migration through Docker and run
  `SELECT * FROM run_security_tests();`.

## Phase Gates and Final Verification

- [ ] 5.1 Before starting a phase, review only its stated dependencies and keep
  unrelated refactors outside the change.
- [ ] 5.2 After every phase, run its focused database and component tests,
  `npm run lint`, and `npm run typecheck`. Inspect touched files for Vietnamese
  UI copy, strict TypeScript, `api-client` mutation usage, and file-size
  boundaries.
- [ ] 5.3 After Phase 4, run the complete focused suite spanning submission,
  draft rendering, manager approval, CoA rendering, retries, authorization, and
  historic fallback.
- [ ] 5.4 Run `openspec validate add-result-review-coa-draft --strict` after
  document changes and before implementation. File a follow-up issue for any
  work intentionally outside these phase boundaries.

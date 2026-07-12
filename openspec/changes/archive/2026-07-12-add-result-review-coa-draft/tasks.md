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

- [x] 3.1 Add failing focused tests proving that manager approval detail renders
  the submitted snapshot assessment, value, unit, method, and reference range
  without recalculating the conclusion.
- [x] 3.2 Extend approval read models and manager detail UI to consume immutable
  snapshot data for the active submission.
- [x] 3.3 Invalidate and refetch manager queries after a reviewed submission,
  rejection, and resubmission. Verify that prior submission history remains
  visible where the existing workflow exposes it.

## Phase 4: Final CoA provenance

- [x] 4.1 Add failing database and CoA regression tests for immutable report
  source binding, reference-range changes after submission, rejected and
  replaced submissions, historic-report fallback, failed generation retry, and
  regeneration.
- [x] 4.2 Add a migration for nullable `coa_reports.source_submission_id` with
  restrictive foreign key, index, comments, immutability guard, historic-report
  compatibility, RLS/grant review, and documented security impact.
- [x] 4.3 Update manager approval/completion and CoA queue creation to resolve
  the approved active submission under lock and persist it as
  `source_submission_id`.
- [x] 4.4 Update final CoA data resolution, retries, and regeneration to load
  snapshots and ranges through the immutable source ID. Retain the existing
  assay-range fallback only for historic reports without a source ID.
- [x] 4.5 Apply the migration through Docker and run
  `SELECT * FROM run_security_tests();`.

## Phase Gates and Final Verification

- [x] 5.1 Before starting a phase, review only its stated dependencies and keep
  unrelated refactors outside the change.
  - Phase 2 evidence: reviewed the analyst draft-review dependencies and kept
    manager review and final CoA provenance work in Phases 3 and 4 untouched.
  - Phase 3 evidence: reviewed the manager approval read path, immutable
    submission snapshots, and existing cache invalidation boundaries; no
    migration or Phase 4 CoA provenance work was required.
  - Phase 4 evidence: limited the implementation to immutable CoA provenance,
    approval/queue binding, retries, regeneration, authorization, and historic
    fallback. Follow-up Issues #74 and #75 remained outside this change.
- [x] 5.2 After every phase, run its focused database and component tests,
  `npm run lint`, and `npm run typecheck`. Inspect touched files for Vietnamese
  UI copy, strict TypeScript, `api-client` mutation usage, and file-size
  boundaries.
  - Phase 2 evidence: 68 focused Vitest tests passed, changed-file ESLint and
    typecheck passed, React Doctor scored 100/100, and Docker SQL regression
    plus `run_security_tests()` passed.
  - Phase 3 evidence: 63 focused Vitest tests across 12 files passed, lint
    completed with no errors, typecheck passed, React Doctor scored 100/100,
    Docker security tests passed 27/27, and OpenSpec strict validation passed.
    UI copy remains Vietnamese, Zod and TypeScript stay strict, client
    mutations use `api-client.ts`, and all new source files plus the expanded
    approval components remain within the configured size boundary. Existing
    shared route/client modules remain above the preferred limit and were
    changed only at their extension points.
  - Phase 4 evidence: all 174 Vitest files passed with 999 tests passed and 4
    skipped; the six focused CoA SQL regression suites and all 28 security tests
    passed. On 2026-07-12, repository lint completed with 0 errors and 96
    pre-existing warnings, and typecheck passed. Touched-file sizes were
    inspected; existing shared action, helper, and regression-test modules
    remain above the preferred boundary.
- [x] 5.3 After Phase 4, run the complete focused suite spanning submission,
  draft rendering, manager approval, CoA rendering, retries, authorization, and
  historic fallback.
- [x] 5.4 Run `openspec validate add-result-review-coa-draft --strict` after
  document changes and before implementation. File a follow-up issue for any
  work intentionally outside these phase boundaries.

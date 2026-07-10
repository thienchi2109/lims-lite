## 1. Submission-contract regression coverage

- [ ] 1.1 Locate all current callers of `submit_sample_for_review`, the
  signed-submission tests, and the approval/CoA result-read queries; document
  their required result, signature, status, and supersession behavior before
  changing the RPC signature.
- [ ] 1.2 Add failing focused database regression tests for complete
  per-result assessments, exact-set validation, invalid/direct writes,
  transaction rollback, stale review data, resubmission history, and immutable
  CoA source-submission binding.
- [ ] 1.3 Add failing focused TypeScript/component tests covering the draft
  watermark, omitted final signature content, visible ranges, manual-only
  assessment choices, disabled `Gửi phê duyệt`, cancellation, and manager
  display of persisted assessments.

## 2. Immutable assessment persistence

- [ ] 2.1 Add a migration defining the two-value manual assessment enum and
  append-only `result_reference_assessments` snapshot table with restrictive
  foreign keys, unique `(submission_id, result_id)` constraint, comments, and
  audit trigger. Add immutable `coa_reports.source_submission_id` with a
  restrictive foreign key, index, database immutability guard, and
  historic-report compatibility.
- [ ] 2.2 Add RLS and grants for the snapshot table: deny direct writes,
  expose an analyst's own submission records, and expose manager records only
  within the existing approval scope; document the security impact and use the
  repository's `DROP POLICY IF EXISTS` pattern.
- [ ] 2.3 Replace the public one-argument
  `submit_sample_for_review(UUID)` RPC with the required JSON assessment
  payload signature, preserving its secure role, ownership, signature,
  completeness, status, submission-number, and supersession checks.
- [ ] 2.4 Implement server-side exact-result-set, enum, and revision-token
  validation; lock and snapshot result/assay display fields from database rows,
  atomically create the signed submission and assessments, then move the sample
  to `review`.
- [ ] 2.5 Update manager approval/completion and CoA queue creation to resolve
  the active signed submission under lock, persist it as
  `coa_reports.source_submission_id`, and preserve that source during failed
  report retries and amendments.
- [ ] 2.6 Apply the migration through Docker and run
  `run_security_tests()` plus the new focused database regressions; verify the
  obsolete RPC signature cannot bypass mandatory assessments and a CoA report
  cannot be rebound to another submission.

## 3. Shared read models and CoA rendering

- [ ] 3.1 Extend result read models, Zod schemas, and client types to include
  configured `normal_range` and the result/assay revision data required for a
  stale-review check.
- [ ] 3.2 Extend the canonical CoA template with a draft mode, reusing its
  document structure, sample/result layout, styles, escaping, grouping, and
  data mapping; add only `BẢN NHÁP - CHƯA GỬI DUYỆT`, omitted final
  certification content, the injectable `Đánh giá` result cell, and review
  footer. Refactor existing helpers into shared presentation primitives where
  interactive controls require it; do not create a copied or parallel draft
  renderer.
- [ ] 3.3 Update manager approval read models and detail UI to display each
  submitted snapshot's `Đánh giá`, value, unit, method, and reference range
  without recalculating the conclusion.
- [ ] 3.4 Update final CoA data resolution to load assessment snapshots and
  reference ranges through each report's immutable `source_submission_id`;
  retain the existing assay-range fallback only for historic reports without a
  source ID.

## 4. Analyst draft-review workflow

- [ ] 4.1 Define and validate the client submission payload containing result
  identifiers, one of the two manual assessments, and reviewed revision tokens;
  route the mutation through `src/lib/api-client.ts`.
- [ ] 4.2 Replace the current minimal analyst confirmation with a responsive,
  Vietnamese draft CoA dialog containing the sample context, full result
  review table, and per-row `Đánh giá` controls.
- [ ] 4.3 Keep assessments in local dialog state until confirmation; ensure
  closing or returning to edit performs no mutation and preserves the sample's
  current status.
- [ ] 4.4 Add the exact confirmation copy and only enable `Gửi phê duyệt`
  after every displayed result has an assessment; submit through the existing
  electronic-signature path with the new payload.
- [ ] 4.5 Handle server rejection for stale, incomplete, or invalid review
  data by preserving a clear Vietnamese error, refreshing current sample data
  where required, and leaving workflow state unchanged.
- [ ] 4.6 Invalidate and refetch analyst and manager queries after successful
  submission so the sample moves to the existing review experience with its
  assessment history available.

## 5. Verification and compliance checks

- [ ] 5.1 Run focused database, CoA-rendering, draft-dialog, client-payload,
  and approval-detail tests; include cancellation, all-assessed enablement,
  no auto-classification, atomic failure, authorization, resubmission, and
  historical CoA fallback cases, plus approved-resubmission source selection
  and failed-CoA-retry source preservation.
- [ ] 5.2 Run `npm run lint` and `npm run typecheck`; inspect all touched files
  for Vietnamese UI copy, strict TypeScript, `api-client` mutation usage, and
  file-size boundaries.
- [ ] 5.3 Run `openspec validate add-result-review-coa-draft --strict` and
  record any follow-up issue required for work intentionally outside this
  change.

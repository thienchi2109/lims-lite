## Why

Analysts can currently move a fully entered sample directly from `in_progress` to
`review` with only a short confirmation. They cannot review the result document,
compare each value with the configured reference range, or record their
professional assessment before the manager receives the submission.

The submission must preserve the analyst's assessment and the exact result and
reference-range context used to make it. This provides a reviewable, auditable
handoff without persisting a draft CoA or changing the existing approval and CoA
release lifecycle.

## What Changes

- Add a Vietnamese, full-document pre-submission review dialog for analysts.
  It renders a draft CoA with sample details, entered results, units, methods,
  and each assay's configured reference range.
- Require analysts to choose an explicit manual assessment for every submitted
  result before the `Gửi phê duyệt` action is enabled. The application does not
  automatically classify values as within or outside reference range.
- Add an append-only assessment snapshot record per result and per sample
  submission. It records the submitted result value, displayed reference range,
  analyst assessment, analyst identity, and timestamp.
- Extend the atomic `submit_sample_for_review` workflow to validate the complete
  assessment payload, create its `sample_submissions` record and assessment
  snapshots, then move the sample to `review`.
- Surface the submitted assessments and snapshots to managers in the approval
  review context. When a submission is approved, CoA generation SHALL persist
  that exact submission as the CoA report's immutable source and use its
  snapshot range rather than mutable current assay configuration.
- Keep draft preview ephemeral: opening, closing, or returning to edit SHALL
  not create a CoA report, upload HTML, calculate a document hash, write audit
  rows, or change sample/result state.

## Capabilities

### New Capabilities

- `result-submission-review`: Analyst pre-submission CoA draft review, mandatory
  manual per-result assessment, immutable submission assessment snapshots, and
  manager review visibility.

### Modified Capabilities

- None.

## Impact

- **Affected code**: analyst assigned-tests workspace, result read model/types,
  client action bridge, submission action/RPC, manager approval detail,
  CoA data helpers/template mapping, query invalidation, and focused tests.
- **Affected database**: a new append-only assessment snapshot table and enum;
  an immutable `coa_reports.source_submission_id` link; an updated
  `submit_sample_for_review` SECURITY DEFINER RPC; RLS, grants, audit trigger
  coverage, and `run_security_tests()` updates.
- **Compliance and audit**: snapshot records bind the analyst's manual judgement
  to the signed submission and preserve historical assessments across
  rejection/rework/re-submission. No hard deletes or mutable draft artifacts.
- **Localization**: all new dialog, assessment, validation, and manager-review
  copy is Vietnamese.

# Why

Analysts can currently move a fully entered sample directly from `in_progress`
to `review` with only a short confirmation. They cannot review the result
document, compare every entered value with its configured reference range, or
record their professional assessment before the manager receives the
submission.

The reviewed assessment and the exact result context must be preserved as
immutable, auditable evidence. The required work crosses the submission,
approval, and CoA-generation lifecycles, so this change remains one product
change but is delivered through ordered, independently verifiable phases.

## What Changes

- Add a four-phase delivery roadmap within this change:
  1. Secure assessment snapshot foundation.
  2. Mandatory analyst draft-review submission workflow.
  3. Manager visibility of submitted assessments.
  4. Immutable final-CoA source-submission provenance.
- Add an append-only assessment snapshot per result and per sample submission.
- Require an explicit manual assessment, `within_reference` or
  `outside_reference`, for every result submitted for review.
- Replace the minimal confirmation with a Vietnamese draft CoA review dialog.
- Surface submitted assessments to managers without recalculating conclusions.
- Bind a final CoA and every retry to the exact approved submission that
  supplied its assessment snapshots.

## Phase Boundaries

### Phase 1: Secure assessment snapshot foundation

Introduce the database enum, append-only snapshot table, RLS, audit coverage,
and a secure versioned submission RPC. The existing UI and one-argument RPC
remain active, so this phase has no user-visible workflow change.

### Phase 2: Mandatory analyst draft review

Add result range and revision read data, the canonical draft CoA mode, and the
analyst review dialog. Switch the client to the assessment-aware RPC and remove
the legacy RPC only after the new path is covered by regression tests.

### Phase 3: Manager assessment review

Expose immutable assessment snapshots in manager approval reads and detail UI.
This phase is read-only from the manager's perspective and does not change CoA
generation or report retry behavior.

### Phase 4: Final CoA provenance

Add `coa_reports.source_submission_id`, persist the approved submission under
lock, and make final CoA rendering, retry, and regeneration use that immutable
source. Historic reports retain their existing assay-range fallback.

## Capabilities

### New Capabilities

- `result-submission-review`: Analysts review an ephemeral draft document,
  record manual per-result assessments, and submit immutable snapshots for
  manager review.
- `coa-report-provenance`: A final CoA is permanently bound to the approved
  submission that supplied its reviewed result context.

### Modified Capabilities

- None.

## Impact

- **Affected code**: analyst assigned-tests workspace, result read model/types,
  client action bridge, submission action/RPC, manager approval detail, CoA
  data helpers/template mapping, approval completion, retry, and focused tests.
- **Affected database**: a new append-only assessment snapshot table and enum;
  a later immutable `coa_reports.source_submission_id` link; secure submission
  RPCs; RLS, grants, audit trigger coverage, and `run_security_tests()` updates.
- **Compliance and audit**: each phase preserves soft-delete-only and audit
  requirements. The final provenance rule is deliberately deferred until its
  approval, queue, retry, and rendering paths can be tested together.
- **Localization**: all new analyst and manager UI copy is Vietnamese.

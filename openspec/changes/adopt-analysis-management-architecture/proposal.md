## Why

The current result-entry and approval flow works, but analysis behavior is still spread across sample status, result status, Server Actions, RPCs, CoA generation, QC checks, and UI-specific assumptions. SENAITE's analysis management architecture shows a useful pattern for CDC-LIMS: treat each analysis/result row as a first-class workflow object with explicit lifecycle, transition guards, template snapshots, and a workbench contract while preserving the existing Supabase/RLS and 21 CFR Part 11 constraints.

## What Changes

- Introduce a first-class analysis/result lifecycle model that maps cleanly to the existing sample lifecycle instead of replacing it.
- Define server-side transition guards for result entry, submission, approval, rejection, retest/rework, publication readiness, and CoA eligibility.
- Snapshot assay/method/template context at test assignment or result creation time so approved historical results remain interpretable after assay configuration changes.
- Provide a shared analysis workbench data contract for analyst result entry, manager approval, sample detail, and CoA generation views.
- Keep SENAITE lessons selective: do not port Plone/Zope content models, catalog mechanics, or legacy widget architecture.
- Preserve Vietnamese UI copy, RLS enforcement, audit logging, soft-delete/void-only behavior, and Docker-backed migration verification.

## Capabilities

### New Capabilities

- `analysis-management-architecture`: Defines the lifecycle, guard, template snapshot, and workbench contract for analysis/result management.

### Modified Capabilities

- `assay-management`: Align assigned test behavior with template snapshot requirements from analysis management while keeping assay/method management independently deployable.
- `sample-management`: Clarify how sample status, approval, CoA generation, rejection, and result-level analysis lifecycle interact without collapsing them into one state machine.

## Impact

- **Database:** likely adds result/analysis lifecycle metadata, template snapshot columns or companion tables, guard helper functions/RPC checks, and audit coverage. Any migration must document security impact, preserve RLS, avoid hard deletes, and run `run_security_tests()`.
- **Backend:** affects `src/app/actions/results.ts`, `src/app/actions/results-approval.ts`, `src/app/actions/sample-approvals.ts`, result validation, CoA helpers, and existing RPCs such as `submit_sample_for_review`.
- **Frontend:** affects analyst result entry, manager approval queue, sample detail panels, result status badges, CoA status/actions, and Vietnamese status/action labels.
- **Specs/roadmap:** intersects with `add-assay-method-m2m`, `add-coa-generation-and-access`, `add-westgard-qc`, and `optimize-approval-queue-two-phase`; this change should provide the domain contract those changes can reuse rather than absorbing their full scope.
- **Testing:** requires SQL regression tests for transitions/guards/RLS/audit behavior plus focused TypeScript/React tests for workbench state, allowed actions, and cache invalidation.

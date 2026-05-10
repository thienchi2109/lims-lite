## Context

CDC-LIMS currently models laboratory progress mainly through sample status and result status:

- Sample status tracks the broad workflow (`received`, `assigned`, `in_progress`, `review`, `discarded`, `completed`).
- Result status tracks a narrower state (`pending`, `entered`, `approved`).
- Submission, approval, rejection, CoA generation, QC blocking, e-signature linkage, and result validation live across Server Actions, SQL RPCs, hooks, and UI components.

SENAITE.CORE's analysis management architecture is useful as a reference because it treats each analysis as a first-class object with fields for service/method identity, result value, result capture date, uncertainty, detection limits, analyst/instrument/attachments, result ranges, workflow guards, and a tabular workbench. The selective lesson for CDC-LIMS is the domain separation, not the Plone/Zope implementation.

Relevant local surfaces:

- `samples`, `results`, `assay_definitions`, `methods`, pending `assay_methods`
- `submit_sample_for_review`, approval/rejection actions, CoA helpers, QC approval checks
- analyst result-entry page, manager approval queue, sample detail panel, result status badges

## Goals / Non-Goals

**Goals:**

- Introduce an explicit analysis/result lifecycle that can be reasoned about independently from sample status.
- Centralize transition eligibility in server-side guards that are shared by RPCs/actions and visible to UI workbench payloads.
- Snapshot assay/method/template context for assigned analyses so old approved results remain interpretable even after assay configuration changes.
- Provide one workbench payload contract for result entry, approval, sample detail, and CoA generation.
- Preserve 21 CFR Part 11 auditability, RLS enforcement, Vietnamese UI copy, and soft-delete/void-only behavior.

**Non-Goals:**

- Do not port SENAITE's Plone content model, Zope workflow engine, catalog system, Archetypes/Dexterity migration patterns, or legacy widget stack.
- Do not merge the full scope of `add-assay-method-m2m`, `add-coa-generation-and-access`, `add-westgard-qc`, or `optimize-approval-queue-two-phase` into this change.
- Do not replace the existing sample lifecycle. This change maps analysis lifecycle to sample lifecycle.
- Do not introduce hard deletes or unaudited direct table writes.

## Decisions

### Decision 1: Treat `results` rows as the initial analysis entity

Use the existing `results` table as the first implementation target for the analysis object instead of creating a large new `analyses` table immediately.

Rationale:

- `results` already ties sample, assay, method, value, approval metadata, and status together.
- A companion table can be added later if snapshots or lifecycle history outgrow direct columns.
- This keeps the first batch deployable and avoids duplicating existing result IDs across the UI.

Alternatives considered:

- **New `analyses` table first:** cleaner domain naming, but higher migration risk and more refactor surface.
- **Sample-only workflow:** simpler, but continues hiding result-level lifecycle and guard behavior.

### Decision 2: Keep sample lifecycle and analysis lifecycle separate

Sample status remains the aggregate workflow. Analysis lifecycle describes each test row.

Proposed initial lifecycle:

```text
pending -> entered -> submitted -> approved
             |           |
             v           v
          voided      rejected -> entered
```

Mapping examples:

- `sample.status = in_progress` can contain `pending` and `entered` analyses.
- `sample.status = review` requires all active analyses to be `submitted`.
- `sample.status = completed` requires all active reportable analyses to be `approved` and CoA checks to pass or be explicitly handled.

Rationale:

- This matches current CDC-LIMS behavior while making per-result rules explicit.
- It leaves room for future retest/rework/retraction without forcing them into sample status.

Alternatives considered:

- **Use SENAITE's full states (`registered`, `unassigned`, `assigned`, `to_be_verified`, `verified`, `published`, `retracted`):** too broad for the current product and not aligned with existing status names.
- **Keep only `pending/entered/approved`:** insufficient for submission, rejection, CoA gating, and audit review.

### Decision 3: Centralize guard evaluation server-side

Create reusable guard functions or RPC-backed checks for transitions:

- `can_enter_result`
- `can_submit_analysis`
- `can_submit_sample_for_review`
- `can_approve_analysis`
- `can_reject_analysis`
- `can_reopen_rejected_analysis`
- `can_generate_coa`

Guards return a machine-readable result:

```ts
type GuardResult = {
  allowed: boolean
  code: string
  messageKey: string
  facts: Record<string, unknown>
}
```

Rationale:

- UI can show allowed actions without re-implementing security logic.
- Server Actions and SQL still enforce the actual transition.
- Tests can target a stable policy surface.

Alternatives considered:

- **Frontend-only permissions:** not acceptable for RLS/compliance.
- **Only database exceptions:** secure but poor UX and hard to test across workflows.

### Decision 4: Snapshot assigned analysis template context

When tests are assigned or result rows are created, persist enough context to interpret that analysis later:

- assay name/code at assignment time
- method name/code at assignment time
- unit
- reference range/result range
- detection limit settings when applicable
- required attachment/QC flags when applicable
- source assay/method IDs for traceability

Rationale:

- Historical approved reports must remain meaningful after assay/method configuration changes.
- This aligns with the SENAITE pattern of deriving analyses from service templates while avoiding dynamic dependence on mutable templates.

Alternatives considered:

- **Always join current assay/method config:** simpler, but can corrupt historical meaning.
- **Version every assay definition first:** stronger, but too large for the initial batch.

### Decision 5: Define a shared analysis workbench payload

Result entry, approval queue, sample detail, and CoA helpers should consume a shared shape:

```ts
type AnalysisWorkbenchRow = {
  resultId: string
  sampleId: string
  lifecycle: string
  display: {
    assayName: string
    methodName: string | null
    unit: string | null
    resultValue: string | null
    flags: string[]
  }
  guards: Record<string, GuardResult>
  auditSummary: {
    enteredBy: string | null
    enteredAt: string | null
    submittedBy: string | null
    submittedAt: string | null
    approvedBy: string | null
    approvedAt: string | null
  }
}
```

Rationale:

- The UI can render one consistent action/status model.
- CoA generation can depend on the same approved interpretation as the approval page.
- Future QC and Westgard checks can attach flags to the same row contract.

Alternatives considered:

- **Separate payloads per page:** minimal immediate work, but repeats permission/status bugs.
- **Large client-side view model only:** easier UI refactor but weakens server-side guarantees.

## Risks / Trade-offs

- **Migration drift between local SQL and live Docker DB** -> Keep migrations forward-only, verify policy state, and run `run_security_tests()` after apply.
- **Scope expansion into QC, CoA, and assay-method features** -> Keep this change as the contract layer; implement dependent features in separate PR-sized batches.
- **State-name confusion for users** -> Use Vietnamese labels in UI and keep internal lifecycle names stable; document mapping between sample and analysis states.
- **Snapshot duplication increases storage** -> Store only interpretation-critical fields; keep source IDs for traceability.
- **Guard divergence between SQL and TypeScript** -> Prefer one authoritative backend guard implementation and expose guard facts to the UI.

## Migration Plan

1. Inventory current result, sample, approval, CoA, QC, and assay-method fields against the proposed lifecycle and snapshot model.
2. Add SQL regression tests first for lifecycle transitions, guard denial cases, RLS boundaries, audit records, and no-hard-delete behavior.
3. Add the minimal migration for analysis lifecycle metadata and template snapshot fields or companion table.
4. Introduce backend guard helpers/RPCs and route existing Server Actions through them.
5. Expose the shared workbench payload from existing read paths without changing page layout.
6. Update analyst and manager UI labels/actions to consume guard facts.
7. Reconcile CoA generation eligibility with the approved analysis rows.
8. Run database security tests, focused action/hook/component tests, `npm run typecheck`, and relevant app smoke checks.

Rollback strategy:

- Keep migrations additive in the first batch where possible.
- Gate new UI behavior behind the workbench payload while preserving existing action paths until parity tests pass.
- If rollout fails, disable use of new guard facts in UI while leaving audit-safe data columns in place for a forward fix.

## Open Questions

- Should `submitted` be stored per result row, per sample submission record, or both?
- Should rejected analyses preserve a separate immutable rejection event table, or is audit log plus result metadata sufficient?
- Which snapshot fields are required for the first batch: unit/range/method only, or detection limits and QC flags as well?
- Does CoA generation require all analyses to be `approved`, or should some analysis types be non-reportable?
- Should retest/rework be included in the first implementation batch or reserved for a follow-up change?

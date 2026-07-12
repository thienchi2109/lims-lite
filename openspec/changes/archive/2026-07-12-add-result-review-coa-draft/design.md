## Context

The current analyst submission action calls the one-argument
`submit_sample_for_review(UUID)` RPC after a minimal confirmation. The current
CoA flow resolves a submission and mutable assay data while generating or
regenerating a report. Adding analyst assessment snapshots is therefore not
only a dialog change: it crosses secure write boundaries, review reads, and
legal-document provenance.

This design keeps one OpenSpec change and one end-state specification. It
separates implementation into four deployable phases so a migration, UI
replacement, manager read model, and CoA retry behavior are never changed in
the same batch without a focused reason and test boundary.

## Goals / Non-Goals

**Goals:**

- Require one explicit manual assessment for every submitted result.
- Preserve analyst assessment and displayed result context as immutable,
  auditable snapshots.
- Use the canonical CoA template for the ephemeral analyst draft.
- Make the submission path fail closed for stale, incomplete, or tampered
  assessment payloads.
- Let managers inspect submitted assessments before approval.
- Bind each new final CoA to the exact approved submission that supplied its
  assessment snapshots.

**Non-Goals:**

- The application does not infer or calculate whether a result is inside or
  outside its reference range.
- The draft is not a persisted CoA lifecycle state and does not create a
  `coa_reports` row, stored document, document hash, or audit event.
- This change does not alter manager approval, rejection, or electronic
  signature semantics.
- This change does not add assessment notes, a third assessment state,
  automatic validation, or reference-range configuration UI.
- Historic CoA reports are not rewritten.

## Phase Design

### Phase 1: Secure assessment snapshot foundation

Create the two-value assessment enum and append-only
`result_reference_assessments` table. Each row links a signed
`sample_submissions` record to one `results` record and stores:

- the manual assessment;
- assay name, result value, unit, method, and displayed reference range;
- analyst identity and assessment timestamp.

The table has restrictive foreign keys, a unique `(submission_id, result_id)`
constraint, an audit trigger, comments, RLS, and explicit grants. Direct client
writes are denied. Analyst and manager reads remain constrained by the current
ownership and approval scopes.

Phase 1 introduces
`submit_sample_for_review_with_assessments(UUID, JSONB)`. It re-runs the
existing role, ownership, signature, status, completeness, numbering, and
supersession checks; locks the sample results and assay definitions; validates
the exact assessment set and revision tokens; creates the signed submission and
snapshots atomically; then transitions the sample to `review`.

The existing `submit_sample_for_review(UUID)` RPC remains callable in this
phase. No application caller is moved yet, so production behavior remains
unchanged while the new secure contract is verified.

### Phase 2: Mandatory analyst draft review

Extend the result read model, Zod schemas, and client types with the configured
`normal_range` and revision data needed to detect a stale review. Extend the
canonical CoA template with a draft mode rather than copying document markup,
styles, escaping, grouping, or data mapping.

The draft dialog shows sample context and every entered result with value, unit,
method, and configured range. It visibly states
`BẢN NHÁP - CHƯA GỬI DUYỆT`, omits signatures and approval information, and
adds a required `Đánh giá` `RadioGroup` with the two manual choices. Assessment
state remains local until confirmation. Closing the dialog or returning to
editing performs no mutation.

After all result rows are assessed, the client submits the reviewed identifiers,
assessment values, and revision tokens through `src/lib/api-client.ts` to the
Phase 1 RPC. After the new path is deployed and covered by focused regressions,
remove or revoke the legacy one-argument RPC so it cannot bypass the mandatory
assessment rule.

### Phase 3: Manager assessment review

Extend manager approval read models and detail UI to display the immutable
snapshot assessment, value, unit, method, and reference range for the active
submission. The manager UI presents the analyst's recorded conclusion; it does
not derive or recalculate it from the result value.

This phase only consumes stored snapshots. Approval completion, report queue
creation, CoA generation, retries, and regeneration retain their prior source
selection behavior until Phase 4.

### Phase 4: Final CoA provenance

Add nullable `coa_reports.source_submission_id` with a restrictive foreign
key, index, comments, and a database immutability guard. New report creation
resolves the approved active submission under lock and stores that ID. CoA
generation, retry, and regeneration load assessment snapshots and reference
ranges only through the stored source ID.

Historic reports without a source ID retain the existing assay-range fallback.
A retry or regeneration must not select a later submission by timestamp.

## Cross-Phase Rules

- The browser declares assessment identifiers, values, and revision tokens; it
  never supplies trusted display values for snapshots.
- The server constructs snapshot values, units, methods, and ranges from locked
  database rows.
- Each database migration follows the repository's `SECURITY DEFINER`,
  `search_path`, `DROP POLICY IF EXISTS`, revoke/grant, and security-impact
  documentation patterns.
- Each migration is applied through Docker and followed immediately by
  `run_security_tests()`.
- Every phase starts with focused failing regression tests for its contract.

## Risks / Trade-offs

- **Draft diverges from the final template**: Phase 2 extends one canonical
  renderer and adds rendering tests for both modes.
- **A result or range changes while a dialog is open**: Phase 2 sends revision
  tokens and the Phase 1 RPC rejects stale data atomically.
- **Legacy callers bypass assessment**: Phase 1 introduces the new contract;
  Phase 2 moves the only client bridge and removes the legacy signature.
- **Manager and CoA work obscure each other**: Phase 3 is read-only, while
  Phase 4 alone owns report-source selection, queue behavior, retry, and
  regeneration.
- **Historic reports lack snapshots**: Phase 4 uses a compatibility fallback
  without rewriting records.

## Migration and Rollback Plan

1. **Phase 1**: add the enum, snapshot table, policies, audit trigger, and
   versioned secure RPC. Rollback can leave the append-only schema unused.
2. **Phase 2**: deploy the draft dialog and assessment-aware client path, then
   remove the legacy RPC only after verification. Rollback restores the legacy
   RPC policy before reverting the client.
3. **Phase 3**: deploy manager reads and UI. Rollback removes only the new
   reads; snapshots remain authoritative records.
4. **Phase 4**: add and populate `source_submission_id` for new reports, then
   resolve final CoA data through it. Rollback must retain the source link and
   audit history; application reads may temporarily use the historic fallback.

## Open Questions

- Confirm the stable revision-token source for result values and assay
  configuration before Phase 1 implementation.
- Confirm whether the existing client action route needs an explicit
  compatibility error while Phase 2 removes the legacy RPC.

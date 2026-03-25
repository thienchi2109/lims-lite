## Context

CDC-LIMS currently relies on role-based access plus broad authenticated reads for several operational tables. The HIV confidentiality research in `docs/plans/2026-03-24-hiv-confidentiality-internal-research.md` showed that this leaves multiple leakage paths:

- `results` access is not scoped to explicitly authorized HIV staff.
- Sample detail and client responses can expose PII that implies HIV status even when result values are hidden.
- Search and CoA routes can bypass the intent of the data model if they do not reuse the same confidentiality rule.
- Research and epidemiology access needs de-identified output plus purpose-specific authorization, not a reuse of operational permissions.

This change is cross-cutting: it affects schema, RLS, application guards, search behavior, CoA flows, and verification. It also needs a rollout order that avoids locking out authorized staff.

## Goals / Non-Goals

**Goals:**

- Add an explicit assay-level confidentiality marker that downstream policies can evaluate consistently.
- Separate operational confidential-data access from anonymized HIV export authorization.
- Make `results` RLS the authoritative gate for confidential HIV data.
- Redact or omit sensitive PII in sample-related responses when the caller lacks confidential authorization.
- Apply the same confidentiality rule set to search and CoA surfaces.
- Keep a compliant anonymized export path with auditable execution.
- Define a safe rollout order and verification plan.

**Non-Goals:**

- Replacing the existing `analyst` and `manager` role model with a new permission system.
- Building a patient-facing step-up verification flow for confidential CoAs in this change.
- Allowing direct research queries against operational HIV tables.
- Solving every future confidential-data category beyond the HIV-sensitive controls defined here.

## Decisions

### 1. Model confidentiality at the assay-definition level

Use `assay_definitions.is_confidential` as the source of truth for whether a result or related sample context is HIV-sensitive.

This matches the internal research and keeps the rule attached to the thing that makes the data sensitive. It also lets mixed samples inherit confidentiality from their assigned assays without adding sample-specific data-entry burden.

Alternative considered:

- Sample-level confidentiality flag: rejected because it is easier to misclassify mixed-workflow samples and duplicates logic already implied by assigned assays.

### 2. Use two explicit user authorizations instead of one

Add both `users.can_access_confidential` and `users.can_export_hiv_anonymized`, with helper functions for each.

Operational access and research export serve different purposes. A single flag would let staff who need to work with HIV results automatically export de-identified datasets, which weakens least privilege and makes future audit reasoning harder.

Alternative considered:

- Single `can_access_confidential` flag for all paths: rejected because it conflates operational care workflow with secondary-use export.
- Grant table only: deferred. A full grant-history model is useful later, but the two-flag MVP fits the current user table and is faster to roll out.

### 3. Keep RLS authoritative and use app-layer projections for safe responses

`results` RLS remains the hard gate for confidential reads and writes. For sample detail, client data, and search outputs, the application should return safe projections that redact sensitive fields when the caller lacks confidential authorization.

This keeps the highest-risk data protected in the database while still allowing workflow-safe sample access without exposing identifying information.

Alternative considered:

- UI-only hiding: rejected because it does not protect APIs or RPCs.
- RLS-only redaction on every table: rejected for MVP because it would require broader schema and query rewrites than a targeted projection approach.

### 4. Deny confidential CoAs in the public portal for MVP

Confidential HIV-related CoAs will be excluded from `/coa/access` and from public preview or download routes. Internal staff preview remains available only to staff with `can_access_confidential = true`.

The existing public CoA flow is based on phone-oriented verification and admin-bypass routes. Hardening that into an HIV-appropriate client-authentication flow is a separate security project. For this change, the safer MVP is to remove confidential HIV CoAs from the public surface instead of inventing a partial step-up flow.

Alternative considered:

- Keep public access with stronger verification in the same change: rejected because it expands scope into identity-proofing and increases rollout risk.

### 5. Build anonymized export as a dedicated path, not a filtered reuse of operational queries

The export should be a dedicated view or RPC that emits only the approved de-identified dataset, backed by explicit authorization and audit logging.

This preserves separation of purpose and reduces the risk that future operational schema changes accidentally leak identifiers into research output.

Alternative considered:

- Let authorized users export directly from operational tables: rejected because it makes de-identification optional instead of guaranteed.

### 6. Extend verification at both database and application layers

`run_security_tests()` should validate the new columns, helper functions, and confidential RLS behavior. Integration tests should cover sample-detail redaction, confidentiality-safe search responses, CoA restrictions, and anonymized export authorization.

This change touches multiple access paths, so schema verification alone is not enough.

## Risks / Trade-offs

- [Operational lockout] -> Grant `can_access_confidential` before backfilling or enabling confidential assays in production, and include that order in the rollout runbook.
- [Export workflow disruption] -> Grant `can_export_hiv_anonymized` explicitly for research users before enabling the new export path.
- [RLS performance overhead] -> Add supporting indexes for confidential predicates and confirm query plans in staging after migration.
- [Public CoA behavior change] -> Communicate that confidential HIV CoAs are staff-only in MVP and track stronger public verification as follow-up work.
- [Projection drift] -> Keep redaction logic centralized so sample detail and search surfaces do not diverge in what they hide.

## Migration Plan

1. Add schema fields and helper functions for confidential access and anonymized export authorization.
2. Update `results` RLS policies and extend `run_security_tests()` for confidential scenarios.
3. Backfill existing HIV assay definitions to `is_confidential = true`.
4. Update TypeScript types and server actions to read and write the new flags safely.
5. Apply confidentiality-safe sample detail, search, and CoA behavior.
6. Add the anonymized export path and its audit trail.
7. Validate staging rollout using the order above, then promote to production.

Rollback strategy:

- Remove confidential assay backfills before relaxing policies if emergency rollback is needed.
- Recreate previous `results` policies after dropping new confidentiality predicates.
- Disable the export path before removing its authorization flag and helper function.
- Preserve audit evidence; do not hard-delete any log data during rollback.

## Open Questions

- Should the follow-up public verification flow for confidential CoAs use OTP, DOB plus phone, national ID fragment, or a different identity proofing step?
- Does the organization need grant-history evidence (`confidential_access_grants`) in MVP, or is a boolean-plus-audit-trail rollout sufficient for the first release?

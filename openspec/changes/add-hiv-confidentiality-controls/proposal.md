## Why

CDC-LIMS currently enforces access mostly by role (`analyst`, `manager`) and authentication status. For HIV-related data, that is not sufficient because:

- `results` visibility is still broad enough to expose confidential assay rows to authenticated staff who were never explicitly authorized for HIV data.
- `samples` and `clients` access paths can expose PII that allows HIV status inference even when a user does not need the underlying result values.
- Search and CoA surfaces can amplify leakage if they do not apply the same confidentiality rule set as the core database policies.
- Research and epidemiology use cases require anonymized output with purpose-specific authorization rather than direct reuse of operational access.

The internal research and implementation plan in `docs/plans/2026-03-24-hiv-confidentiality-internal-research.md` and `docs/plans/2026-03-24-hiv-confidentiality-implementation-plan.md` establish a DB-first confidentiality model and identify public CoA and anonymized export as separate high-risk paths that need explicit handling.

## What Changes

- **NEW CAPABILITY:** HIV confidentiality controls for sensitive assay workflows:
  - Introduce assay-level confidentiality classification (`assay_definitions.is_confidential`).
  - Introduce explicit operational authorization for confidential data (`users.can_access_confidential`).
  - Introduce separate authorization for anonymized HIV export (`users.can_export_hiv_anonymized`).
  - Add helper policy functions for both authorization checks.

- **RLS and data-access hardening:**
  - Restrict `results` SELECT/INSERT/UPDATE for confidential assays to explicitly authorized personnel only.
  - Make sample-detail and client-facing operational responses confidentiality-aware so unauthorized users receive redacted or omitted sensitive fields.
  - Keep enforcement DB-first; app-layer checks exist for defense in depth and user-safe responses, not as the primary gate.

- **Workflow and surface consistency:**
  - Preserve analyst workflow for authorized staff working on confidential HIV samples.
  - Require confidential authorization for manager approval of confidential results.
  - Make search functions confidentiality-aware so they do not reveal restricted data through result snippets, counts, or client matches.
  - Restrict staff CoA access for confidential samples to staff with confidential authorization.
  - Exclude confidential HIV CoAs from the public `/coa/access` flow in MVP until a stronger client verification mechanism exists.

- **Research and epidemiology compliance path:**
  - Add a dedicated anonymized export path instead of permitting direct operational-table export.
  - Require purpose-specific export authorization, separate from operational confidential access.
  - Apply pseudonymization, generalization, suppression, and audit logging to reduce re-identification risk.

- **Verification uplift:**
  - Extend `run_security_tests()` with confidentiality-specific schema and RLS assertions.
  - Add negative and positive integration coverage for confidential results, redacted sample detail, search behavior, CoA access, and anonymized export.

## Impact

### Affected specs

- **NEW:** `specs/confidential-data-access/spec.md`
- **MODIFIED:** `specs/assay-management/spec.md`
- **MODIFIED:** `specs/sample-management/spec.md`
- **MODIFIED:** `specs/search-capability/spec.md`
- **MODIFIED:** `specs/coa-preview/spec.md`

### Affected code (expected)

- `supabase/migrations/` for new confidentiality columns, helper functions, export authorization, RLS updates, and security verification tests
- `src/types/core.ts`, `src/types/lab.ts` for confidentiality and export flags
- `src/app/actions/assay-mutations.ts`, `src/app/actions/users.ts`, `src/app/actions/results-approval.ts`
- `src/app/actions/samples.ts`, `src/app/api/samples/[id]/route.ts` for confidentiality-safe sample detail responses
- `supabase/migrations/075_create_search_functions.sql` and related search actions for confidentiality-safe search behavior
- `src/app/api/coa/authenticate/route.ts`, `src/app/api/coa/download/route.ts`, `src/app/api/coa/view/route.ts` for confidential CoA restrictions
- export RPC or route handlers plus audit logging for anonymized HIV data access

### Behavior changes

- Unauthorized staff will no longer see or mutate confidential HIV results.
- Unauthorized staff will receive redacted or omitted client PII in confidential sample contexts.
- Managers will need explicit confidential authorization to approve confidential results.
- Staff without confidential authorization will be blocked from confidential CoA preview or download flows.
- The public CoA portal will not expose confidential HIV CoAs in this MVP.
- Anonymized HIV export will require a separate authorization from operational confidential access.

### Migration and rollout

1. Add confidentiality and export-authorization schema fields plus helper functions.
2. Grant the required user flags before enabling confidentiality on production assays.
3. Update `results` RLS and verification tests.
4. Backfill HIV assay definitions to `is_confidential = true`.
5. Update app-layer sample, search, approval, and CoA handling to match the DB rules.
6. Add the anonymized export path and audit trail.
7. Run confidentiality regression and security checks before rollout.

### Risks

- Operational lockout if confidential assays are enabled before the correct users receive confidential access.
- Research teams could be blocked if export authorization is not provisioned separately from operational access.
- Additional RLS predicates may affect query latency if supporting indexes are missing.
- Existing public CoA expectations will change for confidential HIV samples until a stronger verification flow is introduced.
- Admin-bypass endpoints remain a leakage risk unless every path applies the same confidential checks.

### Non-goals

- Replacing the existing role model (`analyst`/`manager`) with a full RBAC or ABAC redesign.
- Introducing public step-up verification for confidential HIV CoAs in this change.
- Allowing direct research access to operational HIV tables.
- Introducing hard deletes for confidential records.

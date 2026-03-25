## Why

CDC-LIMS currently enforces access mostly by role (`analyst`, `manager`) and authentication status. For HIV-related data, this is insufficient because:

- `results` visibility is effectively broad to authenticated users.
- `samples`/`clients` reads can expose personally identifiable information (PII) that enables HIV status inference.
- Search and CoA access paths can amplify leakage if they do not enforce confidential-data authorization consistently.
- There is no dedicated anonymized export flow for epidemiology/research use cases.

Based on the completed internal research and implementation plan in `docs/plans/2026-03-24-hiv-confidentiality-internal-research.md` and `docs/plans/2026-03-24-hiv-confidentiality-implementation-plan.md`, the system needs a dedicated confidentiality capability for HIV-sensitive assays and related records.

## What Changes

- **NEW CAPABILITY:** Confidential data access control for HIV-sensitive workflows:
  - Introduce assay-level confidentiality classification (`assay_definitions.is_confidential`).
  - Introduce user authorization flag for confidential data (`users.can_access_confidential`).
  - Add helper policy function `user_can_access_confidential()`.

- **RLS and data-access hardening:**
  - Restrict `results` SELECT/INSERT/UPDATE for confidential assays to authorized personnel only.
  - Ensure sample-detail/client data responses are confidentiality-aware and redact sensitive fields for unauthorized users.
  - Keep enforcement at DB/RLS layer first; UI permissions remain secondary guidance.

- **Workflow and surface consistency:**
  - Preserve analyst workflow for authorized staff (view/enter/submit review on HIV samples).
  - Enforce confidential authorization on manager approval path for confidential results.
  - Make search functions confidentiality-aware so they do not reveal restricted data.
  - Harden CoA access for confidential samples (authorization checks and scoped access).

- **Research/epidemiology compliance path:**
  - Add dedicated anonymized export mechanism (no direct operational table export).
  - Apply pseudonymization/generalization and suppression constraints to reduce re-identification risk.

- **Verification uplift:**
  - Extend security verification tests (`run_security_tests`) with confidentiality-specific assertions and negative/positive access cases.

## Impact

### Affected specs

- **NEW:** `specs/confidential-data-access/spec.md`
- **MODIFIED:** `specs/assay-management/spec.md`
- **MODIFIED:** `specs/sample-management/spec.md`
- **MODIFIED:** `specs/search-capability/spec.md`

### Affected code (expected)

- `supabase/migrations/` (new confidentiality schema + RLS + security tests)
- `src/types/core.ts`, `src/types/lab.ts` (new confidential flags)
- `src/app/actions/assay-mutations.ts`, `src/app/actions/users.ts`, `src/app/actions/results-approval.ts`
- `src/app/actions/samples.ts`, `src/app/api/samples/[id]/route.ts` (PII redaction path)
- `supabase/migrations/075_create_search_functions.sql` and related search actions (confidential-aware search behavior)
- `src/app/api/coa/authenticate/route.ts`, `src/app/api/coa/download/route.ts`, `src/app/api/coa/view/route.ts`

### Behavior changes

- Unauthorized staff will no longer see confidential HIV results.
- Unauthorized staff will receive redacted/limited sensitive client fields in confidential contexts.
- Authorized analysts can continue HIV workflows (enter results, submit for review); managers still perform final approval.
- Research/epidemiology export must use anonymized pipeline instead of direct operational data access.

### Migration and rollout

1. Add schema flags and helper function.
2. Update RLS for confidential enforcement.
3. Backfill HIV assay classification.
4. Update app/action/search/CoA enforcement layers.
5. Add anonymized export path.
6. Run confidentiality regression/security checks before rollout.

### Risks

- Operational lockout if confidentiality flags are enabled before user authorization is granted.
- Performance impact from additional RLS predicates if indexes are not aligned.
- Data leakage risk remains if any admin-bypass endpoint misses confidential checks.

### Non-goals

- Replacing existing role model (`analyst`/`manager`) with a new RBAC system.
- Introducing hard delete patterns for confidential records.
- Building external legal citation system in this change.


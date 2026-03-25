## Why

CDC-LIMS currently enforces access mostly by role (`analyst`, `manager`) and authentication status. For HIV-related data, that is not sufficient because:

- `results` visibility is still broad enough to expose confidential assay rows to authenticated staff who were never explicitly authorized for HIV data.
- `samples`, `clients`, and exact-identifier lookup paths can confirm that a confidential HIV sample exists even when the caller does not need that workflow.
- Search and CoA surfaces can amplify leakage if they do not apply the same confidentiality rule set as the core database policies.
- The highest-risk paths in the current system are operational access to confidential HIV data, existence leakage through sample-facing workflows, and bypasses through search or CoA surfaces.

The internal research and implementation plan in `docs/plans/2026-03-24-hiv-confidentiality-internal-research.md` and `docs/plans/2026-03-24-hiv-confidentiality-implementation-plan.md` establish a DB-first confidentiality model and identify public CoA plus broad authenticated data access as the highest-priority gaps to close first.

## What Changes

- **NEW CAPABILITY:** HIV confidentiality controls for sensitive assay workflows:
  - Introduce assay-level confidentiality classification (`assay_definitions.is_confidential`).
  - Introduce explicit operational authorization for confidential data (`users.can_access_confidential`).
  - Add helper policy function `user_can_access_confidential()`.

- **RLS and data-access hardening:**
  - Restrict `results` SELECT/INSERT/UPDATE for confidential assays to explicitly authorized personnel only.
  - Make sample-detail, sample-list, and related lookup responses confidentiality-aware so unauthorized users cannot discover or confirm confidential-associated sample existence.
  - Keep enforcement DB-first; app-layer checks exist for defense in depth and user-safe responses, not as the primary gate.

- **Workflow and surface consistency:**
  - Preserve analyst workflow for authorized staff working on confidential HIV samples.
  - Require confidential authorization for manager approval of confidential results.
  - Make search functions confidentiality-aware so they do not reveal restricted data through result snippets, counts, client matches, sample identifiers, or exact-identifier lookups.
  - Restrict staff CoA access for confidential samples to staff with confidential authorization.
  - Exclude confidential HIV CoAs from the public `/coa/access` flow in MVP until a stronger client verification mechanism exists.

- **Verification uplift:**
  - Extend `run_security_tests()` with confidentiality-specific schema and RLS assertions.
  - Add negative and positive integration coverage for confidential results, confidential sample non-discoverability, search behavior, and CoA access.

## Impact

### Affected specs

- **NEW:** `specs/confidential-data-access/spec.md`
- **MODIFIED:** `specs/assay-management/spec.md`
- **MODIFIED:** `specs/sample-management/spec.md`
- **MODIFIED:** `specs/search-capability/spec.md`
- **MODIFIED:** `specs/coa-preview/spec.md`

### Affected code (expected)

- `supabase/migrations/` for new confidentiality columns, helper functions, RLS updates, and security verification tests
- `src/types/core.ts`, `src/types/lab.ts` for confidentiality flags
- `src/app/actions/assay-mutations.ts`, `src/app/actions/users.ts`, `src/app/actions/results-approval.ts`
- `src/app/actions/samples.ts`, `src/app/api/samples/[id]/route.ts` for confidentiality-safe sample detail responses
- `supabase/migrations/075_create_search_functions.sql` and related search actions for confidentiality-safe search behavior
- `src/app/api/coa/authenticate/route.ts`, `src/app/api/coa/download/route.ts`, `src/app/api/coa/view/route.ts` for confidential CoA restrictions

### Behavior changes

- Unauthorized staff will no longer see or mutate confidential HIV results.
- Unauthorized staff will not be able to discover or confirm confidential-associated samples through sample lists, detail routes, exact lookups, search, or CoA paths.
- Managers will need explicit confidential authorization to approve confidential results.
- Staff without confidential authorization will be blocked from confidential CoA preview or download flows.
- The public CoA portal will not expose confidential HIV CoAs in this MVP.

### Migration and rollout

1. Add confidentiality schema fields plus helper function.
2. Grant confidential access before enabling confidentiality on production assays.
3. Update `results` RLS and verification tests.
4. Backfill HIV assay definitions to `is_confidential = true`.
5. Update app-layer sample, search, approval, and CoA handling to match the DB rules.
6. Run confidentiality regression and security checks before rollout.

### Operational note: SSH access to self-hosted Supabase Studio

For direct table edits on the current VPS-hosted Supabase stack, use SSH port forwarding instead of expecting `localhost:3002` on the local workstation to resolve to the VPS automatically.

```bash
ssh -L 3002:localhost:3002 root@43.228.215.111
```

After the tunnel is established, open:

- `http://localhost:3002/project/default`

This forwards the local browser request on port `3002` to the VPS-hosted `lims-studio` container bound on the same port.

### Risks

- Operational lockout if confidential assays are enabled before the correct users receive confidential access.
- Additional RLS predicates may affect query latency if supporting indexes are missing.
- Existing public CoA expectations will change for confidential HIV samples until a stronger verification flow is introduced.
- Admin-bypass endpoints remain a leakage risk unless every path applies the same confidential checks.
- Mixed-workflow samples become fully hidden from unauthorized staff as soon as any assigned assay is confidential.

### Non-goals

- Replacing the existing role model (`analyst`/`manager`) with a full RBAC or ABAC redesign.
- Introducing public step-up verification for confidential HIV CoAs in this change.
- Building anonymized HIV export in this change.
- Allowing direct research access to operational HIV tables.
- Preventing out-of-band disclosure by clients or third parties outside the system boundary.
- Introducing hard deletes for confidential records.

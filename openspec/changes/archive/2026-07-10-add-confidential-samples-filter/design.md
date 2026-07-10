## Context

The unified Samples workspace already has URL-driven filters for scope, status, rejected-only, dates, receiver, specialty, sorting, and pagination. `SamplesPageClient` parses those URL params, passes them through `useSamples`, and ultimately calls `fetchSamples` and the `get_samples_page` RPC.

The live Docker database currently has:

- `get_samples_page(p_search, p_scope, p_status, p_rejected_only, p_from_date, p_to_date, p_receiver_id, p_specialty_ids, p_sort_by, p_sort_order, p_page, p_page_size)`.
- `sample_has_confidential_results(uuid)` as a `STABLE SECURITY DEFINER` helper that detects samples with at least one result linked to `assay_definitions.is_confidential = TRUE`.
- `user_can_access_confidential()` as a `STABLE SECURITY DEFINER` helper based on `auth.uid()` and `users.can_access_confidential = TRUE`.
- A current Samples RPC guard that conceals confidential-associated samples from unauthorized users:
  `user_can_access_confidential() OR NOT sample_has_confidential_results(s.id)`.

The server dashboard session already resolves `canAccessConfidential`, so the page can pass that value down to the client without adding another user query. The UI must remain Vietnamese and the database must be inspected, migrated, and verified only through the Docker-hosted `lims-postgres` container.

## Goals / Non-Goals

**Goals:**

- Add an explicit "Mẫu nhạy cảm" filter for authorized users in the Samples toolbar.
- Keep confidential samples hidden by default for users without `can_access_confidential = true`.
- Make URL tampering fail closed: unauthorized callers cannot reveal confidential rows or counts by setting the confidential-only parameter manually.
- Keep pagination, totals, sorting, and all other filters correct by filtering inside the RPC before count/order/page.
- Preserve the existing active scope behavior that hides `completed` samples unless `scope=all` or an explicit status filter is used.
- Add focused regression coverage before implementation code, including SQL/security checks.

**Non-Goals:**

- Changing how assays are marked confidential.
- Changing `results` RLS policies or user permission management.
- Adding a general sensitivity taxonomy beyond the current confidential assay marker.
- Changing doctor read-only Samples behavior.
- Adding mutations or audit-log events for viewing/filtering.

## Decisions

### 1. Use a dedicated URL/query parameter

Use `sensitivity=confidential` in the URL and map it to a typed query parameter in `SampleListParams`.

Alternatives considered:

- Reuse `status`: rejected because sensitivity is not a sample lifecycle status.
- Reuse `scope`: rejected because scope already controls active/all completion visibility.
- Client-only state: rejected because refreshes and shared links would lose the filter and tests would not cover the real query contract.

### 2. Filter inside `get_samples_page`, before count and pagination

Add a new RPC parameter, `p_confidential_only BOOLEAN DEFAULT FALSE`, and apply it inside the existing `filtered_samples` CTE.

Alternatives considered:

- Filter rows client-side after fetching: rejected because it would leak rows/counts through network payloads and break pagination.
- Post-process in `fetchSamples`: rejected because the RPC count would remain wrong and unauthorized leakage would already have crossed the DB boundary.

### 3. Make the SQL predicate fail closed

The confidential condition should be explicit and grouped:

```sql
AND (
  (
    p_confidential_only IS TRUE
    AND user_can_access_confidential()
    AND public.sample_has_confidential_results(s.id)
  )
  OR (
    p_confidential_only IS NOT TRUE
    AND (
      user_can_access_confidential()
      OR NOT public.sample_has_confidential_results(s.id)
    )
  )
)
```

This preserves current default behavior for authorized and unauthorized users while ensuring `p_confidential_only = TRUE` never opens confidential rows to unauthorized callers. The count is computed from the same filtered CTE, so unauthorized users also cannot infer sensitive sample volume from totals.

### 4. Keep `get_samples_page` as `SECURITY INVOKER`

The main list RPC should not be elevated. It can call the existing narrow `SECURITY DEFINER` helper functions, which already use bounded `search_path` settings.

Alternatives considered:

- Convert the RPC to `SECURITY DEFINER`: rejected because it increases blast radius and is not needed for this filter.
- Add a new admin/service-role list endpoint: rejected because this is a normal authenticated workspace read path and should keep RLS/user context.

### 5. Pass `canAccessConfidential` from the server session to the filter UI

`getAuthenticatedDashboardSession()` already returns `canAccessConfidential`. The Samples page should pass it to `SamplesPageClient`, then to `SampleFilters`.

The UI hides the button for unauthorized users, but that is only usability. The RPC remains the security boundary.

### 6. Include the filter in cache identity and reset behavior

The typed `SampleListParams` value passed to `useSamples` must include the confidential-only state so TanStack Query stores normal and confidential-only result sets separately. Toggling the filter should reset `page` to `1`, matching existing filter behavior.

## Risks / Trade-offs

- [Risk] A malformed SQL `OR` condition could bypass the confidential guard. → Mitigation: use explicit grouped branches and SQL tests for authorized and unauthorized callers.
- [Risk] RPC signature drift could break the existing rejected-only filter. → Mitigation: base the migration on the live Docker DB signature that includes `p_rejected_only`, then test rejected-only and default active behavior.
- [Risk] Counts could leak confidential sample existence. → Mitigation: calculate `total_count` only after the confidential predicate.
- [Risk] Cache reuse could show confidential rows in the wrong list state. → Mitigation: add the confidential parameter to `SampleListParams` and query keys, and keep principal-scoped cache isolation unchanged.
- [Risk] PostgREST may keep the old RPC signature cached. → Mitigation: restart `lims-rest` after migration.
- [Risk] Extra calls to `sample_has_confidential_results` may affect list performance. → Mitigation: reuse the existing helper initially, then consider a future indexed/materialized flag only if profiling shows a problem.

## Migration Plan

1. Add failing tests for the UI/query contract and `fetchSamples` RPC payload.
2. Add SQL/security regression coverage for authorized and unauthorized confidential-only list behavior.
3. Add the typed app query parameter and UI button.
4. Add a migration that drops/recreates `get_samples_page` with `p_confidential_only BOOLEAN DEFAULT FALSE`, preserving `p_rejected_only`.
5. Apply the migration through Docker:
   `docker exec -i lims-postgres psql -U postgres -d postgres`.
6. Run `SELECT * FROM run_security_tests();`.
7. Restart PostgREST with `docker compose restart rest`.
8. Run focused component/data tests, then `npm run typecheck`.

Rollback strategy: apply a follow-up migration that restores the previous live `get_samples_page` signature and remove the app query parameter usage. Because this change adds read filtering only, rollback does not require data repair.

## Open Questions

- Should the active filter badge show "Mẫu nhạy cảm" while enabled, or is the active toolbar button state sufficient?
- Should the confidential-only filter remain available for doctors if a future doctor role gains `can_access_confidential`, or should doctor Samples stay completed-only and non-confidential for MVP?

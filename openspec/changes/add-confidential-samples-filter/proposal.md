## Why

Authorized analysts and managers currently can see confidential-associated samples in the normal Samples list, but they have no focused way to review only those sensitive samples. The workspace needs an explicit "Mẫu nhạy cảm" filter while preserving non-discoverability for users whose `can_access_confidential` flag is false.

## What Changes

- Add a Samples toolbar filter button labeled "Mẫu nhạy cảm" for users with confidential access.
- Hide the button for users without confidential access.
- Add a URL/query contract for the confidential-only list state so it survives refreshes and shared links.
- Extend the Samples list query contract and `get_samples_page` RPC with a fail-closed confidential-only predicate.
- Keep the existing default active scope that hides `completed` samples unless `scope=all` or an explicit status filter is selected.
- Preserve current confidential concealment for unauthorized users, including rows and total counts.
- Add focused UI, data, and SQL/security regression coverage before implementation code is accepted.

## Capabilities

### New Capabilities

- `sample-management`: Users with confidential access can filter the Samples workspace to show only samples that contain at least one result linked to a confidential assay.

### Changed Capabilities

- `sample-management`: The Samples list query contract accepts a confidential-only filter while keeping unauthorized confidential samples non-discoverable.

## Impact

### Affected code

- `src/app/(dashboard)/samples/page.tsx`
- `src/components/samples-page-client.tsx`
- `src/components/sample-filters/index.tsx`
- `src/components/sample-filters/use-filter-params.ts`
- `src/components/sample-filters/ActiveFilterBadges.tsx`
- `src/lib/data/samples.ts`
- `src/types/lab.ts`
- `supabase/migrations/*`
- Focused tests under `src/components/__tests__/`, `src/lib/data/*.test.ts`, and SQL/security test coverage.

### Database and security impact

- The live Docker database currently exposes `get_samples_page` with `p_rejected_only` and without a confidential-only parameter.
- The migration must be based on the current live signature, not the older migration that predates `p_rejected_only`.
- `get_samples_page` must remain `SECURITY INVOKER`.
- Existing helpers `sample_has_confidential_results(uuid)` and `user_can_access_confidential()` remain the authority for confidential sample association and access.
- Unauthorized users must receive zero confidential rows and zero confidential count even if they manually add the confidential-only URL/query parameter.
- No RLS policy may be broadened. The change only narrows rows returned by the Samples RPC when requested.

### Compliance and audit impact

- This is a read-path filtering change and should not create sample, result, or audit-log mutations.
- The change supports least-privilege handling of sensitive samples and reduces accidental exposure in operational review.
- Verification must include `run_security_tests()` after applying the migration.

### Localization impact

- New visible UI copy is Vietnamese: "Mẫu nhạy cảm".
- Any active filter badge or accessible label for this filter must also be Vietnamese.

### Rollout impact

- Apply the migration through Docker/Postgres only:
  `docker exec -i lims-postgres psql -U postgres -d postgres`.
- Run `SELECT * FROM run_security_tests();` after migration.
- Restart PostgREST with `docker compose restart rest` after the RPC signature changes.

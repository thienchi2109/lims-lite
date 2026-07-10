## 1. Regression Tests First

- [ ] 1.1 Add Samples page/client tests proving `canAccessConfidential` is passed from the dashboard session to `SamplesPageClient` and `SampleFilters`.
- [ ] 1.2 Add `SampleFilters` tests proving "Mẫu nhạy cảm" is shown only for confidential-authorized users and toggles the URL filter state.
- [ ] 1.3 Add `SamplesPageClient` tests proving `sensitivity=confidential` maps to the Samples query contract and resets normal pagination behavior through existing filter navigation.
- [ ] 1.4 Add `fetchSamples` tests proving the client-action/server data path sends `p_confidential_only` to `get_samples_page`.
- [ ] 1.5 Add SQL/security regression coverage proving unauthorized users cannot see confidential rows or counts with either default list requests or confidential-only requests.

## 2. Application Query and UI Contract

- [ ] 2.1 Extend `SampleListParamsSchema` and TypeScript types with the confidential-only list parameter.
- [ ] 2.2 Parse `sensitivity=confidential` in `SamplesPageClient` and include the resulting parameter in `useSamples`.
- [ ] 2.3 Pass `dashboardSession.canAccessConfidential` from `src/app/(dashboard)/samples/page.tsx` into `SamplesPageClient`.
- [ ] 2.4 Add `canAccessConfidential` support to `SampleFilters` and `useFilterParams`.
- [ ] 2.5 Add the "Mẫu nhạy cảm" toolbar control with disabled/pending behavior matching existing filter controls.
- [ ] 2.6 Include the confidential-only state in active filter reset/clear behavior without disturbing sort and page-size preservation.
- [ ] 2.7 Add or update the Vietnamese active-filter indication if the final UI uses a badge for the confidential-only state.

## 3. Database RPC Migration

- [ ] 3.1 Create a new SQL migration based on the live `get_samples_page` signature that already includes `p_rejected_only`.
- [ ] 3.2 Add `p_confidential_only BOOLEAN DEFAULT FALSE` without dropping existing filter semantics.
- [ ] 3.3 Apply the fail-closed confidential predicate inside `filtered_samples` before `counted_samples`, ordering, and pagination.
- [ ] 3.4 Preserve `get_samples_page` as `SECURITY INVOKER` and preserve helper function grants/security modes.
- [ ] 3.5 Add migration comments documenting security impact and non-discoverability expectations.
- [ ] 3.6 Update `run_security_tests()` or adjacent SQL regression tests so the new confidential-only behavior remains covered.

## 4. Data Path Integration

- [ ] 4.1 Update `fetchSamples` to pass `p_confidential_only` to the RPC.
- [ ] 4.2 Keep the existing post-RPC unauthorized leakage check in `fetchSamples`.
- [ ] 4.3 Confirm normal Samples, rejected-only, active-scope, explicit status, receiver, specialty, date, sort, and page-size filters still compose with confidential-only filtering.

## 5. Verification and Rollout

- [ ] 5.1 Run the focused component tests for Samples filters and `SamplesPageClient`.
- [ ] 5.2 Run the focused data tests for `src/lib/data/samples.ts`.
- [ ] 5.3 Apply the migration through Docker only: `docker exec -i lims-postgres psql -U postgres -d postgres`.
- [ ] 5.4 Run `docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"`.
- [ ] 5.5 Restart PostgREST with `docker compose restart rest` after the RPC signature change.
- [ ] 5.6 Run `npm run typecheck`.
- [ ] 5.7 Run any broader Samples/security regression tests identified during implementation.
- [ ] 5.8 Verify `git diff --check` and final `git status` before commit/push.

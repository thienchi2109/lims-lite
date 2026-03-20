## TDD Guardrails

- [ ] 0.1 Do not write or keep production code for the KPI consolidation until the targeted test for that slice fails for the expected reason.
- [ ] 0.2 If a new test passes on the first run, tighten the assertion before continuing.

## 1. RED: Lock the Server Action contract

- [ ] 1.1 Update [`src/app/actions/reports.test.ts`](/root/lims-lite/src/app/actions/reports.test.ts) so `getKPIMetrics()` expects exactly one `supabase.rpc('get_kpi_metrics', ...)` call.
- [ ] 1.2 Add assertions that `getKPIMetrics()` no longer depends on `calculate_average_tat`, `get_samples_by_status`, `get_approval_queue_metrics`, or `get_error_rate_metrics`.
- [ ] 1.3 Keep the existing `KPIMetrics` output assertions so the public contract stays locked while the query path changes.
- [ ] 1.4 Run `npm test -- src/app/actions/reports.test.ts` and confirm it fails because the Server Action still uses the four-RPC fan-out or the consolidated RPC is not wired yet.

## 2. RED: Lock the server-data helper contract

- [ ] 2.1 Add `src/lib/data/reports.test.ts` for `fetchKPIData()` covering success, empty-state handling, and consolidated-RPC error propagation.
- [ ] 2.2 Add assertions that `fetchKPIData()` also uses exactly one `get_kpi_metrics` RPC call and no legacy KPI RPC calls.
- [ ] 2.3 Run `npm test -- src/lib/data/reports.test.ts` and confirm it fails for the expected pre-implementation reason.
- [ ] 2.4 Run `npm test -- src/app/actions/reports.test.ts src/lib/data/reports.test.ts` once both suites are red to verify the failure is now isolated to the missing implementation.

## 3. GREEN: Add the minimal database support

- [ ] 3.1 Create migration `supabase/migrations/121_add_get_kpi_metrics_rpc.sql`.
- [ ] 3.2 Implement `public.get_kpi_metrics(start_date timestamptz, end_date timestamptz)` as `SECURITY INVOKER`.
- [ ] 3.3 Return one row containing TAT metrics, pending approval metrics, error-rate metrics, and `status_breakdown jsonb` ordered consistently with the current status workflow ordering.
- [ ] 3.4 Preserve the current semantics already encoded in `calculate_average_tat`, `get_samples_by_status`, `get_approval_queue_metrics`, and `get_error_rate_metrics`.
- [ ] 3.5 Keep the four existing KPI RPCs available and unchanged for compatibility.
- [ ] 3.6 Apply the migration to `lims-postgres`, then reload PostgREST schema cache with `NOTIFY pgrst, 'reload schema'` or restart `lims-rest` if needed.

## 4. GREEN: Make the tests pass with the smallest application change

- [ ] 4.1 Update [`src/app/actions/reports.ts`](/root/lims-lite/src/app/actions/reports.ts) so `getKPIMetrics()` calls only `get_kpi_metrics(...)`.
- [ ] 4.2 Update [`src/lib/data/reports.ts`](/root/lims-lite/src/lib/data/reports.ts) so `fetchKPIData()` calls only `get_kpi_metrics(...)`.
- [ ] 4.3 Preserve the current `KPIMetrics` TypeScript contract and existing page/component consumers without UI changes.
- [ ] 4.4 Normalize consolidated-RPC error handling so failures still surface as an exception instead of partial KPI data.
- [ ] 4.5 Run `npm test -- src/app/actions/reports.test.ts src/lib/data/reports.test.ts` and confirm both suites turn green before any cleanup refactor.

## 5. REFACTOR: Remove drift without changing behavior

- [ ] 5.1 Extract or align shared mapping logic if `getKPIMetrics()` and `fetchKPIData()` would otherwise duplicate consolidated-row parsing.
- [ ] 5.2 Keep the refactor scoped to the KPI path only; do not pull chart/report RPCs into this change.
- [ ] 5.3 Re-run `npm test -- src/app/actions/reports.test.ts src/lib/data/reports.test.ts` after refactor and confirm the suites remain green.

## 6. Full Verification

- [ ] 6.1 Run `SELECT * FROM run_security_tests();` after the migration.
- [ ] 6.2 Run `npm run typecheck`.
- [ ] 6.3 Smoke-test `SELECT * FROM get_kpi_metrics(<start>, <end>);` against `lims-postgres`.
- [ ] 6.4 Verify the reports pages still render KPI cards from the unchanged `KPIMetrics` contract.
- [ ] 6.5 Run `npm run build`.

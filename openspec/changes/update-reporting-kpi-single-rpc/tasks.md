## TDD Guardrail

- [ ] 0.1 Do not write production code for the KPI consolidation until the targeted tests in section 1 fail for the expected reason.

## 1. Red: Lock the KPI contract with failing tests

- [ ] 1.1 Update [`src/app/actions/reports.test.ts`](/root/lims-lite/src/app/actions/reports.test.ts) so `getKPIMetrics()` expects exactly one `supabase.rpc('get_kpi_metrics', ...)` call and the current `KPIMetrics` response shape.
- [ ] 1.2 Add `src/lib/data/reports.test.ts` to cover `fetchKPIData()` success, empty-state handling, and RPC error propagation through the same single-RPC contract.
- [ ] 1.3 Run `npm test -- src/app/actions/reports.test.ts src/lib/data/reports.test.ts` and confirm the suite fails because the consolidated RPC path is not implemented yet or the call sites still use the four-RPC fan-out.

## 2. Green: Add the consolidated KPI RPC

- [ ] 2.1 Create migration `supabase/migrations/121_add_get_kpi_metrics_rpc.sql`.
- [ ] 2.2 Implement `public.get_kpi_metrics(start_date timestamptz, end_date timestamptz)` as `SECURITY INVOKER`.
- [ ] 2.3 Return one row containing TAT metrics, pending approval metrics, error-rate metrics, and `status_breakdown jsonb` ordered consistently with the current status workflow ordering.
- [ ] 2.4 Preserve the existing semantics currently encoded in `calculate_average_tat`, `get_samples_by_status`, `get_approval_queue_metrics`, and `get_error_rate_metrics`.
- [ ] 2.5 Keep the four existing KPI RPCs available and unchanged for compatibility.
- [ ] 2.6 Apply the migration to `lims-postgres`, then reload PostgREST schema cache with `NOTIFY pgrst, 'reload schema'` or restart `lims-rest` if needed.
- [ ] 2.7 Run `SELECT * FROM run_security_tests();` after the migration.

## 3. Green: Switch both application entry points to the new RPC

- [ ] 3.1 Update [`src/app/actions/reports.ts`](/root/lims-lite/src/app/actions/reports.ts) so `getKPIMetrics()` calls only `get_kpi_metrics(...)`.
- [ ] 3.2 Update [`src/lib/data/reports.ts`](/root/lims-lite/src/lib/data/reports.ts) so `fetchKPIData()` calls only `get_kpi_metrics(...)`.
- [ ] 3.3 Preserve the current `KPIMetrics` TypeScript contract and existing page/component consumers without UI changes.
- [ ] 3.4 Normalize consolidated-RPC error handling so failures still surface as an exception instead of partial KPI data.

## 4. Refactor: Remove drift between the two KPI call sites

- [ ] 4.1 Extract or align shared mapping logic if `getKPIMetrics()` and `fetchKPIData()` would otherwise duplicate consolidated-row parsing.
- [ ] 4.2 Keep the refactor scoped to the KPI path only; do not pull chart/report RPCs into this change.
- [ ] 4.3 Re-run the targeted KPI tests after any cleanup to confirm the refactor stays green.

## 5. Verification

- [ ] 5.1 Run `npm test -- src/app/actions/reports.test.ts src/lib/data/reports.test.ts`.
- [ ] 5.2 Run `npm run typecheck`.
- [ ] 5.3 Smoke-test `SELECT * FROM get_kpi_metrics(<start>, <end>);` against `lims-postgres`.
- [ ] 5.4 Verify the reports pages still render KPI cards from the unchanged `KPIMetrics` contract.
- [ ] 5.5 Run `npm run build`.

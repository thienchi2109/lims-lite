## Context

The Reports dashboard KPI path currently fans out into four separate RPC calls for the same date range:

- `calculate_average_tat(start_date, end_date)`
- `get_samples_by_status(start_date, end_date)`
- `get_approval_queue_metrics(start_date, end_date)`
- `get_error_rate_metrics(start_date, end_date)`

That fan-out exists in two places today:

- [`src/app/actions/reports.ts`](/root/lims-lite/src/app/actions/reports.ts) via `getKPIMetrics()`
- [`src/lib/data/reports.ts`](/root/lims-lite/src/lib/data/reports.ts) via `fetchKPIData()`

The result is duplicated mapping logic, more network hops through PostgREST, and a broader failure surface for one dashboard payload. The user-approved direction is to consolidate the KPI path into one RPC without changing the pages, the `KPIMetrics` TypeScript contract, or the existing legacy RPCs.

This change extends the pending `reporting` capability from `add-reports-dashboard`; it does not introduce a new domain capability.

## Goals / Non-Goals

### Goals

- Fetch all KPI-card data through one dashboard-facing RPC.
- Preserve the current `KPIMetrics` contract returned by `getKPIMetrics()` and `fetchKPIData()`.
- Preserve the existing semantics for TAT, WIP breakdown, pending approvals, on-time rate, and error rate.
- Keep legacy KPI RPCs callable for compatibility.
- Keep RLS enforcement intact by using `SECURITY INVOKER`.
- Use explicit red-green-refactor steps so the refactor is test-led instead of inferred after the fact.

### Non-Goals

- Reworking reports UI, route structure, or chart components.
- Consolidating chart/report RPCs beyond the KPI card path.
- Replacing the KPI path with a materialized view or scheduled snapshot table.
- Removing the four existing KPI RPCs.
- Adding new trend calculations or changing dashboard copy.

## Options Considered

### Option A: Add a wrapper RPC that calls the existing four KPI RPCs

This would reduce the application-level round-trips to one RPC call, but the database would still execute four separate functions with their existing duplicated scans and logic boundaries. It helps the network path, but not the database work or the duplicated reasoning around partial failures.

### Option B: Add one consolidated SQL RPC for the KPI payload

This keeps the application-to-PostgREST path to one call and lets the database build the KPI payload from named CTEs for the selected window. It is the best balance of performance, clarity, and compatibility for the current codebase.

### Option C: Introduce a materialized view or pre-aggregated KPI snapshot

This would likely be fastest at scale, but it adds refresh complexity, eventual-consistency tradeoffs, and operational work that is not needed for the current scope. It is premature for this refactor.

## Decision

Implement **Option B**.

Add a new RPC:

```sql
get_kpi_metrics(start_date timestamptz, end_date timestamptz)
```

The function returns a single row that contains all fields needed to rebuild the current `KPIMetrics` shape, including a status breakdown payload ordered the same way as the current status RPC.

Recommended payload shape:

```sql
RETURNS TABLE (
  avg_tat_hours numeric,
  median_tat_hours numeric,
  sample_count bigint,
  on_time_count bigint,
  status_breakdown jsonb,
  pending_count bigint,
  avg_wait_hours numeric,
  overdue_count bigint,
  error_rate numeric,
  total_modifications bigint,
  total_results bigint
)
```

### Why this shape

- `avg_tat_hours`, `sample_count`, and `on_time_count` preserve existing TAT and on-time calculations.
- `status_breakdown jsonb` lets the application rebuild `wipCount.breakdown` without another RPC.
- Approval and error-rate fields stay flat and easy to map.
- Returning one row keeps both Supabase call sites simple and reduces divergence between them.

## Query Design

The new RPC should use shared CTEs so each KPI segment reads from a named, date-scoped dataset instead of repeating filter logic in application code.

Expected logical structure:

1. `completed_samples`
   - completed samples in the requested window using `completed_at`
   - source for average TAT, median TAT, sample count, and on-time count
2. `window_samples`
   - non-deleted samples in the requested window using the same status-window semantics as `get_samples_by_status`
   - source for status counts / WIP breakdown
3. `review_queue`
   - samples in `review` using the same semantics as `get_approval_queue_metrics`
   - source for pending approval metrics
4. `result_window` and `result_modifications`
   - sources aligned with the current `get_error_rate_metrics` logic
   - source for error rate, total modifications, and total results

The function should remain `SECURITY INVOKER` and `GRANT EXECUTE` to `authenticated` so existing RLS policies remain the final enforcement layer.

## Application Mapping

`getKPIMetrics()` and `fetchKPIData()` should both map the new consolidated payload back to the existing `KPIMetrics` structure.

Recommended follow-up refactor during implementation:

- Extract one shared mapper/helper for the consolidated KPI row so the Server Action path and server-data helper cannot drift again.

The UI and type surfaces should remain unchanged:

- no page/component prop changes
- no `KPIMetrics` schema changes
- no route changes

## TDD Plan

This refactor should be implemented with explicit red-green-refactor steps:

### RED

- Update [`src/app/actions/reports.test.ts`](/root/lims-lite/src/app/actions/reports.test.ts) so `getKPIMetrics()` expects exactly one `get_kpi_metrics` RPC call and the unchanged `KPIMetrics` output.
- Add `src/lib/data/reports.test.ts` for `fetchKPIData()` using the same single-RPC contract.
- Run the targeted tests and confirm failure happens because the new RPC path is not implemented yet or the call sites still use the legacy RPC fan-out.

### GREEN

- Add `supabase/migrations/121_add_get_kpi_metrics_rpc.sql`.
- Implement `get_kpi_metrics(...)`.
- Update both TypeScript call sites to use the new RPC and satisfy the tests with the smallest correct code change.

### REFACTOR

- Remove duplicated KPI-row mapping if it remains in both call sites.
- Re-run the same targeted tests plus typecheck and build to confirm behavior stayed green.

## Rollout / Verification Notes

- Apply the migration to `lims-postgres`.
- Reload PostgREST schema cache after the migration:
  - preferred: `NOTIFY pgrst, 'reload schema';`
  - fallback: restart `lims-rest` if the cache does not refresh
- Run `SELECT * FROM run_security_tests();`
- Smoke-test `SELECT * FROM get_kpi_metrics(...);`
- Run the targeted test suite, `npm run typecheck`, and `npm run build` before calling the change green.

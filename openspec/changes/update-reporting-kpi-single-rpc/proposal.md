## Why

The Reports dashboard currently assembles its five KPI cards by calling four separate RPC functions in both [`src/app/actions/reports.ts`](/root/lims-lite/src/app/actions/reports.ts) and [`src/lib/data/reports.ts`](/root/lims-lite/src/lib/data/reports.ts). That duplicates mapping logic, increases application-to-PostgREST round-trips, and makes the KPI path harder to reason about when one RPC fails independently from the others.

This change keeps the existing `KPIMetrics` contract and keeps the four existing KPI RPCs available for compatibility, but introduces one consolidated KPI RPC for the primary dashboard path. It also formalizes a test-first workflow for the refactor so the contract stays stable while the query path changes.

## What Changes

- Add a new consolidated RPC `public.get_kpi_metrics(start_date, end_date)` for the five KPI cards.
- Keep `calculate_average_tat`, `get_samples_by_status`, `get_approval_queue_metrics`, and `get_error_rate_metrics` available and unchanged for existing or future consumers outside this refactor.
- Refactor `getKPIMetrics()` and `fetchKPIData()` to call only `get_kpi_metrics(...)` while preserving the current `KPIMetrics` shape returned to pages and components.
- Return the status breakdown needed by `wipCount.breakdown` from the consolidated KPI payload so no UI contract changes are required.
- Add focused automated coverage first, verify it fails for the right reason, then implement the consolidated RPC and mapping changes.
- Include an operational rollout step to reload PostgREST schema cache after the migration so the new RPC is visible immediately.

## Impact

- **Affected specs:** `reporting` (extends the pending reporting capability introduced by `add-reports-dashboard`)
- **Primary code surfaces:**
  - [`src/app/actions/reports.ts`](/root/lims-lite/src/app/actions/reports.ts)
  - [`src/app/actions/reports.test.ts`](/root/lims-lite/src/app/actions/reports.test.ts)
  - [`src/lib/data/reports.ts`](/root/lims-lite/src/lib/data/reports.ts)
  - `src/lib/data/reports.test.ts` (new targeted regression coverage)
  - `supabase/migrations/121_add_get_kpi_metrics_rpc.sql`
- **Database / operations:**
  - New read-only RPC with `SECURITY INVOKER`
  - PostgREST schema cache reload after migration apply
  - Mandatory `run_security_tests()` verification after migration
- **Non-goals:**
  - No UI redesign or route changes
  - No change to chart RPCs, CoA statistics RPCs, or staff productivity RPC
  - No removal of existing KPI RPCs in this change

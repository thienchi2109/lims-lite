# Historic CoA Regeneration Guard Implementation Plan

> **For agentic workers:** Execute this plan in the current session. Do not
> spawn subagents or reviewers without explicit user instruction.

**Goal:** Prevent regeneration of historic CoA reports that have no immutable
`source_submission_id`, while preserving their existing artifacts and returning
a clear Vietnamese error.

**Architecture:** The regeneration RPC remains the authoritative guard. It
returns a structured blocked reason before creating a claim or mutating the
report. The TypeScript data layer parses that reason, and the action maps it to
Vietnamese UI text.

**Tech Stack:** PostgreSQL/PLpgSQL, self-hosted Supabase in Docker, Next.js
server actions, TypeScript, Zod, Vitest.

---

### Task 1: Lock the behavior with failing tests

**Files:**
- Modify: `src/app/actions/coa.stamp.test.ts`
- Create: `tests/coa-historic-regeneration-policy.test.sql`

- [x] Add an action regression test for the historic regeneration blocked
  response.
- [x] Add SQL regressions proving both ready and failed historic reports retain
  their status, artifact metadata, and empty claim fields.
- [x] Run both focused tests and confirm they fail for the missing policy.

### Task 2: Add the forward-only database guard

**Files:**
- Create: `supabase/migrations/180_block_historic_coa_regeneration.sql`

- [x] Validate the pinned migration 178/179 baseline before changing the RPC.
- [x] Replace `claim_coa_report_regeneration` with a guard that returns
  `blocked_reason = HISTORIC_REPORT_WITHOUT_SOURCE` before mutation.
- [x] Update the registered security checker so removal of the guard fails
  `run_security_tests()`.
- [x] Preserve `SECURITY DEFINER`, `search_path`, comments, and grants.
- [x] Apply migration 180 through `docker exec ... lims-postgres psql`.
- [x] Add and apply migration 181 to restore the composed migration 179 checker
  contract after its regression test exposed the flattened checker.

### Task 3: Surface the Vietnamese action error

**Files:**
- Modify: `src/lib/coa/report-provenance.ts`
- Modify: `src/app/actions/coa.ts`

- [x] Extend the response schema and `CoAReportSource` with the optional blocked
  reason.
- [x] Return `Không thể tạo lại CoA lịch sử vì báo cáo chưa có nguồn dữ liệu đã
  duyệt bất biến` without starting generation.
- [x] Run focused TypeScript tests and confirm they pass.

### Task 4: Verify and land

- [x] Run the focused SQL regression.
- [x] Run the existing claim/provenance SQL regressions.
- [x] Run `SELECT * FROM run_security_tests();`.
- [x] Run focused Vitest, typecheck, and relevant lint.
- [x] Inspect the final diff and migration immutability boundary.
- [ ] Commit, push, and update Issue #70 with verification evidence.

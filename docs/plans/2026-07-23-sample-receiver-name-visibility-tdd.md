# Sample Receiver Name Visibility - TDD Implementation Plan

**Date:** 2026-07-23  
**Repository:** `/root/lims-lite`  
**Implementation branch:** `fix/sample-receiver-name-visibility` from the latest `main`  
**Database impact:** none

## Goal

Ensure every authenticated role that is already authorized to view a sample
receives the active sample receiver's `full_name` in both the `/samples` grid
and detail panel.

The fix must preserve the existing `public.users` RLS boundary. It must not
grant analysts or doctors general access to other user profiles, change
`get_samples_page` from `SECURITY INVOKER`, or introduce a database migration.

## Root Cause

- `samples.received_by` is populated correctly with `auth.uid()` during
  accession.
- `get_samples_page` and the sample-detail relationship both read
  `public.users` under the caller's RLS context.
- The users SELECT policy allows a user to read only their own profile, while
  managers may read all profiles.
- A different analyst or doctor can therefore read the sample but receives a
  null receiver relationship. The UI correctly renders that null value as
  `N/A`.

## Locked Decisions

1. Populate receiver names for analyst, manager, and doctor users only after
   the existing sample authorization path has succeeded.
2. Keep `public.users` policies and grants unchanged.
3. Keep `get_samples_page` and its confidentiality checks unchanged.
4. Use a server-only service-role lookup limited to `id` and `full_name`.
5. Query only receiver IDs referenced by samples already authorized for the
   caller.
6. Query only active users with `deleted_at IS NULL`.
7. Treat the active-user lookup as authoritative for every non-null
   `received_by`, even when the authenticated query already returned a name.
8. Preserve `null` when `received_by` is null, and reset the name to `null`
   when its user is deleted or missing.
9. Treat a required receiver lookup failure as a read error instead of silently
   returning an incorrect `N/A`.
10. Limit this change to `received_by_name`. Do not alter `rejected_by_name`,
    approval actors, or activity-feed actor names.

## Target Internal Interface

Add one server-only helper alongside the sample data read path:

```ts
type SampleReceiverFields = {
    received_by: string | null
    received_by_name?: string | null
}

export async function enrichSampleReceiverNames<T extends SampleReceiverFields>(
    samples: T[],
): Promise<{ data: T[] } | { error: string }>
```

The helper will:

- be a named export from the server-owned sample data module so the list and
  detail read paths share one implementation;
- collect every unique, non-null `received_by` value;
- avoid an admin query only when no row has a receiver ID;
- use `createAdminClient()` to select only `id, full_name`;
- filter `deleted_at IS NULL`;
- replace `received_by_name` with the active-user lookup result, or `null` when
  no active user matches, without changing row order or unrelated fields;
- catch both Supabase `{ error }` results and exceptions from client creation or
  query execution;
- log only a generic server-side receiver lookup failure and return the
  normalized Vietnamese error `Không thể tải thông tin người nhận mẫu`, without
  returning raw service-role errors or logging sample/patient data.

`SampleWithUser`, API response shapes, URL parameters, and UI component props
remain unchanged.

## Phase 1 - Lock the List Regression

### Main files

- Modify: `src/lib/data/samples.test.ts`
- Modify: `src/lib/data/samples.ts`

### RED

Add focused tests proving:

1. When `get_samples_page` returns an authorized row with a valid
   `received_by` and `received_by_name: null`, an admin lookup supplies the
   active receiver name.
2. An RPC-provided name is replaced by the authoritative active-user lookup.
3. Duplicate receiver IDs produce one `.in('id', ids)` lookup.
4. Rows with `received_by: null` do not trigger a lookup and stay null.
5. A deleted or missing receiver resets an RPC-provided name to `null`.
6. A returned Supabase error makes `fetchSamples()` return the normalized
   receiver-load error.
7. A thrown error from `createAdminClient()` or the query promise produces the
   same normalized receiver-load error.
8. The admin query selects only `id, full_name` and filters
   `deleted_at IS NULL`.
9. The test harness exposes a `createAdminClient` mock with the exact
   `.select().in().is()` chain used by the helper.

Run the new test before implementation and confirm it fails because
`fetchSamples()` currently returns the RPC's null receiver name unchanged.

### GREEN

- Implement `enrichSampleReceiverNames()`.
- Keep all current RPC arguments, pagination, sorting, receiver filtering, and
  confidentiality behavior unchanged.
- For users without confidential access, run enrichment only after the
  existing confidential-sample leak check passes.
- For users with confidential access, enrich only the rows already returned by
  the authenticated RPC.
- Return the enriched rows through the existing result shape.

### Verify

```bash
rtk npm run test:run -- \
  src/lib/data/samples.test.ts \
  src/lib/data/samples.confidentiality.test.ts
```

### Exit Criteria

- The new list regression is green.
- Existing pagination, filters, and confidential-sample tests remain green.
- No service-role query can include an ID not present in the authorized RPC
  result.

## Phase 2 - Lock the Detail Regression

### Main files

- Modify: `src/app/actions/samples.confidentiality.test.ts`
- Modify: `src/app/actions/samples.ts`

### RED

Add focused tests proving:

1. `getSample()` returns `received_by_name` when the authenticated relationship
   is null but the active receiver exists.
2. A name returned through `received_by_user` is replaced by the authoritative
   active-user lookup.
3. A confidential sample concealed from the caller returns
   `Không tìm thấy mẫu` before any receiver lookup.
4. A doctor requesting a non-completed sample returns not found before any
   receiver lookup.
5. A null receiver remains null without a lookup.
6. A deleted or missing receiver resets an embedded relationship name to null.
7. Returned and thrown receiver lookup failures produce the same normalized
   detail-load error.

Run the new test before integrating the helper and confirm the expected failure
is the current null `received_by_name`.

### GREEN

- Keep the existing authenticated sample query and embedded
  `received_by_user` relation.
- Keep authentication, doctor completed-only access, and confidentiality
  concealment in their existing order.
- Import the named `enrichSampleReceiverNames()` export from
  `src/lib/data/samples.ts` and invoke it only after those guards pass.
- Return the existing sample payload with the resolved `received_by_name`.
- Do not add service-role reads to the route handler or client hook.

### Verify

```bash
rtk npm run test:run -- \
  src/app/actions/samples.confidentiality.test.ts \
  'src/app/api/samples/[id]/route.test.ts'
```

### Exit Criteria

- A different authorized analyst receives the stored receiver name.
- Unauthorized or concealed samples never reach the admin receiver lookup.
- The route response contract remains `{ data: SampleWithUser }`.

## Phase 3 - Refactor and Blast-Radius Verification

### Refactor

- Keep the enrichment helper in the server-owned sample data module rather than
  creating a generic user-directory abstraction.
- Use clear names for unresolved receiver IDs and the resulting name map.
- Keep `src/lib/data/samples.ts` and `src/app/actions/samples.ts` below the
  repository's practical 350-line limit.
- Do not modify receiver UI components; they already render a provided name
  correctly.

### Focused Verification

```bash
rtk npm run test:run -- \
  src/lib/data/samples.test.ts \
  src/lib/data/samples.confidentiality.test.ts \
  src/app/actions/samples.confidentiality.test.ts \
  'src/app/api/samples/[id]/route.test.ts' \
  src/components/__tests__/sample-list-table.test.tsx \
  src/components/__tests__/sample-detail-panel-enrichment.test.tsx
rtk npm run typecheck
rtk npm run lint
```

Run React Doctor only if implementation unexpectedly changes React components.
No database migration or `run_security_tests()` invocation is required because
the schema, functions, policies, and grants remain unchanged.

## Deployment and Acceptance

1. Commit and push this reviewed plan before implementation:

   ```bash
   rtk git add docs/plans/2026-07-23-sample-receiver-name-visibility-tdd.md
   rtk git commit -m "docs: Add sample receiver visibility TDD plan"
   rtk git push -u origin fix/sample-receiver-name-visibility
   ```

2. Review the implementation diff for any accidental `public.users` policy,
   grant, or
   migration changes.
3. Commit the implementation with:

   ```bash
   rtk git add src/lib/data/samples.ts src/lib/data/samples.test.ts \
     src/app/actions/samples.ts src/app/actions/samples.confidentiality.test.ts
   rtk git commit -m "fix: Resolve sample receiver names for authorized viewers"
   ```

4. Rebase, push the feature branch, and open a PR.
5. After merge, update `/opt/lims-lite` and deploy only from the home server.
6. Verify the application health endpoint:

   ```bash
   rtk curl -fsS https://cdclims.cloud/auth/v1/health
   ```

7. Log in as an analyst different from the sample receiver and verify:
   - the grid's `Người nhận` column shows the receiver's full name;
   - the sample detail panel shows the same full name;
   - list filtering, pagination, and detail navigation still work.
8. Verify manager, doctor, and the receiving analyst retain correct behavior.
9. Verify a sample with a null or soft-deleted receiver still shows `N/A`.
10. Confirm production logs contain no receiver enrichment errors or sensitive
   sample data.

## Out of Scope

- Broadening `public.users` SELECT visibility.
- Changing `get_samples_page` security mode or SQL output.
- Backfilling or modifying `samples.received_by`.
- Displaying deleted users' historical names.
- Fixing `rejected_by_name`, approval actors, or activity-feed actor names.

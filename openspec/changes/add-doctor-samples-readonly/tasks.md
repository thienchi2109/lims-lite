## 1. Database Authorization

- [x] 1.1 Create a new SQL migration that adds `doctor` to `public.user_role` and documents the RLS/security impact.
- [x] 1.2 Replace `samples` SELECT policy so analyst/manager behavior remains intact while doctor reads only non-deleted `completed` samples, with confidential samples gated by `user_can_access_confidential()`.
- [x] 1.3 Replace `coa_reports` SELECT policy and `coa-reports` storage SELECT policy so doctor reads only ready CoAs for authorized completed samples.
- [x] 1.4 Confirm doctor is not added to samples/results/CoA INSERT, UPDATE, DELETE, generation, accession, assignment, approval, or QC policies/RPCs.
- [x] 1.5 Extend `run_security_tests()` with doctor enum, samples visibility, CoA visibility, and no-write/no-operational-access checks.

## 2. Role, Routing, and API Guards

- [x] 2.1 Update TypeScript role schemas/types and Vietnamese role labels to include `doctor`.
- [x] 2.2 Update login redirect, dashboard session role parsing, and middleware so doctor lands on `/samples` and is blocked from `/analyst`, `/manager`, and `/profile`.
- [x] 2.3 Add role checks to analyst/manager dashboard entry pages where needed so doctor cannot render those pages if middleware is bypassed.
- [x] 2.4 Add a doctor allowlist/deny guard in `/api/client-actions` so doctor can only call the read paths required for the completed Samples workspace.
- [x] 2.5 Keep doctor excluded from raw result reads, sample mutations, assignments, approvals, user/client/assay/signature actions, search, and CoA generation/regeneration.

## 3. Samples UI

- [x] 3.1 Update `/samples` server page to accept doctor, build doctor read-only permissions, and set doctor home/back behavior to remain on `/samples`.
- [x] 3.2 Force doctor sample list params to completed-only on the client/server read path so URL filters cannot expand visibility.
- [x] 3.3 Hide or disable doctor edit/delete/discard/enter-results/view-results/assignment/IQC/generate-CoA controls.
- [x] 3.4 Add a doctor-specific bottom-row panel that shows sample metadata plus ready CoA status/preview action and does not mount `AssignedTestsPanel`.
- [x] 3.5 Update dashboard header/dropdown/navigation so doctor does not see global search, profile, settings, or analyst/manager nav links, but can still log out.
- [x] 3.6 Update user management form/table display so managers can assign and recognize the `Bác sĩ` role.

## 4. CoA and Data Access

- [x] 4.1 Update `/api/coa/view` so doctor can view ready CoA only for completed, non-deleted samples that pass confidential access checks.
- [x] 4.2 Keep CoA generation/regeneration restricted to existing analyst/manager paths and verify doctor direct calls fail.
- [x] 4.3 Harden `getSample`, `fetchSamples`, or related read helpers as needed so doctor detail access returns authorization-neutral errors for non-completed or confidential-unauthorized samples.
- [x] 4.4 Ensure doctor UI does not call `getResultsBySample`, QC status actions, signature status actions, or raw results enrichment hooks.

## 5. Verification

- [x] 5.1 Apply the migration locally with Docker-backed Postgres.
- [x] 5.2 Run `SELECT * FROM run_security_tests();` and confirm all doctor security checks pass.
- [x] 5.3 Add and run targeted tests for doctor routing, client action denial, Samples read-only rendering, completed-only filtering, and CoA view authorization.
- [x] 5.4 Run `npm run typecheck`.
- [x] 5.5 Run targeted Vitest suites touched by the change, then `npm run test:run`.
- [x] 5.6 Run `npm run build`.
- [x] 5.7 Run `npm run lint` and report any pre-existing lint debt separately if it is unrelated to the doctor implementation.

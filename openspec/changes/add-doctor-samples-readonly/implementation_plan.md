# Doctor Role RBAC Plan

## Summary

- Add the `doctor` business role while preserving the existing HIV/confidential model: base role plus `users.can_access_confidential`.
- Doctors can access only `/samples`, see only samples with `status = 'completed'`, and view ready CoA documents for those samples.
- Doctors cannot edit, delete, discard, assign, enter results, view raw results, use IQC, use search, access profile/settings, or access analyst/manager pages.
- Authorization must be enforced in layers: RLS first, server/API guards second, UI last.

## Key Changes

- DB migration:
  - Add enum value `doctor` for `public.user_role`.
  - Update `samples` SELECT policy: analyst/manager keep current behavior; doctor only reads non-deleted completed samples and only reads confidential-associated samples when `user_can_access_confidential() = true`.
  - Update `coa_reports` SELECT and `coa-reports` storage SELECT policies so doctor can read only ready CoAs for authorized completed samples.
  - Do not grant doctor INSERT/UPDATE/DELETE on samples, results, CoA reports, or CoA storage, and do not add doctor to create/accession/assignment/generation RPCs.
  - Extend `run_security_tests()` with doctor enum, completed-only sample visibility, CoA ready/completed-only visibility, and negative mutation/operation checks.
- App RBAC/types:
  - Extend `UserRole` and `DashboardUserRole` with `doctor`; add Vietnamese label `Bác sĩ`.
  - Redirect doctor to `/samples` after login; block doctor from `/analyst`, `/manager`, `/profile`, and non-Samples routes.
  - Add doctor-aware allow/deny handling in `/api/client-actions`, allowing only the read path needed for completed Samples review.
- Samples UI:
  - Accept doctor on `/samples` and build read-only permissions: no edit, discard, enter results, view raw results, assignment, IQC, or generate/regenerate CoA.
  - Force completed-only filtering for doctor in client/server sample read params; URL filters must not widen visibility.
  - Do not mount `AssignedTestsPanel` for doctor. Render a doctor-specific CoA-only panel that shows read-only sample metadata and a ready CoA preview action.
  - Hide global search and profile/settings links for doctor; keep logout available.
- CoA:
  - Allow doctor in `/api/coa/view` only after role, completed sample, ready CoA, soft-delete, and confidential-access checks pass.
  - Keep generate/regenerate CoA restricted to analyst/manager workflows.
  - Keep `getResultsBySample` and results RLS excluding doctor.

## Test Plan

- SQL:
  - Apply migration via Docker.
  - Run `SELECT * FROM run_security_tests();`.
  - Probe doctor visibility: completed sample visible; non-completed sample invisible; confidential completed sample invisible when `can_access_confidential=false`; visible when true.
- Unit/component:
  - `dashboard-session` accepts doctor.
  - `/samples` doctor mode forces completed-only and hides edit/delete/enter/view-results controls.
  - Doctor bottom row renders CoA-only panel and does not render `AssignedTestsPanel`.
  - CoA view route allows doctor for completed ready CoA and denies non-completed, missing CoA, and confidential-without-flag cases.
  - Client actions deny doctor mutations/search/results actions.
  - User form/table shows `Bác sĩ`.
- Quality gates:
  - `npm run typecheck`
  - targeted Vitest files
  - `npm run test:run`
  - `npm run build`
  - `npm run lint`, with unrelated existing lint debt reported separately if it remains.

## Assumptions

- The DB sample status is `completed`, not `complete`.
- No `doctor-hiv` role variant will be created.
- Doctors may see CoA documents, but not raw result tables in the Samples UI.
- Doctors cannot access `/profile`; logout remains available through the header/dropdown.

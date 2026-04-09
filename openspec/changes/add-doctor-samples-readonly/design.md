## Context

The current application models dashboard roles as `analyst` and `manager` in both TypeScript and the Postgres `user_role` enum. The unified `/samples` workspace builds role-specific permissions server-side, but it assumes those two roles and currently renders the assigned-results panel for selected samples.

The database also needs tightening for this feature. `samples` SELECT currently allows authenticated non-deleted reads, while `get_samples_page` is `SECURITY INVOKER` and relies on RLS plus its own filters. CoA staff viewing currently permits analyst/manager roles and CoA storage/table policies also reference analyst/manager. Confidential HIV access is already modeled as `users.can_access_confidential` plus assay/sample confidential guards.

## Goals / Non-Goals

**Goals:**

- Add `doctor` as a first-class role that can be assigned in user management.
- Enforce doctor read scope at RLS first: completed, non-deleted samples only, with confidential/HIV visibility gated by `can_access_confidential`.
- Keep doctor UI limited to `/samples`, sample metadata, and ready CoA preview.
- Prevent doctor write paths and broad discovery paths through middleware, client actions, CoA route authorization, search, profile links, and UI controls.
- Add database and application regression tests for the role boundary.

**Non-Goals:**

- Do not create `doctor-hiv`, `analyst-hiv`, or `manager-hiv` role variants.
- Do not allow doctors to view raw results tables, IQC, assignment, approval, reports, audit logs, user management, or profile/signature management.
- Do not change analyst/manager workflow semantics except where policy predicates must stay explicit after adding the enum value.
- Do not implement public CoA portal changes.

## Decisions

- **Use DB-first authorization.** Add the enum value and tighten `samples`, `coa_reports`, and `coa-reports` storage policies so UI mistakes cannot expose non-completed samples or CoAs. Alternative considered: only filter doctor in `get_samples_page`; rejected because direct Supabase/API paths would remain risky.
- **Keep confidential access as role plus flag.** Doctor users with `can_access_confidential = false` cannot see confidential/HIV-associated completed samples or CoAs; doctors with `true` can see completed confidential records. Alternative considered: add `doctor-hiv`; rejected because it diverges from the existing confidentiality model.
- **Render a doctor-specific CoA-only detail panel.** Doctors will not mount `AssignedTestsPanel`, which avoids raw results, result editing hooks, IQC enrichment, assignment dialogs, signature/profile links, and generate/regenerate CoA actions. Alternative considered: reuse `AssignedTestsPanel` in read-only mode; rejected because it has too many operational side effects.
- **Use allowlists for role-limited routes and client actions.** Middleware/login sends doctor to `/samples`, blocks `/analyst`, `/manager`, and `/profile`, and the client action route permits only doctor-safe reads. Alternative considered: rely on component-level hiding; rejected because route/API access must be explicit.
- **Hide search from doctor.** Global search and search actions are broader discovery surfaces than the Samples-only requirement. Alternative considered: filter global search to completed samples; rejected for v1 to keep the boundary simple and auditable.

## Risks / Trade-offs

- **Enum migration rollback is not trivial** -> Treat adding `doctor` as forward-only and validate locally before production deployment.
- **RLS predicate mistakes could affect analyst/manager visibility** -> Preserve existing analyst/manager policy branches verbatim where possible and add security tests for both existing and doctor behavior.
- **Doctor CoA access crosses table and storage policies** -> Test both `coa_reports` metadata visibility and storage object download through `/api/coa/view`.
- **Removing profile access means doctors cannot change password from the dashboard** -> Keep logout available and leave password/profile workflow out of v1 unless product scope changes.
- **Search hidden for doctor may reduce convenience** -> Prefer strict least privilege for v1; revisit with a dedicated doctor-safe search spec if needed.

## Migration Plan

1. Add a numbered SQL migration with security-impact comments, `ALTER TYPE ... ADD VALUE IF NOT EXISTS 'doctor'`, RLS policy replacements, and new security test helpers.
2. Apply the migration with Docker-backed Postgres and run `SELECT * FROM run_security_tests();`.
3. Update TypeScript role schemas, auth/session helpers, middleware redirects, route/API guards, and doctor-safe UI.
4. Run targeted tests for DB policy behavior, CoA view authorization, Samples read-only rendering, and client action denial.
5. Run `npm run typecheck`, targeted Vitest suites, `npm run test:run`, and `npm run build`.

## Open Questions

- None for v1. The implementation SHALL use `completed` as the DB sample status value and SHALL keep HIV/confidential authorization controlled by `users.can_access_confidential`.

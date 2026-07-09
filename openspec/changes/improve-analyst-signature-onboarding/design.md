## Context

The current signature upload implementation is intentionally self-owned. `uploadSignature` resolves the authenticated user from the current session, stores files under that user's storage folder, and inserts `user_signatures.user_id = auth.uid()`. Live RLS and storage policies also require signature rows and files to belong to the authenticated user.

Manager user creation is a separate workflow. It creates Auth and `public.users` records for the target user, but it does not switch authentication context to the target analyst. Adding a file field to the manager create form would therefore either fail the RLS/storage boundary or incorrectly attach the uploaded file to the manager account.

## Goals / Non-Goals

**Goals:**
- Make analyst signature readiness visible to managers during user management.
- Make the create-analyst flow clearly tell managers that the analyst must upload their own electronic signature after first login.
- Guide analysts without active signatures to the Profile signature upload surface before they attempt signature-gated work.
- Preserve the current-user-only signature ownership model for compliance and implementation simplicity.
- Keep all new UI copy Vietnamese.

**Non-Goals:**
- Do not let managers upload active analyst signatures.
- Do not add a service-role upload proxy, target-user upload API, or new storage/RLS policy.
- Do not change the `user_signatures` table shape unless implementation discovery finds a small read-only status projection is insufficient.
- Do not weaken the existing submit-for-review requirement that analysts must have an active signature.

## Decisions

### Preserve current-user-only signature uploads

The implementation will keep `uploadSignature` as a self-service action. This aligns with the existing RLS/storage policy and avoids a non-repudiation problem where a manager-uploaded file appears to be the analyst's own electronic signature.

Alternative considered: manager uploads the analyst signature during account creation. Rejected for this change because it requires a new privileged target-user upload path, additional audit metadata, and analyst confirmation semantics before the signature can be trusted.

### Treat analyst signature as onboarding readiness, not account creation data

The manager create-user dialog should not collect a signature file for analysts. Instead, it should show an informational message when the selected role is `analyst`, explaining that the analyst must log in and upload their signature from `Hồ sơ` before submitting samples for review.

The user list should show signature readiness for analysts and managers because both roles can own signatures. Doctors should continue to show no signature requirement.

### Use existing user query shape where practical

`getUsers` already joins `user_signatures`. The UI should derive a simple active-signature status from that data for roles that require signatures. If the join returns historical inactive records, the UI must only consider `is_active = true` as ready.

If implementation finds the join is too broad or ambiguous, prefer a narrow server-side projection over new client-side data fetching from the table.

### Keep submit gating explicit

The submit-for-review path already rejects analysts without an active signature. This change should improve pre-submit guidance and error handling, not bypass that guard. Analysts without a signature should see where to fix the problem.

## Risks / Trade-offs

- [Risk] Managers may still expect to upload analyst signatures during creation. → Mitigation: the create dialog and user list must use explicit Vietnamese copy that states the analyst uploads their own signature after login.
- [Risk] The user list could show stale readiness after an analyst uploads a signature. → Mitigation: rely on server revalidation/navigation refresh for the manager list and keep status derived from active signature data.
- [Risk] The profile guidance becomes noisy for analysts who already uploaded a signature. → Mitigation: show onboarding copy only when no active signature is detected or while submit is blocked by missing signature.
- [Risk] Tests overfit to icon implementation. → Mitigation: test accessible labels/text and role-specific status behavior, not specific SVGs.

## Migration Plan

1. Add focused tests for manager user-management UI behavior and analyst missing-signature guidance.
2. Update user-management UI copy/status derivation.
3. Update analyst/profile or submit readiness messaging to point to the signature upload surface.
4. Run focused component/action tests, then `npm run typecheck`.
5. No SQL migration is planned. If implementation changes DB/RLS unexpectedly, add a migration with security checklist coverage and run `run_security_tests()`.

Rollback is a normal app-code revert because the proposed change does not alter database schema or persisted data.

## Open Questions

- Should the manager list expose a role filter or quick filter for analysts missing signatures, or is status visibility enough for this batch?
- Should the first-login analyst guidance be a profile-page banner only, or should the analyst dashboard also include a small blocking notice when signature is missing?

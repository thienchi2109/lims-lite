## 1. Phase 1 RED: Analyst User-Management Prerequisites

- [x] 1.1 Add user-management tests proving managers can toggle `can_access_confidential` only for analyst users and cannot edit manager accounts or env flags.
- [x] 1.2 Add user-management tests proving managers can configure analyst OTP destination email during analyst create/edit and analysts cannot self-change it.
- [x] 1.3 Add tests or fixtures proving Phase 1 does not enforce analyst OTP while `ANALYST_HIV_EMAIL_OTP_ENABLED` is absent or disabled.
- [x] 1.4 Add operational preflight test coverage for identifying analyst HIV users missing OTP destination email.

## 2. Phase 1 Database, UI, and Verification

- [x] 2.1 Inspect live Docker DB for current OTP settings/challenge tables, policies, grants, and existing manager OTP records before writing migrations.
- [x] 2.2 Add migration to introduce user/cohort-neutral OTP settings or compatibility views while preserving existing manager OTP settings.
- [x] 2.3 Add or update RLS policies/RPCs so manager user-management workflows can configure analyst OTP destinations and analyst confidential access without allowing manager-account edits.
- [x] 2.4 Add audit coverage for analyst confidential entitlement changes, analyst OTP destination changes, and analyst OTP lifecycle events without plaintext OTP values.
- [x] 2.5 Update manager user-management create/edit UI for analyst users to set `can_access_confidential`.
- [x] 2.6 Update manager user-management create/edit UI for analyst users to configure OTP destination email with validation and masked display.
- [x] 2.7 Ensure manager UI does not expose editable controls for `ANALYST_HIV_EMAIL_OTP_ENABLED`, `MANAGER_EMAIL_OTP_ENABLED`, or `MANAGER_HIV_EMAIL_OTP_ENABLED`.
- [x] 2.8 Add SQL regression tests for OTP settings access, analyst-only entitlement updates, and manager-account boundary preservation.
- [x] 2.9 Apply Phase 1 migrations through Docker and run `SELECT * FROM run_security_tests();`.
- [x] 2.10 Run Phase 1 focused app tests, `npm run lint`, `npm run typecheck`, and `openspec validate add-analyst-hiv-email-otp-step-up --strict`.

## 3. Phase 2 RED: Analyst HIV OTP Enforcement

- [x] 3.1 Add config/guard tests for `ANALYST_HIV_EMAIL_OTP_ENABLED` with strict `TRUE`/`FALSE`, missing-value disabled behavior, and independence from manager OTP flags.
- [x] 3.2 Add login-action tests proving analyst HIV users redirect to OTP after password login only when the analyst HIV flag is enabled.
- [x] 3.3 Add middleware/API guard tests proving password-only analyst HIV sessions cannot access protected analyst routes/actions while standard analysts and disabled-flag sessions keep current behavior.
- [x] 3.4 Add OTP challenge/verify tests proving analyst HIV uses existing hashed, single-use, rate-limited, lockout-protected OTP behavior.
- [x] 3.5 Add route compatibility tests proving `/manager/otp` remains valid while analyst OTP uses the shared OTP flow.

## 4. Phase 2 Server, UI, and Verification

- [x] 4.1 Generalize OTP cohort classification to support manager standard, manager HIV, and analyst HIV principals.
- [x] 4.2 Add `ANALYST_HIV_EMAIL_OTP_ENABLED` parsing and document its operator-only semantics.
- [x] 4.3 Update login flow so password-authenticated analyst HIV users requiring OTP are redirected to OTP verification before `/analyst`.
- [x] 4.4 Generalize OTP route context, challenge creation, resend, verification, and step-up cookie validation for analyst HIV without regressing manager behavior.
- [x] 4.5 Update logout/session-expiry cleanup so analyst HIV step-up state is cleared with the authenticated session.
- [x] 4.6 Update server action/API guards so password-only analyst HIV sessions are rejected when the flag is enabled.
- [x] 4.7 Add or reuse a shared Vietnamese OTP verification page for manager and analyst HIV users while keeping `/manager/otp` as a compatibility route.
- [x] 4.8 Redirect analyst HIV users to the normal analyst UI after successful OTP verification.
- [x] 4.9 Add Vietnamese guidance for missing OTP email configuration, resend cooldown, lockout, invalid code, expired code, and contact-admin states.
- [x] 4.10 Run focused auth, middleware, OTP, route compatibility, lint, typecheck, and strict OpenSpec validation.

## 5. Phase 3 Route Cleanup Tracking

- [x] 5.1 Keep GitHub issue #66 open during Phase 1 and Phase 2 implementation.
- [x] 5.2 After Phase 2 stabilizes, use issue #66 to decide the canonical shared OTP route.
- [x] 5.3 Preserve or intentionally migrate `/manager/otp` only under issue #66 with explicit tests and documentation.

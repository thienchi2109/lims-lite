## Why

Analyst accounts with HIV/confidential access can currently sign in with password only, even though manager HIV/confidential sessions already support email OTP step-up. This change adds the same post-password OTP control for confidential analysts so operators can protect high-sensitivity analyst access without changing normal analyst UI permissions.

## What Changes

### Phase 1: Analyst user-management prerequisites

- Update user-management UI so managers can turn `can_access_confidential` on/off for analyst users.
- Allow managers to configure the analyst OTP destination email when creating or editing analyst users.
- Keep OTP cohort environment flags outside the app UI; only the superadmin/operator changes env vars during deployment or runtime operations.
- Do not enforce analyst OTP in this phase.

### Phase 2: Analyst HIV OTP enforcement

- Add an `ANALYST_HIV_EMAIL_OTP_ENABLED` environment flag that follows the existing `MANAGER_HIV_EMAIL_OTP_ENABLED` `TRUE`/`FALSE` pattern.
- Require email OTP step-up after successful password login for users with `role = analyst` and `can_access_confidential = true` when the analyst HIV flag is enabled.
- Reuse the existing email OTP challenge, resend, verification, signed step-up cookie, session-expiry cleanup, and delivery behavior where appropriate.
- Generalize manager-named OTP internals only where needed so analyst enforcement does not rely on misleading `manager_*` semantics.
- Route password-authenticated analyst HIV users to a shared OTP UI before showing the normal analyst dashboard.
- Keep the analyst application UI and business permissions unchanged after OTP succeeds.
- Fail closed when analyst HIV OTP is enabled but the user lacks an admin-configured OTP destination email.

### Phase 3: Route cleanup tracking

- Keep `/manager/otp` working as a compatibility alias while tracking shared OTP route unification in a separate GitHub issue.
- Keep all OTP UI copy in Vietnamese and avoid exposing plaintext OTP codes or full OTP destination emails.

## Capabilities

### New Capabilities

- `analyst-hiv-email-otp-step-up`: Analyst HIV/confidential accounts can be required to complete email OTP step-up after password login.

### Modified Capabilities

- `auth-session-management`: Step-up lifecycle and protected-route behavior apply to analyst HIV sessions in addition to manager sessions.
- `user-management-permissions`: Admin-controlled OTP email configuration covers analyst HIV users as well as managers.

## Impact

- **Database:** may require renaming or extending OTP destination metadata from manager-only naming to user/cohort naming, plus migration and RLS/security comments. Existing OTP challenge storage should be reused where possible. Run `run_security_tests()` after any migration.
- **Auth/session:** affects `src/app/actions/auth.ts`, `src/middleware.ts`, OTP step-up cookie validation, logout cleanup, and session-expiry cleanup.
- **Configuration:** adds `ANALYST_HIV_EMAIL_OTP_ENABLED`; existing manager flags remain unchanged.
- **Backend/API:** affects OTP route context, challenge creation/verification authorization, and guarded client/server actions that must reject password-only analyst HIV sessions when the flag is enabled.
- **Frontend:** adds or reuses a Vietnamese OTP verification page for analyst HIV users, then returns them to the normal analyst UI after verification.
- **User management:** managers can manage confidential-access entitlement and OTP destination email for analyst users through audited app workflows, but cannot change env flags from the UI.
- **Compliance/security:** OTP lifecycle events and admin OTP email changes must remain auditable; plaintext OTP values must never be stored, logged, or shown outside the email delivery path.
- **Operations:** operators must configure OTP destination emails for all affected analyst HIV users before enabling the new flag. Route unification will be tracked separately to avoid accidental scope expansion.
- **Roadmap:** Phase 1 prepares analyst entitlement and OTP destination management; Phase 2 enables OTP enforcement behind `ANALYST_HIV_EMAIL_OTP_ENABLED`; Phase 3 is route unification tracked by issue #66.

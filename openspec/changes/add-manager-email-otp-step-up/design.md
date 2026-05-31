## Context

CDC-LIMS currently authenticates users with Supabase email/password and enforces role-based routing in middleware. Managers have higher-risk permissions: result approval, user management, assay administration, and CoA-related operations. The lab environment uses older shared desktops, so passkeys, Bluetooth-based phone passkeys, authenticator apps, and paid phone OTP are not reliable MVP choices.

Email OTP is therefore a pragmatic manager step-up control. It is not phishing-resistant MFA, but it raises the bar above password-only access while fitting current hardware and budget constraints. The OTP email can be personal for the MVP, but it must be configured by an admin and must not be self-service editable by the manager.

## Goals / Non-Goals

**Goals:**

- Require managers to complete email OTP step-up after password login before accessing manager routes or manager-only actions.
- Keep the OTP destination admin-managed, auditable, and separate from manager self-service profile changes.
- Store only hashed OTP challenge values with short TTL, one-time use, resend cooldown, attempt limits, and lockout.
- Preserve the existing Supabase session timebox and clear step-up state on logout/session expiry.
- Provide Vietnamese UI copy for setup, verification, resend, failure, and lockout states.

**Non-Goals:**

- Do not implement TOTP, passkeys, phone OTP, Zalo OTP, or phishing-resistant MFA in this MVP.
- Do not require organization email domains for MVP rollout.
- Do not let managers self-change the OTP destination email.
- Do not replace Supabase authentication or the existing role model.

## Decisions

### Use app-managed email OTP step-up instead of Supabase MFA factors

Supabase MFA natively covers TOTP and phone factors, but the chosen MVP factor is email OTP. The app will manage email OTP challenges and manager step-up state while continuing to use Supabase for first-factor authentication and base session cookies.

Alternatives considered:
- TOTP: stronger and Supabase-native, but requires authenticator app adoption.
- Phone OTP: easier UX, but has recurring provider cost and SIM-swap risk.
- Passkeys: strongest UX/security, but older lab desktops lack Bluetooth/Windows Hello support.

### Admin owns the manager OTP email

The manager OTP destination will be set and changed only through an admin-controlled user-management workflow. The manager can see a masked destination during verification, but cannot edit it from self-service profile screens.

This reduces account-takeover risk where a compromised manager session changes the OTP email before performing privileged actions.

### Step-up state is short-lived and server-verifiable

After OTP verification succeeds, the app will set a server-verifiable manager step-up state tied to the authenticated user/session. The state must expire no later than the base session timebox and must be invalidated on logout, session expiry, role changes, and manager OTP email changes.

Implementation can use a signed, HttpOnly cookie or server-side session table. The implementation plan should choose the smallest option that can be enforced consistently by middleware, server actions, and the client-action API bridge.

### Audit OTP lifecycle events

OTP lifecycle events are security-relevant and must be written to immutable audit logging: challenge creation/send attempt, resend, successful verification, failed verification, expiration, lockout, and admin email changes. Audit records must not include plaintext OTP codes.

## Risks / Trade-offs

- **Email account compromise bypasses the second factor** -> Make the risk explicit in operator documentation and roadmap stronger factors when hardware allows.
- **Email delivery failure blocks manager access** -> Provide resend cooldown, clear Vietnamese error states, and admin recovery/reset procedure.
- **Custom step-up can be bypassed if enforcement is incomplete** -> Enforce in middleware, manager Server Actions, and `/api/client-actions` role guard; add regression tests for route and action denial.
- **OTP code leakage through logs** -> Never log plaintext OTP values; store only hashes and redact all user-facing/audit details.
- **Shared lab desktop sessions linger** -> Tie step-up state to session and clear it on logout/session expiry; preserve the hard timebox behavior.

## Migration Plan

1. Add database structures for admin-managed OTP email metadata and hashed OTP challenges, with RLS/security comments and audit coverage.
2. Add server-side OTP generation, hashing, send, verify, resend, lockout, and cleanup paths.
3. Add middleware and API/server-action guards that require manager step-up before manager access.
4. Add Vietnamese UI for manager OTP verification and admin email configuration.
5. Apply migrations via Docker, run `run_security_tests()`, run focused regression tests, `npm run typecheck`, and strict OpenSpec validation.

Rollback: disable the manager step-up guard behind configuration or revert the middleware/API guard changes while keeping audit/challenge tables inert until a cleanup migration is approved.

## Open Questions

- Which SMTP provider and sender identity will production use for OTP delivery?
- Should the step-up window last until the base session expires, or use a shorter window such as 30-60 minutes for privileged manager actions?
- Should failed OTP lockout notify admins immediately, or only appear in audit/reporting for MVP?

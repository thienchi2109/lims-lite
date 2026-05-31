## Why

Manager accounts can approve results, manage users, and perform other high-impact LIMS actions, but today a password-only login is enough to reach manager surfaces. Lab desktops do not reliably support passkeys, Bluetooth, authenticator apps, or paid phone OTP, so the MVP needs a practical step-up check that works with existing hardware.

## What Changes

- Add an email OTP step-up requirement for users with role `manager` after successful password login.
- Gate the requirement with environment flags so operators can enable email OTP independently for standard managers and managers with HIV/confidential access.
- Allow personal email addresses for the MVP, but require the OTP destination email to be configured and changed only by an admin-controlled workflow.
- Prevent managers from self-changing the OTP email without admin approval.
- Store OTP challenges server-side as hashed, single-use, short-lived records with retry limits, resend cooldown, and lockout behavior.
- Set a server-verifiable manager step-up state only after OTP verification succeeds, and require it before allowing manager routes and manager-only mutations.
- Audit OTP send, verify success, verify failure, expiration, lockout, and admin email changes.
- Keep all UI copy in Vietnamese and clearly explain that the email OTP is an additional verification step.

## Capabilities

### New Capabilities
- `manager-email-otp-step-up`: Requires configured manager cohorts to complete an admin-managed email OTP step-up before accessing manager capabilities.

### Modified Capabilities
- `auth-session-management`: Manager session access now depends on a valid email OTP step-up state in addition to the existing hard session timebox.

## Impact

- **Database:** likely adds manager OTP destination metadata, OTP challenge storage, step-up state tracking or signed-cookie support, and audit records. Migrations must document security impact, preserve RLS, avoid hard deletes, and run `run_security_tests()`.
- **Auth/session:** affects `src/app/actions/auth.ts`, `src/middleware.ts`, `src/lib/dashboard-session.ts`, session-expiry behavior, and logout/session cleanup.
- **Configuration:** adds explicit `TRUE`/`FALSE` environment flags for standard managers and HIV/confidential managers. In this repo, "manager-hiv" maps to `role = manager` plus `can_access_confidential = true`, not a separate role.
- **Backend/API:** affects manager-only Server Actions and the `/api/client-actions` role guard so password-only manager sessions cannot perform manager actions.
- **Frontend:** adds Vietnamese enrollment/verification screens for manager email OTP and an admin-managed user email configuration path.
- **Compliance/security:** all OTP challenge lifecycle events and admin email changes must be auditable; OTP values must never be stored in plaintext or logged.
- **Operations:** requires production SMTP/email delivery configuration and monitoring for failed sends. Email OTP is accepted as an MVP step-up mechanism, not as phishing-resistant MFA.

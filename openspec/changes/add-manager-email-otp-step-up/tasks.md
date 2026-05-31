## 1. RED: Tests and Contracts First

- [x] 1.1 Add failing tests for manager password login redirecting to email OTP verification before `/manager` access.
- [x] 1.2 Add failing middleware/API guard tests proving password-only manager sessions cannot access manager routes or manager-only client actions.
- [x] 1.3 Add failing configuration tests for all four manager/manager-hiv flag combinations.
- [x] 1.4 Add failing OTP challenge tests for hash-only storage, five-minute TTL, single-use verification, resend cooldown, attempt limit, and lockout.
- [x] 1.5 Add failing admin user-management tests proving admins can configure manager OTP email and managers cannot self-change it.
- [x] 1.6 Add failing audit tests for OTP send, resend, verify success, verify failure, expiration, lockout, and admin email changes.

## 2. Database and Audit Model

- [ ] 2.1 Add migration for admin-managed manager OTP email metadata with security-impact comments, RLS/role checks, and no self-service manager update path.
- [ ] 2.2 Add migration for OTP challenge storage with hashed code, expiration, used/locked status, attempt counters, resend tracking, and cleanup support.
- [ ] 2.3 Add audit-log RPC or server action integration for OTP lifecycle events and admin OTP email changes without plaintext OTP values.
- [ ] 2.4 Add SQL regression coverage for RLS, role boundaries, challenge lifecycle, and audit behavior.

## 3. Server-Side OTP and Step-Up Enforcement

- [ ] 3.1 Add strict environment flag parsing for `MANAGER_EMAIL_OTP_ENABLED` and `MANAGER_HIV_EMAIL_OTP_ENABLED`.
- [ ] 3.2 Add manager cohort resolution for standard managers and managers with `can_access_confidential = true`.
- [ ] 3.3 Add OTP generation, hashing, verification, resend, expiration, and lockout helpers with strict TypeScript and zod validation.
- [ ] 3.4 Add an app-owned email delivery adapter for OTP messages with Resend as the production default, Vietnamese message content, and a non-sending test/local adapter.
- [ ] 3.5 Add manager step-up state creation, validation, and invalidation tied to the authenticated session.
- [ ] 3.6 Update logout/session-expiry paths to clear manager step-up state.
- [ ] 3.7 Update middleware to redirect password-only manager sessions to the OTP verification flow only when their cohort flag is enabled.
- [ ] 3.8 Update server actions and `/api/client-actions` role guard to deny manager-only operations without valid step-up state only when the user's cohort flag is enabled.

## 4. Vietnamese UI and Admin Workflow

- [ ] 4.1 Add manager OTP verification page with masked email display, code input, resend cooldown, error states, and lockout messaging in Vietnamese.
- [ ] 4.2 Add admin-controlled manager OTP email configuration in the existing user-management flow.
- [ ] 4.3 Ensure manager self-service profile screens cannot edit the OTP destination email and show contact-admin guidance.
- [ ] 4.4 Add accessible loading, success, failure, and expired-code states without exposing sensitive email details.

## 5. Verification and Rollout

- [ ] 5.1 Apply migrations through Docker and run `SELECT * FROM run_security_tests();`.
- [ ] 5.2 Run focused SQL regression tests for OTP metadata, challenge lifecycle, RLS, and audit behavior.
- [ ] 5.3 Run focused app tests for login redirect, OTP verification, manager route guard, client-action guard, environment flag combinations, admin email configuration, and manager self-service denial.
- [ ] 5.4 Run `npm run lint` and `npm run typecheck`.
- [ ] 5.5 Validate OpenSpec with `openspec validate add-manager-email-otp-step-up --strict`.
- [ ] 5.6 Document operational requirements for Resend API key, verified sender/domain, quota monitoring, admin recovery, email-change review, and the MVP limitation that email OTP is not phishing-resistant MFA.

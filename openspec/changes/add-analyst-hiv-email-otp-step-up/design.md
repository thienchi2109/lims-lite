## Context

The current email OTP step-up implementation protects manager sessions after password login. It uses cohort flags, server-side challenge records, email delivery through the app adapter, and a signed step-up cookie before granting access to manager surfaces. Analyst accounts with `can_access_confidential = true` do not participate in this flow today, even though they can access HIV/confidential workflows after password login.

The requested change is to apply the same login and OTP verification pattern to analyst HIV/confidential users without changing the normal analyst UI or permissions after verification succeeds. Route cleanup is intentionally tracked separately in GitHub issue #66 so the enforcement work does not expand into a route-renaming migration.

Delivery should be phased:

1. Phase 1 prepares manager-controlled analyst user-management fields without enforcing OTP.
2. Phase 2 adds analyst HIV OTP enforcement behind `ANALYST_HIV_EMAIL_OTP_ENABLED`.
3. Phase 3 cleans up shared route naming and compatibility through issue #66.

## Goals / Non-Goals

**Goals:**

- Add `ANALYST_HIV_EMAIL_OTP_ENABLED` with the same strict `TRUE`/`FALSE` semantics as `MANAGER_HIV_EMAIL_OTP_ENABLED`.
- Require email OTP after successful password login for `role = analyst` plus `can_access_confidential = true` when the analyst HIV flag is enabled.
- Reuse the existing challenge, delivery, resend, verification, lockout, and signed step-up cookie behavior where practical.
- Keep analyst UI behavior unchanged after OTP succeeds: users land in the normal analyst experience and all existing role/business permissions continue to apply.
- Let managers manage the confidential-access entitlement and analyst OTP destination email for analyst users.
- Keep environment-flag control out of the app UI; only the superadmin/operator changes OTP flags.
- Fail closed when the analyst HIV cohort is enabled but no OTP destination email is configured.
- Keep `/manager/otp` compatible while adding a shared OTP route or alias path for analyst use.

**Non-Goals:**

- Do not add OTP for standard analysts.
- Do not change manager OTP semantics or existing manager-HIV cohort flags.
- Do not implement TOTP, passkeys, SMS, Zalo OTP, Supabase MFA factors, or phishing-resistant MFA.
- Do not redesign analyst permissions, confidential data access rules, or post-login dashboard behavior.
- Do not add any in-app control for `ANALYST_HIV_EMAIL_OTP_ENABLED`, `MANAGER_HIV_EMAIL_OTP_ENABLED`, or other env flags.
- Do not complete route unification or remove `/manager/otp`; that cleanup is tracked in issue #66.

## Decisions

### Add an analyst-HIV cohort flag, not a generic analyst flag

The new flag will be `ANALYST_HIV_EMAIL_OTP_ENABLED`. It mirrors `MANAGER_HIV_EMAIL_OTP_ENABLED` and maps to `role = analyst` plus `can_access_confidential = true`. Missing or empty values should default to disabled, while configured values must be exactly `TRUE` or `FALSE`.

Alternative considered: `ANALYST_CONFIDENTIAL_EMAIL_OTP_ENABLED`. That name is more descriptive, but it diverges from the existing manager-HIV operator pattern and makes env audits less consistent.

### Generalize OTP context without changing the security model

The implementation should extract a shared OTP step-up concept that supports manager and analyst-HIV principals. The shared context should include user id, session id, role, cohort, confidential flag, OTP email metadata timestamp, and intended post-verify destination. Existing challenge hashing, TTL, resend cooldown, attempt limits, lockout behavior, and signed-cookie verification should remain the source pattern.

Alternative considered: copy the manager OTP code and add analyst branches. That is faster but creates duplicated security code and locks analyst behavior to misleading manager-only names.

### Keep post-OTP analyst experience unchanged

Password login will continue to authenticate through Supabase password auth. After that succeeds, the app will evaluate OTP requirements. An analyst-HIV user requiring OTP should be redirected to OTP verification, and after success redirected to the normal analyst destination. No analyst menu, route, or business permission should be widened by this change.

### Use admin-managed OTP destination metadata for analyst-HIV users

The OTP destination should remain admin-managed and separate from self-service profile edits. Managers should be able to configure the analyst OTP destination email when creating or editing analyst users. The existing boundary that managers cannot modify other manager accounts remains unchanged and out of scope. Existing `manager_otp_settings` naming should be generalized or replaced with a user/cohort-neutral table or view before analyst support is enabled. Existing manager settings must be migrated or bridged without losing current manager behavior.

Alternative considered: use `public.users.email` directly at verification time. That is simpler but removes the admin-reviewed OTP destination boundary used by manager OTP and makes email login changes implicitly alter OTP delivery.

### Let managers control user confidential access, but not env flags

Managers should be able to turn `can_access_confidential` on or off for analyst users through the user-management UI and server actions. This is analyst entitlement management, not runtime feature-flag control. The `ANALYST_HIV_EMAIL_OTP_ENABLED` flag remains an operator/superadmin deployment setting and must not be editable from the app.

Alternative considered: expose the analyst OTP flag in the manager UI. That would blur operational rollout control with user administration and could let an app user disable a security control globally.

### Preserve manager route compatibility and track route unification separately

The preferred user-facing OTP route should be shared for manager and analyst-HIV users, but `/manager/otp` must keep working as a redirect or compatibility alias during rollout. GitHub issue #66 tracks final route naming, docs, tests, and removal or permanent redirect decisions.

## Risks / Trade-offs

- **Risk: manager OTP regression while generalizing shared code** -> Mitigation: lock current manager login redirect, middleware, OTP challenge, verify, logout, and session-expiry behavior with focused tests before changing internals.
- **Risk: misleading manager-only table names cause future mistakes** -> Mitigation: include a migration or compatibility layer that introduces user/cohort-neutral naming for OTP settings.
- **Risk: enabling the flag before analyst OTP emails are configured locks users out** -> Mitigation: document fail-closed behavior, add preflight query/runbook, and keep the flag disabled until all target users have OTP settings.
- **Risk: managers confuse user entitlement toggles with global OTP enablement** -> Mitigation: keep env flag state out of editable UI and label OTP destination settings as per-user configuration only.
- **Risk: password-only analyst sessions can still call APIs if only the page is gated** -> Mitigation: enforce step-up in middleware and in protected action/API guards for affected analyst-HIV sessions.
- **Risk: route cleanup expands scope** -> Mitigation: keep `/manager/otp` compatible and defer canonical route cleanup to issue #66.

## Migration Plan

Phase 1: analyst user-management prerequisites

1. Add tests proving the current manager OTP behavior and new analyst-HIV requirements before implementation.
2. Add or migrate OTP settings to user/cohort-neutral metadata while preserving existing manager records.
3. Add manager user-management controls for analyst `can_access_confidential` and analyst OTP email configuration, without any env flag editing UI.
4. Add a preflight query/runbook to identify analyst HIV users missing OTP destination email.
5. Apply any Phase 1 migrations through Docker, run `SELECT * FROM run_security_tests();`, focused SQL tests, focused app tests, `npm run lint`, `npm run typecheck`, and strict OpenSpec validation.

Phase 2: analyst HIV OTP enforcement

1. Add `ANALYST_HIV_EMAIL_OTP_ENABLED` parsing and cohort classification.
2. Generalize OTP route context, challenge creation, verification, step-up cookie, and guard checks for manager and analyst-HIV cohorts.
3. Add shared OTP UI routing while keeping `/manager/otp` compatible.
4. Enforce login redirect, middleware, action/API guards, logout cleanup, and session-expiry cleanup for analyst HIV sessions.
5. Run focused auth, middleware, OTP, user-management, route-compatibility, lint, typecheck, and OpenSpec validation.

Phase 3: route unification cleanup

1. Track canonical route naming, redirect policy, docs, and stale manager-only route cleanup in GitHub issue #66.
2. Do not block Phase 1 or Phase 2 acceptance on completing route cleanup.

Production rollout:

1. Deploy with `ANALYST_HIV_EMAIL_OTP_ENABLED=FALSE`.
2. Complete Phase 1 user-management and configure OTP destination emails for all analyst-HIV users.
3. Verify the preflight query returns no missing analyst-HIV OTP destinations.
4. Deploy Phase 2 enforcement with the flag still disabled.
5. Verify OTP delivery with a test or small controlled account set.
6. Enable `ANALYST_HIV_EMAIL_OTP_ENABLED=TRUE`.
7. Monitor OTP delivery failures, lockouts, audit logs, and support tickets.

Rollback: set `ANALYST_HIV_EMAIL_OTP_ENABLED=FALSE`. Keep metadata and challenge tables inert until cleanup is explicitly approved.

## Open Questions

- None blocking. Route unification after rollout is tracked in GitHub issue #66.

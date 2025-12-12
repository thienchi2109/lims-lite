## Why

CDC-LIMS needs a hard re-authentication interval for compliance and security. Today, users can remain signed in across days without re-login.

Root cause:
- GoTrue refresh token expiry is **sliding** (based on `auth.refresh_tokens.updated_at`), so an active browser session can continuously refresh.
- `@supabase/ssr` cookie storage uses a long cookie max-age by default, so the session cookie itself does not force a logout window.

This means “refresh token expiry = 4 hours” does **not** guarantee “session lifetime = 4 hours”.

## What Changes

- Enforce an **absolute** session timebox of **4 hours** (configurable, default 14400 seconds) for authenticated browser sessions (analyst + manager).
- Add **server-side enforcement** in Next.js `middleware.ts` by:
  - Reading the current access token, extracting `session_id` (JWT claim).
  - Looking up `auth.sessions.created_at` for that `session_id` using a service-role client.
  - Forcing sign-out + cookie clearing + redirect to `/login` once `now - created_at > 4h`.
- Add **client-side enforcement** for already-open dashboards (and for pages that call Supabase directly from the browser):
  - A dashboard-scoped client guard queries an app endpoint for the authoritative session expiry time.
  - It schedules a timer to force sign-out + redirect exactly when the timebox elapses.
- Improve UX: show a **Vietnamese** message on the login page when the redirect is due to session timeout (e.g., `?reason=session_expired`).
- Document the new session policy and configuration knobs.

**BREAKING**: Users will be forced to re-login after 4 hours, even if they are actively using the app.

## Impact

**Affected specs**
- New capability: `auth-session-management` (hard session timebox + timeout UX)

**Affected code (expected)**
- `src/middleware.ts` (timebox enforcement + redirect reason)
- `src/lib/supabase/*` (edge-safe service-role client helper for middleware)
- `src/app/(auth)/login/page.tsx` (session-expired UX message)

**Affected docs/tests (expected)**
- `docs/test-token-expiry.md` (clarify sliding refresh token expiry vs hard timebox)
- `docs/DOCKER_SETUP.md` and/or `env.md` (new env var)
- `tests/check_tokens.sql` (add visibility into session age/timebox)

## Risks / Trade-offs

- **Extra DB read in middleware**: one additional query (by `session_id`) to determine `created_at`. Mitigate by only running when a user is authenticated and the request targets protected routes.
- **Clock skew**: use DB-derived timestamps (from `auth.sessions.created_at`) as the source of truth; compare with server time consistently.
- **Edge runtime constraints**: middleware runs on the Edge runtime; any service-role helper imported by middleware must be edge-compatible (no `next/headers`, no Node-only APIs).

## Alternatives Considered

1. **Rely on `GOTRUE_REFRESH_TOKEN_EXPIRY=14400`**
   - Rejected: refresh-token expiry is sliding; active sessions can extend indefinitely.

2. **Enable GoTrue time-boxed sessions**
   - Attractive if available in the self-hosted config, but still requires app-side UX and may not guarantee strict “logout at 4h” if access tokens can outlive the cutoff. Can be pursued later as defense-in-depth.

## Acceptance Criteria

- A user who signed in more than 4 hours ago is redirected to `/login` on the next protected request, without requiring manual logout.
- Active usage does not extend the session past 4 hours.
- An already-open dashboard tab is forced to log out once the timebox elapses (no “stay logged in until refresh” behavior).
- Login page displays a Vietnamese message indicating the session expired (no scary technical details).
- Configuration is documented and adjustable via environment variables.

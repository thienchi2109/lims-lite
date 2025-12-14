## Context
- The app uses `@supabase/ssr` with cookie-based sessions.
- Middleware calls `supabase.auth.getUser()` which will refresh tokens as needed.
- GoTrue refresh token expiry (`GOTRUE_REFRESH_TOKEN_EXPIRY`) behaves as an inactivity timeout (sliding window), so it does not enforce a maximum session lifetime.

## Goal
Enforce an **absolute** session lifetime of 4 hours for authenticated browser sessions, regardless of activity or token refresh.

## Decision: Enforce timebox in middleware using `auth.sessions.created_at`
- Decode the current access token and read the `session_id` claim (stable across token refresh for a session).
- Use a service-role Supabase client to read `auth.sessions.created_at` for that `session_id`.
- Treat `created_at` as the authoritative “session start time”.
- If session age exceeds the configured timebox:
  - Call `signOut()` (best-effort revocation) and clear cookies.
  - Redirect to `/login?reason=session_expired`.

This avoids relying on GoTrue refresh token rotation semantics and prevents “keep-alive forever” behavior.

## Decision: Enforce timebox client-side for already-open dashboards
Some screens call Supabase directly from the browser (bypassing Next.js middleware once the page is loaded). To ensure “logout after 4 hours no matter what”:
- Add an app endpoint (server-side) that returns the authoritative session expiry time derived from `auth.sessions.created_at` + configured timebox.
- Add a dashboard-scoped client component that calls this endpoint and schedules a forced logout + redirect when the expiry is reached.

## Edge Runtime Constraints
- `src/middleware.ts` runs on the Edge runtime.
- Any helper imported by middleware must not import `next/headers` or other Node-only APIs.
- Use `@supabase/supabase-js` (fetch-based) for the service-role client, configured with `autoRefreshToken: false` and `persistSession: false`.

## UX
- The login page reads `reason=session_expired` and shows a Vietnamese message indicating the session ended and the user must re-authenticate.

## Risks
- Adds one extra query for authenticated requests. Scope checks to protected routes to reduce overhead.
- Ensure failures to read `auth.sessions` are handled conservatively (prefer logout over silently extending sessions).

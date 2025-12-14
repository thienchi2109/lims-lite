# Session / Token Expiry Test Guide

## Why this document exists
Supabase Auth has multiple “timers” that can be confused:

- **Access token (JWT)** expiry (e.g. 1 hour): refreshed automatically when a valid refresh token exists.
- **Refresh token** expiry (`GOTRUE_REFRESH_TOKEN_EXPIRY`): in self-hosted GoTrue this behaves like a **sliding inactivity window** (based on `auth.refresh_tokens.updated_at`), so active sessions can keep extending.
- **Hard session timebox** (`SESSION_TIMEBOX_SECONDS`): an **absolute** max session lifetime (default 4 hours) enforced by the app, regardless of activity.

This project requires the hard timebox for compliance/security: “active usage does not extend the session past 4 hours”.

## Configuration summary

| Concept | Where configured | Example |
|---|---|---|
| Access token expiry | GoTrue (`GOTRUE_JWT_EXP`) | 3600 seconds |
| Refresh token expiry (sliding) | GoTrue (`GOTRUE_REFRESH_TOKEN_EXPIRY`) | 14400 seconds |
| Hard session timebox (absolute) | Next.js app (`SESSION_TIMEBOX_SECONDS`) | 14400 seconds |

Notes:
- Setting refresh-token expiry to 4h does **not** guarantee the user is logged out at 4h if the session is active.
- The app enforces the hard timebox using the session’s `created_at` (and falls back to `auth.users.last_sign_in_at` if needed).

## What “hard timebox” should look like
- When session age crosses `SESSION_TIMEBOX_SECONDS`, the user is forced to log in again.
- Already-open dashboard tabs are logged out at the expiry time (no “stay logged in until refresh”).
- API calls after expiry return `401` with a clear Vietnamese message and `reason=session_expired`.

## Manual verification (recommended)

### 1) Fast smoke test (set a short timebox)
1. Set `SESSION_TIMEBOX_SECONDS=30` (or `60`) for the Next.js app runtime.
2. Restart the Next.js app.
3. Log in and open an analyst/manager dashboard route.
4. Wait > `SESSION_TIMEBOX_SECONDS` without refreshing.
5. Expected: the dashboard tab auto-redirects to `/login?reason=session_expired`.

### 2) Protected-route enforcement (middleware)
1. Log in.
2. Wait > `SESSION_TIMEBOX_SECONDS`.
3. Navigate to any protected route (e.g. `/analyst`, `/manager`).
4. Expected: redirect to `/login?reason=session_expired` and auth cookies cleared.

### 3) Server actions / API calls after expiry
1. Log in and open a dashboard page that triggers server actions (or triggers API calls to `/api/*`).
2. Wait > `SESSION_TIMEBOX_SECONDS`.
3. Trigger an action.
4. Expected:
   - `/api/*` returns `401` JSON with `reason=session_expired`.
   - The client redirects the user to `/login?reason=session_expired`.

### 4) Direct Supabase calls from the browser (open tab)
1. Log in, open 2 dashboard tabs.
2. Wait > `SESSION_TIMEBOX_SECONDS`.
3. Expected:
   - Both tabs are forced to sign out (via the dashboard guard + cross-tab broadcast).
   - Both end up on `/login` (the expired reason should be present for the expired timebox path).

## Authoritative “expiry” endpoint (server-derived)
The dashboard guard reads:
- `GET /api/auth/session-expiry`

Expected response (when authenticated):
```json
{
  "authenticated": true,
  "timebox_seconds": 14400,
  "expires_at": "2025-01-01T00:00:00.000Z",
  "expires_in_ms": 123456,
  "source": "sessions.created_at"
}
```

## Database inspection
Use `tests/check_tokens.sql` to inspect:
- session age (`auth.sessions.created_at`)
- refresh-token sliding behavior (`auth.refresh_tokens.updated_at`)
- derived “expires_at” values using the same timebox seconds you configured

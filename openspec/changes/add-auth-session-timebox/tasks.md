## 1. Configuration
- [x] 1.1 Define `SESSION_TIMEBOX_SECONDS` (default `14400`) for the Next.js app runtime
- [x] 1.2 Document the new setting in `docs/DOCKER_SETUP.md` (and/or `env.md`)

## 2. Middleware Enforcement (Hard Timebox)
- [x] 2.1 Create an edge-safe service-role Supabase client helper usable from middleware
- [x] 2.2 Decode the access token in middleware and extract the `session_id` JWT claim
- [x] 2.3 Query `auth.sessions` by `session_id` to get `created_at`
- [x] 2.4 If `now - created_at > SESSION_TIMEBOX_SECONDS`: sign out, clear auth cookies, redirect to `/login?reason=session_expired`
- [x] 2.5 Ensure existing role redirects still work (analyst vs manager)

## 3. Client Enforcement (Open Tabs + Direct Supabase Calls)
- [ ] 3.1 Add an app endpoint that returns the authoritative session expiry timestamp for the current session
- [ ] 3.2 Add a dashboard-scoped client guard that schedules forced logout at the expiry time

## 4. Login UX
- [ ] 4.1 Update `/login` to show a Vietnamese “session expired, please log in again” message when `reason=session_expired`

## 5. Docs & Verification
- [ ] 5.1 Update `docs/test-token-expiry.md` to explain “sliding refresh expiry” vs “hard session timebox”
- [ ] 5.2 Update `tests/check_tokens.sql` to display session age and validate timebox enforcement inputs
- [ ] 5.3 Manual verification: login, advance time > 4h, confirm redirect on protected routes and on server actions/API calls

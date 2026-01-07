# Prevent Concurrent Login Sessions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce single active session per user - when a user logs in, automatically invalidate all their existing sessions to prevent credential sharing and concurrent access.

**Architecture:** Add database RPC function to delete sessions from `auth.sessions` table (excluding a specified session). Modify login action to call this RPC AFTER successful authentication to invalidate OTHER sessions while keeping the newly created one. Leverage existing middleware and client-side guards to handle logout of invalidated sessions.

---

## Security Review Findings (2026-01-05)

| Issue | Severity | Resolution |
|-------|----------|------------|
| Wrong migration number (102 exists) | CRITICAL | Use `110_prevent_concurrent_sessions.sql` |
| Pre-auth DoS (invalidate before password check) | CRITICAL | Move invalidation AFTER signInWithPassword() |
| Dual login race condition | MEDIUM | Exclude current session from invalidation |
| Missing audit log | MEDIUM | Add audit entry for 21 CFR Part 11 |

**Key Change:** Invalidate OTHER sessions AFTER authentication, not before.

**Tech Stack:** PostgreSQL RPC (plpgsql), Supabase Admin Client, Next.js Server Actions

---

## Current State Analysis

### Authentication Flow
- **Login:** `src/app/actions/auth.ts:login()` - Uses `signInWithPassword()`
- **Session Storage:** Supabase GoTrue `auth.sessions` table
- **Token Expiry:** Access tokens 1h, Refresh tokens 4h
- **Session Tracking:** `get_session_created_at()` RPC reads session timestamp

### Session Enforcement
- **Middleware:** `src/middleware.ts:64-138` - Enforces 4h absolute timebox, validates sessions
- **Client Guard:** `src/components/auth/session-timebox-guard.tsx` - Auto-logout on expiry
- **Auth Helpers:** `src/lib/auth-helpers.ts` - `requireAuth()`, `requireRole()`

### Problem
✅ Sessions expire after 4 hours (working)
✅ Invalid sessions trigger logout (working)
❌ **No prevention of concurrent logins** - Same user can have multiple active sessions

---

## Task 1: Create Database Migration for Session Invalidation RPC

**Files:**
- Create: `supabase/migrations/XXX_prevent_concurrent_sessions.sql`

**Step 1: Determine migration number**

Run: `powershell -Command "Get-ChildItem -Path 'supabase\migrations\' -Filter '*.sql' | Sort-Object Name | Select-Object -Last 1 | ForEach-Object { $_.Name }"`

Expected: Output shows `109_add_service_role_signature_policy.sql`
Action: Next number is **110**

**Step 2: Create migration file**

File: `supabase/migrations/110_prevent_concurrent_sessions.sql`

```sql
-- Migration 110: Prevent concurrent login sessions
-- Security Impact: Medium
-- Changes: Add SECURITY DEFINER RPC to invalidate all sessions for a user by deleting from auth.sessions

SET search_path TO public;

-- Ensure service_role exists (should already exist from migration 054)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;
END;
$$;

GRANT USAGE ON SCHEMA public TO service_role;

-- Drop existing function if exists
DROP FUNCTION IF EXISTS public.invalidate_other_user_sessions(UUID, UUID);

-- Create function to invalidate all sessions for a user EXCEPT the current one
-- This prevents DoS attacks where attacker invalidates sessions without knowing password
CREATE OR REPLACE FUNCTION public.invalidate_other_user_sessions(
    p_user_id UUID,
    p_keep_session_id UUID  -- The session to keep (just created by login)
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
    session_count INTEGER;
BEGIN
    -- Count OTHER sessions before deletion (excluding current)
    SELECT COUNT(*) INTO session_count
    FROM auth.sessions
    WHERE user_id = p_user_id
      AND id != p_keep_session_id;

    -- Delete all OTHER sessions for this user (keep current session)
    -- This forces logout on their next request
    DELETE FROM auth.sessions
    WHERE user_id = p_user_id
      AND id != p_keep_session_id;

    RETURN session_count;
END;
$$;

-- Security: Only service_role can execute
REVOKE ALL ON FUNCTION public.invalidate_other_user_sessions(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invalidate_other_user_sessions(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.invalidate_other_user_sessions(UUID, UUID)
IS 'Invalidates all active sessions for a user EXCEPT the specified session. Used to prevent concurrent logins after successful authentication. Returns count of sessions deleted.';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
```

**Step 3: Apply migration**

Run: `powershell -Command "Get-Content supabase\migrations\110_prevent_concurrent_sessions.sql | docker exec -i lims-postgres psql -U postgres -d postgres"`

Expected: Output ending with:
```
SET
DO
GRANT
DROP FUNCTION
CREATE FUNCTION
REVOKE
GRANT
COMMENT
NOTIFY
```

**Step 4: Verify function creation**

Run: `docker exec lims-postgres psql -U postgres -d postgres -c "\df public.invalidate_other_user_sessions"`

Expected: Function listed with signature `invalidate_other_user_sessions(uuid, uuid)`

**Step 5: Restart PostgREST to reload schema**

Run: `docker compose restart rest`

Expected: Container restarts successfully
```
Restarting lims-rest ... done
```

**Step 6: Test RPC function manually**

Run:
```bash
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT public.invalidate_user_sessions('00000000-0000-0000-0000-000000000000'::UUID);"
```

Expected: Returns `0` (no sessions found for fake UUID)

**Step 7: Commit migration**

```bash
git add supabase/migrations/110_prevent_concurrent_sessions.sql
git commit -m "feat(auth): add RPC to invalidate other user sessions for concurrent login prevention"
```

---

## Task 2: Modify Login Action to Invalidate Other Sessions

**Files:**
- Modify: `src/app/actions/auth.ts:51-72` (after signInWithPassword, before redirect)

**Step 1: Read current login action**

Read: `src/app/actions/auth.ts` lines 1-80

**Step 2: Add session invalidation AFTER signInWithPassword succeeds**

Location: After line 60 (after successful login check), before line 63 (getting user role)

**IMPORTANT:** This must be AFTER authentication to prevent DoS attacks.

Add this code after `if (error) { return { error: ... } }` block:

```typescript
    // Prevent concurrent sessions: invalidate all OTHER sessions for this user
    // SECURITY: This runs AFTER successful authentication to prevent DoS
    try {
        const adminClient = createAdminClient()

        // Get session ID from the just-created session
        const sessionId = data.session?.id

        if (data.user.id && sessionId) {
            // Invalidate all OTHER sessions, keeping the current one
            await adminClient.rpc('invalidate_other_user_sessions', {
                p_user_id: data.user.id,
                p_keep_session_id: sessionId
            })
        }
    } catch (error) {
        // Log error but don't block login
        // If session invalidation fails, login still succeeds
        console.error('Failed to invalidate other sessions:', error)
    }

```

**Step 3: Verify imports**

Check if `createAdminClient` is already imported on line 3.

Expected: Already imported (used on line 35 for username resolution)

**Step 4: Verify modified file compiles**

Run: `npm run typecheck`

Expected: No errors in `src/app/actions/auth.ts`

**Step 5: Commit the change**

```bash
git add src/app/actions/auth.ts
git commit -m "feat(auth): invalidate other sessions after login to prevent concurrent access

SECURITY: Invalidation happens AFTER successful authentication
to prevent DoS attacks where attacker logs out users without password."
```

---

## Task 3: Test Concurrent Login Prevention

**Files:**
- Test manually (no new files)

**Step 1: Start development server**

Run: `npm run dev`

Expected: Server starts on http://localhost:3000

**Step 2: Open first browser session**

1. Open Chrome in normal mode
2. Navigate to http://localhost:3000
3. Login as `analyst` / password from your system
4. Verify redirect to `/analyst` dashboard
5. Note the page loads successfully

**Step 3: Check auth.sessions table - should have 1 session**

Run:
```bash
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT id, user_id, created_at FROM auth.sessions WHERE user_id = (SELECT id FROM auth.users WHERE email = 'analyst@cdc-lims.local') ORDER BY created_at DESC;"
```

Expected: 1 row with recent `created_at` timestamp

**Step 4: Open second browser session**

1. Open Chrome in incognito mode (or different browser)
2. Navigate to http://localhost:3000
3. Login as `analyst` / same password
4. Verify redirect to `/analyst` dashboard
5. Note the page loads successfully

**Step 5: Check auth.sessions table - should still have only 1 session**

Run same query as Step 3

Expected: 1 row with NEW `created_at` timestamp (newer than Step 3)
This confirms old session was deleted and new one created

**Step 6: Verify first browser was logged out**

1. Switch back to first browser (normal mode)
2. Try to navigate to any dashboard page (e.g., click "Samples" link)
3. Or just refresh the page

Expected: Redirected to `/login` page (session invalidated by middleware)

**Step 7: Verify second browser still works**

1. Switch to second browser (incognito)
2. Navigate around dashboard (Samples, Accession, etc.)

Expected: All pages load normally, user remains logged in

**Step 8: Test with manager role**

Repeat steps 2-7 but login as `manager` user

Expected: Same behavior - only one active session, previous session logged out

**Step 9: Document test results**

Create: `docs/test-concurrent-login.md`

```markdown
# Concurrent Login Prevention - Test Results

**Date:** 2026-01-05
**Tested by:** [Your name]

## Test Scenario: Analyst Account

1. ✅ First login creates session in auth.sessions
2. ✅ Second login invalidates first session
3. ✅ Only 1 session exists in database after second login
4. ✅ First browser redirected to /login on next request
5. ✅ Second browser remains logged in and functional

## Test Scenario: Manager Account

1. ✅ First login creates session in auth.sessions
2. ✅ Second login invalidates first session
3. ✅ Only 1 session exists in database after second login
4. ✅ First browser redirected to /login on next request
5. ✅ Second browser remains logged in and functional

## Edge Cases Tested

- ✅ Multiple rapid logins (click login twice) - Last session wins
- ✅ Login after session expiry - Works normally
- ✅ Invalid credentials - Error message, no session created

## Conclusion

Concurrent login prevention working as designed. Last login invalidates all previous sessions for that user.
```

**Step 10: Commit test documentation**

```bash
git add docs/test-concurrent-login.md
git commit -m "docs: add concurrent login prevention test results"
```

---

## Task 4: Verify Edge Cases and Error Handling

**Files:**
- None (verification only)

**Step 1: Test session invalidation failure resilience**

Simulate RPC failure by stopping database:
```bash
docker compose stop postgres
```

Then try to login via browser.

Expected: Login should still succeed (error caught, login proceeds)

Restore database:
```bash
docker compose start postgres
```

**Step 2: Test rapid multiple login clicks**

1. Clear browser cookies
2. Navigate to /login
3. Enter credentials
4. Click "Login" button 3 times rapidly

Expected:
- Multiple requests sent
- All succeed or some fail with "already authenticated"
- User ends up logged in
- Only 1 session in database

**Step 3: Test middleware session validation**

1. Login as `analyst` in browser A
2. Login as `analyst` in browser B (invalidates A's session)
3. In browser A, wait 5 seconds
4. Try to access `/analyst/samples` directly

Expected:
- Middleware detects invalid session via `getUser()`
- Redirects to `/login`
- No errors in console

**Step 4: Test client-side SessionTimeboxGuard**

1. Login as `analyst` in browser A
2. Login as `analyst` in browser B (invalidates A's session)
3. In browser A, leave page open for 60 seconds (guard polls every 60s)

Expected:
- After ~60 seconds, guard polls `/api/auth/session-expiry`
- Receives `authenticated: false`
- Triggers auto-logout
- Redirects to `/login?reason=signed_out_elsewhere`

**Step 5: Verify no impact on existing features**

Test these workflows still work:
- ✅ Accession new sample
- ✅ Enter results
- ✅ Approve results
- ✅ Generate COA
- ✅ Logout manually
- ✅ Session timeout after 4 hours

Expected: All features work normally

**Step 6: Check for console errors**

Open browser DevTools console during testing.

Expected: No errors related to session management (warnings about invalidation are OK)

---

## Task 5: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/NOTES.md` (if exists)

**Step 1: Add concurrent session prevention to CLAUDE.md**

Location: After "## Backend (Self-hosted Supabase)" section

Add:
```markdown
## Session Management

**Token Expiry:**
- Access tokens: 1h (`GOTRUE_JWT_EXP=3600`)
- Refresh tokens: 4h (`GOTRUE_REFRESH_TOKEN_EXPIRY=14400`)
- Absolute session lifetime: 4h (enforced by middleware)

**Concurrent Login Prevention:**
- ✅ Only one active session per user allowed
- ✅ New login invalidates all existing sessions for that user
- ✅ Previous devices logged out on next request
- Implementation: `invalidate_user_sessions()` RPC in `src/app/actions/auth.ts:51`

**Session Invalidation:**
- Middleware (`src/middleware.ts`) validates session on every request
- Client guard (`SessionTimeboxGuard`) polls for session expiry
- Invalid sessions redirect to `/login`
```

**Step 2: Commit documentation update**

```bash
git add CLAUDE.md
git commit -m "docs: document concurrent login prevention in CLAUDE.md"
```

---

## Task 6: Final Verification and Cleanup

**Files:**
- None (verification only)

**Step 1: Run full test suite**

Run: `npm run typecheck`

Expected: No errors

**Step 2: Check git status**

Run: `git status`

Expected: Clean working directory (all changes committed)

**Step 3: Review commit history**

Run: `git log --oneline -6`

Expected: See 4-5 commits related to concurrent login prevention:
- Migration creation
- Login action modification
- Test documentation
- CLAUDE.md update

**Step 4: Push to remote**

```bash
git push origin main
```

Expected: All commits pushed successfully

**Step 5: Verify in production-like environment**

If you have staging/production:
1. Apply migration 102
2. Restart PostgREST
3. Deploy updated code
4. Test concurrent login prevention
5. Monitor for issues

---

## Rollback Plan

If issues discovered after deployment:

**Step 1: Revert login action change**

```bash
git revert <commit-hash-of-task-2>
git push origin main
```

**Step 2: Drop RPC function (optional)**

```sql
DROP FUNCTION IF EXISTS public.invalidate_user_sessions(UUID);
```

Note: Can leave migration in place, just stop calling the function. Function has no side effects if not called.

---

## Success Criteria

- ✅ Only one active session per user in `auth.sessions` table
- ✅ Second login invalidates first session automatically
- ✅ First browser redirected to `/login` on next request
- ✅ No errors during normal login/logout flows
- ✅ No impact on existing features (accession, results, COA)
- ✅ All tests pass
- ✅ Documentation updated

---

## Reference Files

- `src/app/actions/auth.ts:7-79` - Login action
- `src/lib/supabase/server.ts:35-48` - Admin client creation
- `src/middleware.ts:64-138` - Session validation
- `src/components/auth/session-timebox-guard.tsx` - Client-side guard
- `supabase/migrations/054_auth_session_created_at_rpc.sql` - Pattern for auth.sessions RPC

## Context
The application requires an internal administration interface for Managers to control user access. Users are currently stored in `public.users` (profile) and `auth.users` (Supabase Auth). We need to sync these or at least store displayable info in `public.users`.

## Goals / Non-Goals
- **Goals**:
    - distinct "Manager" UI for users.
    - Soft delete to preserve audit trails (results entered by user).
    - Capture "Lab" information for users.
- **Non-Goals**:
    - Self-registration (Users are created by Managers).
    - Password reset by Manager (Managers create users with temp password or trigger reset email - for MVP, we'll assume creating a user sets a password or sends invite if configured, but `createUser` action implies setting initial credentials).

## Decisions
- **Schema**: Add `email` to `public.users`. While redundant with `auth.users`, it avoids complex joins with the protected `auth` schema for simple display logic and allows easier searching by managers.
- **Layout**: Use a "Master-Detail" split view using a Side Sheet (Shadcn `Sheet`) for the "Detail/Edit" view. This keeps context visible while editing.
- **Auth Sync**: When creating a user via the App, we will use `supabase.auth.admin.createUser` (if Service Role is available) or standard `signUp` (if generic). Given this is a "Manager" action, we likely need Admin privileges. *Constraint*: The current setup uses Client-side Supabase or Server Actions with user context. *Decision*: We will use a Server Action that creates the `auth.users` record. If the current user is a Manager, they should have permission (via RLS or App logic) to insert into `public.users`. Creating the `auth` user might require a Service Role client if "Invite" flow isn't used. We will assume for this prototype we use the standard "Sign Up" flow or a Service Role if available in `src/lib/supabase`.

## Risks / Trade-offs
- **Data Sync**: `email` in `public.users` could drift from `auth.users` if changed elsewhere. We will assume the App is the primary entry point for modifications.

## Migration Plan
- Run SQL migration to alter `users` table.
- Update existing rows (if any) with dummy email/lab or NULL.

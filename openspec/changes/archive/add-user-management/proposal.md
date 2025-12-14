## Why
Managers need a way to manage system users (analysts and other managers) directly within the application. Currently, user management is likely done via direct database access or Supabase dashboard. This feature brings user administration into the app with a proper UI, validation, and role-based access control.

## What Changes
- **Database**: Update `public.users` table to include `email`, `lab`, and `deleted_at` (for soft delete).
- **UI**: Create a new "User Management" page (`/manager/users`) with a split-view (List + Detail/Edit Panel).
- **Backend**: Add Server Actions for User CRUD (Create, Read, Update, Soft Delete).
- **Security**: Ensure only users with `manager` role can access these features.

## Impact
- **Affected specs**: `user-management` (new)
- **Affected code**:
    - `supabase/migrations`: New migration for `users` table schema changes.
    - `src/app/(dashboard)/manager/users`: New route.
    - `src/app/actions/users.ts`: New server actions.
    - `src/components/user-*`: New components.

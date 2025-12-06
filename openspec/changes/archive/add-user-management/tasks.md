## 1. Database & Schema
- [x] 1.1 Create migration to add `email`, `lab`, `deleted_at` columns to `public.users`.
- [x] 1.2 Update `src/types/index.ts` with new User fields and Zod schemas (`UserSchema`, `CreateUserSchema`, `UpdateUserSchema`).
- [x] 1.3 Run migration and regenerate types if needed.

## 2. Server Actions (Backend)
- [x] 2.1 Create `src/app/actions/users.ts`.
- [x] 2.2 Implement `getUsers(params)` with pagination, searching, and filtering (exclude soft-deleted).
- [x] 2.3 Implement `createUser(data)` (Handle Supabase Auth `signUp` + `public.users` insert).
- [x] 2.4 Implement `updateUser(data)` (Update `public.users`).
- [x] 2.5 Implement `deleteUser(id)` (Soft delete: set `deleted_at`).

## 3. UI Components
- [x] 3.1 Create `UserListTable` (DataTable) with columns: Username, Fullname, Email, Lab, Role, Status.
- [x] 3.2 Create `UserForm` (React Hook Form + Zod) for Add/Edit.
- [x] 3.3 Create `UserManagementPage` layout (Note: Switched to Assays Page Pattern instead of Split-View).
- [x] 3.4 Implement "Add User" dialog/panel.
- [x] 3.5 Implement "Edit User" panel (opens on row click/button).

## 4. Integration & Polish
- [x] 4.1 Add "Users" link to Manager Sidebar/Navigation (Added to Manager Dashboard Card).
- [x] 4.2 Add error handling and success notifications (Toast).
- [x] 4.3 Verify "Visible only for Manager/Admin" restriction (Middleware/Layout check).
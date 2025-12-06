## 1. Database & Schema
- [ ] 1.1 Create migration to add `email`, `lab`, `deleted_at` columns to `public.users`.
- [ ] 1.2 Update `src/types/index.ts` with new User fields and Zod schemas (`UserSchema`, `CreateUserSchema`, `UpdateUserSchema`).
- [ ] 1.3 Run migration and regenerate types if needed.

## 2. Server Actions (Backend)
- [ ] 2.1 Create `src/app/actions/users.ts`.
- [ ] 2.2 Implement `getUsers(params)` with pagination, searching, and filtering (exclude soft-deleted).
- [ ] 2.3 Implement `createUser(data)` (Handle Supabase Auth `signUp` + `public.users` insert).
- [ ] 2.4 Implement `updateUser(data)` (Update `public.users`).
- [ ] 2.5 Implement `deleteUser(id)` (Soft delete: set `deleted_at`).

## 3. UI Components
- [ ] 3.1 Create `UserListTable` (DataTable) with columns: Username, Fullname, Email, Lab, Role, Status.
- [ ] 3.2 Create `UserForm` (React Hook Form + Zod) for Add/Edit.
- [ ] 3.3 Create `UserManagementPage` layout (Split-View: Table on left/top, selected user details/form on right/bottom or Sheet).
- [ ] 3.4 Implement "Add User" dialog/panel.
- [ ] 3.5 Implement "Edit User" panel (opens on row click).

## 4. Integration & Polish
- [ ] 4.1 Add "Users" link to Manager Sidebar/Navigation.
- [ ] 4.2 Add error handling and success notifications (Toast).
- [ ] 4.3 Verify "Visible only for Manager/Admin" restriction (Middleware/Layout check).

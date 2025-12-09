# **GEMINI.md \- Gemini Code Configuration for CDC-LIMS**

## **Project Context**

**Project:** CDC-LIMS (MVP)
**Stack:** Next.js 16, React 19, Supabase (Self-hosted), PostgreSQL 16
**Goal:** 21 CFR Part 11 Compliant Lab Information Management System
**Deployment:** Docker Compose (VPS) or Railway/Render (Cloud)
**Localization:** Vietnamese UI (all user-facing text must be in Vietnamese)

## **Current Status**

This project is in active development with core features implemented:
- ✅ Authentication & Role-Based Access Control (Analyst/Manager)
  - Token Expiry: Access tokens (1h), Refresh tokens (4h) - enforces re-login after 4 hours
  - Configuration: `GOTRUE_JWT_EXP=3600`, `GOTRUE_REFRESH_TOKEN_EXPIRY=14400`
- ✅ Sample Accessioning (Manual & QR Scanner)
- ✅ Test Assignment (POS-style UI with server-side search)
  - Auto-focus on assigned sample with timestamp update
  - Updated_at column in sample grid with sorting options
  - Tooltips for better UX
- ✅ Print Order Form (A5 format with optimized layout)
- ✅ Results Grid (TanStack Table with editable cells)
- ✅ Approval Queue & Workflow
- ✅ Audit Logging (Database triggers)
- 🚧 PDF Report Generation (In progress)

## **Behavioral Directives**

### **1. Compliance First**
- **Never** suggest features that break auditability (e.g., "delete this result")
- Always recommend "soft delete" or "void" status instead
- All data changes must be traceable via audit logs
- Respect RLS policies - don't bypass security

### **2. Database Changes via Migrations**
- We self-host Supabase in Docker
- **Always** provide SQL migration files in `supabase/migrations/`
- Don't suggest Dashboard-only changes
- Include RLS policies and triggers in migrations

### **3. Incremental Development**
- Build features step-by-step
- Start with structure, then add functionality, then validation
- Don't generate entire complex components in one turn
- Test each increment before moving forward

### **4. Vietnamese Localization**
- **All UI text must be in Vietnamese**
- Reference `docs/vietnamese_dictionary.md` for standard translations
- Use proper Vietnamese grammar and terminology
- Only code comments and technical documentation may be in English

### **5. Type Safety**
- Use Zod schemas for validation (defined in `src/types/index.ts`)
- Leverage TypeScript strictly - no `any` types
- Server Actions must validate inputs with Zod before DB operations

## **Development Commands**

```bash
# Development
npm run dev              # Start Next.js dev server (port 3000)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint
npm run typecheck        # TypeScript type checking (PREFERRED over build for validation)

# Database (Docker)
docker compose up -d     # Start Supabase stack
docker compose down      # Stop Supabase stack
docker compose logs -f   # View logs
docker compose ps        # Check container status
```

## File Structure Expectations

1. Files: 250-350 lines maximum, single responsibility
2. Filenames: Descriptive and match content exactly

3. Single class/function: OrderService.ts, calculateTax.py
4. Multiple items: update_inventory_on_order_placed.go


Headers: First 5-10 lines explain purpose for multi-item files only

## Code Quality Standards

Self-documenting: names explain intent completely
Clear variable names: userAuthenticatedAt not uat
Action-based functions: calculateTaxForOrder() not calcTax()
Semantic directories: group by feature/domain, max 3-4 levels deep

## Working Approach

Navigate first: Understand structure before reading code
Read purposefully: Only open files relevant to current task
Trust the structure: Filename and location tell you what's inside
Small focused changes: Maintain the 250-350 line limit
Keep it clean: Don't break existing conventions

## When Making Changes

Maintain single-responsibility principle
Keep filenames accurate to content
Split files that exceed 350 lines
Update file headers if purpose changes
Follow existing naming patterns

## Token Optimization

Don't read entire files unnecessarily
Use grep to find specific patterns
Check file headers before reading full content
Navigate using directory structure, not memory

## Quality Check
Before completing tasks, ensure:

1. Files remain under 350 lines
2. Filenames accurately describe content
3. New code is self-documenting
4. Directory structure stays logical
5. Changes follow existing patterns


## **Backend Infrastructure (Self-Hosted Supabase)**

### **Architecture Overview**

This project uses **self-hosted Supabase** running in Docker, NOT Supabase Cloud. This is critical for understanding the deployment and migration workflow.

**Docker Services (docker-compose.yml):**
- **postgres** (`lims-postgres`): PostgreSQL 15 database on port 5432
- **auth** (`lims-auth`): GoTrue authentication service on port 9999
- **rest** (`lims-rest`): PostgREST API on port 3001
- **storage** (`lims-storage`): Storage API on port 5000
- **kong** (`lims-kong`): API Gateway on port 8000
- **meta** (`lims-meta`): Postgres Meta API on port 8080
- **studio** (`lims-studio`): Supabase Studio on port 3002

**Key Configuration:**
- Database: `postgres://postgres:PASSWORD@localhost:5432/postgres`
- API URL: `http://localhost:8000` (Kong gateway)
- Studio: `http://localhost:3002` (Database management UI)
- Default passwords in `docker-compose.yml` (change in production!)

### **Database Migration Workflow**

**IMPORTANT:** We do NOT use Supabase CLI for migrations. All migrations are applied manually via Docker.

#### **Creating a New Migration**

1. **Create Migration File:**
   ```bash
   # Naming convention: XXX_description.sql
   # Example: 026_add_user_preferences.sql
   touch supabase/migrations/026_add_user_preferences.sql
   ```

2. **Write Migration SQL:**
   ```sql
   -- Migration 026: Add user preferences
   -- Description of what this migration does
   
   SET search_path TO public;
   
   -- Your SQL here
   CREATE TABLE IF NOT EXISTS user_preferences (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       user_id UUID REFERENCES users(id),
       preferences JSONB DEFAULT '{}'
   );
   
   -- Enable RLS
   ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
   
   -- Add policies
   CREATE POLICY "Users can read own preferences"
   ON user_preferences FOR SELECT
   USING (user_id = auth.uid());
   ```

3. **Apply Migration:**
   ```bash
   # Method 1: Using PowerShell (Windows)
   Get-Content supabase\migrations\026_add_user_preferences.sql | docker exec -i lims-postgres psql -U postgres -d postgres
   
   # Method 2: Using bash/WSL
   cat supabase/migrations/026_add_user_preferences.sql | docker exec -i lims-postgres psql -U postgres -d postgres
   
   # Method 3: Direct execution
   docker exec -i lims-postgres psql -U postgres -d postgres -f /path/to/migration.sql
   ```

4. **Verify Migration:**
   ```bash
   # Check if table exists
   docker exec lims-postgres psql -U postgres -d postgres -c "\d user_preferences"
   
   # Check policies
   docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM pg_policies WHERE tablename = 'user_preferences';"
   ```

#### **Migration Best Practices**

1. **Always Use Migrations for Schema Changes**
   - ❌ DON'T: Make changes via Supabase Studio UI
   - ✅ DO: Create migration files and apply via Docker
   - Why: Migrations are version-controlled and reproducible

2. **Include RLS Policies in Migrations**
   ```sql
   -- Always enable RLS for new tables
   ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
   
   -- Always add appropriate policies
   CREATE POLICY "policy_name" ON new_table ...
   ```

3. **Use Idempotent SQL**
   ```sql
   -- Use IF NOT EXISTS / IF EXISTS
   CREATE TABLE IF NOT EXISTS ...
   DROP POLICY IF EXISTS ...
   
   -- Safe for re-running migrations
   ```

4. **Test Migrations Locally First**
   ```bash
   # Apply to local Docker
   Get-Content migration.sql | docker exec -i lims-postgres psql -U postgres -d postgres
   
   # Run security tests
   docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"
   
   # Verify with typecheck
   npm run typecheck
   
   # Test application
   npm run dev
   ```

5. **Security-Critical Migrations**
   - Always include role checks in RLS policies
   - Use `get_user_role()` helper function
   - Test with different user roles
   - **Follow the Migration Security Checklist** (`MIGRATION_SECURITY_CHECKLIST.md`)
   - Run automated security tests after migration
   - Example:
   ```sql
   CREATE POLICY "Analysts can insert"
   WITH CHECK (
       get_user_role() IN ('analyst', 'manager')  -- ✅ Role check
       AND status = 'pending'
   );
   ```

#### **Database Migration Security Checklist**

**CRITICAL:** Every migration that modifies RLS policies MUST follow this security checklist to prevent vulnerabilities and false positives.

**Pre-Migration (BEFORE writing SQL):**

1. **Review Existing Policies**
   ```bash
   # List all policies on the table you're modifying
   docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.TABLE_NAME'::regclass ORDER BY polname;"
   ```
   - [ ] Document current policy names
   - [ ] Identify which policies will be modified/removed
   - [ ] Check for orphaned policies from previous migrations

2. **Security Analysis**
   - [ ] Does the new policy include **role checks**? (`get_user_role()`)
   - [ ] Does the new policy include **ownership checks**? (`auth.uid()`)
   - [ ] Is the policy **more permissive** than the previous one?
   - [ ] Could this policy allow **unauthorized access**?

3. **Migration File Preparation**
   - [ ] Use descriptive migration number (sequential)
   - [ ] Include clear comments explaining the change
   - [ ] Use `DROP POLICY IF EXISTS` **before** `CREATE POLICY`
   - [ ] Use idempotent SQL (`IF NOT EXISTS`, `IF EXISTS`)

**Migration Template (Use this as starting point):**
```sql
-- Migration XXX: Description of what this does
-- Security Impact: [None / Low / Medium / High]
-- Changes: [What policies are being added/removed/modified]

SET search_path TO public;

-- Drop old policy (if replacing)
DROP POLICY IF EXISTS "old_policy_name" ON public.table_name;

-- Create new policy
CREATE POLICY "new_policy_name"
ON public.table_name FOR operation
USING (condition)  -- For SELECT
WITH CHECK (
    -- ✅ ALWAYS include role check for INSERT/UPDATE/DELETE
    get_user_role() IN ('analyst', 'manager')
    AND other_conditions
);

-- Add comment explaining the policy
COMMENT ON POLICY "new_policy_name" ON public.table_name 
IS 'Description of what this policy allows and why';
```

**Post-Migration (AFTER applying SQL):**

1. **Apply Migration**
   ```bash
   Get-Content supabase\migrations\XXX_name.sql | docker exec -i lims-postgres psql -U postgres -d postgres
   ```

2. **Verify Migration Success**
   ```bash
   # Check logs for errors
   docker compose logs postgres | tail -n 20
   
   # Verify table structure (if schema changed)
   docker exec lims-postgres psql -U postgres -d postgres -c "\d table_name"
   ```

3. **Run Security Tests (MANDATORY)**
   ```bash
   docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"
   ```
   - [ ] All tests passed (all `t` in passed column)
   - [ ] No warnings in PostgreSQL logs
   - [ ] If any test fails, **investigate immediately** before proceeding

4. **Verify Policy State**
   ```bash
   docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.TABLE_NAME'::regclass ORDER BY polname;"
   ```
   - [ ] Old policy is removed (if applicable)
   - [ ] New policy exists
   - [ ] No duplicate policies
   - [ ] Policy count matches expectations

5. **Verify Policy Content**
   ```bash
   docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname, pg_get_expr(polwithcheck, polrelid) FROM pg_policy WHERE polrelid = 'public.TABLE_NAME'::regclass AND polcmd = 'a';"
   ```
   - [ ] Policy includes `get_user_role()` check (for critical operations)
   - [ ] Policy logic matches intended security model
   - [ ] No overly permissive conditions

6. **Application Testing**
   ```bash
   npm run typecheck
   npm run dev
   ```
   - [ ] No TypeScript errors
   - [ ] Application starts successfully
   - [ ] Test affected functionality with different user roles

**Common Mistakes to Avoid:**

❌ **DON'T: Forget to drop old policy**
```sql
-- BAD: Creates duplicate policies
CREATE POLICY "new_policy" ON table_name ...
-- Old policy still exists!
```

✅ **DO: Always drop before create**
```sql
-- GOOD: Ensures only one policy exists
DROP POLICY IF EXISTS "old_policy" ON table_name;
CREATE POLICY "new_policy" ON table_name ...
```

❌ **DON'T: Skip role checks**
```sql
-- BAD: Any authenticated user can insert
CREATE POLICY "policy_name"
WITH CHECK (
    auth.uid() IS NOT NULL  -- ❌ No role check
    AND status = 'pending'
);
```

✅ **DO: Include role checks**
```sql
-- GOOD: Only analysts and managers can insert
CREATE POLICY "policy_name"
WITH CHECK (
    get_user_role() IN ('analyst', 'manager')  -- ✅ Role check
    AND status = 'pending'
);
```

❌ **DON'T: Use Supabase Studio for schema changes**
- Changes are not version controlled
- Cannot be reproduced in other environments
- No audit trail

✅ **DO: Use migration files**
- Version controlled
- Reproducible
- Auditable
- Testable

**Emergency Rollback:**

If a migration causes security issues, create an immediate rollback migration:

```sql
-- Migration XXX_rollback: Revert migration XXX
-- Security Impact: High - Fixes security vulnerability

SET search_path TO public;

-- Drop problematic policy
DROP POLICY IF EXISTS "problematic_policy" ON public.table_name;

-- Restore previous policy
CREATE POLICY "previous_policy"
ON public.table_name FOR operation
WITH CHECK (
    -- Previous policy conditions
);
```

Apply rollback:
```bash
Get-Content supabase\migrations\XXX_rollback.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

**Quick Reference - Security Verification Commands:**
```bash
# Apply migration
Get-Content supabase\migrations\XXX_name.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# Run security tests
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"

# Check policies
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname FROM pg_policy WHERE polrelid = 'public.TABLE_NAME'::regclass;"

# Verify role check in policy
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT pg_get_expr(polwithcheck, polrelid) FROM pg_policy WHERE polrelid = 'public.TABLE_NAME'::regclass AND polcmd = 'a';"
```

**REMEMBER:** Security is not optional. Always verify migrations with `run_security_tests()` before considering them complete.

#### **Common Migration Patterns**

**Adding a Column:**
```sql
ALTER TABLE samples 
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
```

**Creating an Index:**
```sql
CREATE INDEX IF NOT EXISTS idx_samples_priority 
ON samples(priority) WHERE deleted_at IS NULL;
```

**Adding RLS Policy:**
```sql
CREATE POLICY "policy_name"
ON table_name FOR operation
USING (condition)
WITH CHECK (condition);
```

**Creating RPC Function:**
```sql
CREATE OR REPLACE FUNCTION function_name(params)
RETURNS return_type
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges
SET search_path = public
AS $$
BEGIN
    -- Function body
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION function_name TO authenticated;
```

### **Database Access Methods**

1. **Via Application (Recommended):**
   - Use Supabase JS Client in Server Actions
   - RLS policies automatically enforced
   - Audit logs triggered

2. **Via Docker CLI (Admin/Debugging):**
   ```bash
   # Interactive psql
   docker exec -it lims-postgres psql -U postgres -d postgres
   
   # Single query
   docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM users;"
   ```

3. **Via Supabase Studio (Read-Only Recommended):**
   - Access: `http://localhost:3002`
   - Good for: Viewing data, testing queries
   - Avoid: Making schema changes (use migrations instead)

### **Troubleshooting Database Issues**

**Container Not Running:**
```bash
docker compose ps
docker compose logs postgres
docker compose restart postgres
```

**Migration Failed:**
```bash
# Check error message
docker compose logs postgres | tail -n 50

# Common issues:
# - Syntax error: Check SQL syntax
# - Policy conflict: Drop old policy first
# - Permission denied: Check RLS policies
```

**RLS Policy Debugging:**
```sql
-- View all policies for a table
SELECT * FROM pg_policies WHERE tablename = 'results';

-- Check policy expression
SELECT polname, pg_get_expr(polwithcheck, polrelid) 
FROM pg_policy 
WHERE polrelid = 'public.results'::regclass;

-- Test as specific user (in psql)
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "user-uuid"}';
SELECT * FROM results;  -- Will respect RLS
```

**Connection Issues:**
```bash
# Check if port 5432 is exposed
docker compose ps

# Test connection
docker exec lims-postgres pg_isready -U postgres

# Check environment variables
docker exec lims-postgres env | grep POSTGRES
```

## **Project Structure**

```
lims-lite/
├── src/
│   ├── app/
│   │   ├── (auth)/              # Login routes
│   │   ├── (dashboard)/         # Protected routes
│   │   │   ├── analyst/         # Analyst role pages
│   │   │   └── manager/         # Manager role pages
│   │   ├── actions/             # Server Actions (auth, samples, results)
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Landing page
│   ├── components/
│   │   ├── ui/                  # Shadcn UI primitives
│   │   ├── results-grid.tsx     # TanStack Table for batch entry
│   │   ├── sample-accession-form.tsx
│   │   ├── test-assignment-dialog.tsx
│   │   ├── approval-queue-table.tsx
│   │   └── ...                  # Other domain components
│   ├── lib/
│   │   ├── supabase/            # Supabase client/server setup
│   │   ├── data/                # Data fetching utilities
│   │   ├── utils.ts             # General utilities
│   │   └── utils-lims.ts        # LIMS-specific utilities
│   ├── types/
│   │   └── index.ts             # Zod schemas & TypeScript types
│   └── middleware.ts            # Auth middleware
├── supabase/
│   └── migrations/              # SQL migrations (versioned)
├── docs/                        # Project documentation
├── docker-compose.yml           # Local Supabase stack
├── railway-docker-compose.yml   # Railway deployment config
└── Dockerfile                   # Next.js container
```

## **Priority Files (Most Frequently Modified)**

1. **`supabase/migrations/*.sql`** - Database schema, RLS policies, triggers
2. **`src/types/index.ts`** - Shared Zod schemas and TypeScript types
3. **`src/app/actions/*.ts`** - Server Actions (business logic)
4. **`src/components/*.tsx`** - Feature components (forms, grids, dialogs)
5. **`docker-compose.yml`** - Infrastructure configuration

## **UI/UX Standards**

### **Page Header Pattern (MANDATORY)**

**All pages MUST use the unified `DashboardHeader` component.** This ensures consistent branding, user experience, and functionality across the entire application.

#### **Required Pattern:**
```tsx
import { DashboardHeader } from '@/components/dashboard-header'

export default async function YourPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) redirect('/login')
    
    const { data: userData } = await supabase
        .from('users')
        .select('full_name, role')
        .eq('id', user.id)
        .single()
    
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <DashboardHeader 
                subtitle="Page-specific subtitle in Vietnamese"
                user={userData}
            />
            
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Page content */}
            </main>
        </div>
    )
}
```

#### **DashboardHeader Features:**
- ✅ **CDC Logo**: Automatically displayed on left side
- ✅ **Gradient Title**: "Hệ Thống Quản Lý Thông Tin Khoa Xét nghiệm" (default, can override with `title` prop)
- ✅ **Subtitle**: Page-specific subtitle in Vietnamese (required prop)
- ✅ **User Profile**: UserProfileDropdown with:
  - Avatar displaying user initials
  - User name and role display with active status indicator (green ping animation)
  - Dropdown menu: "Hồ sơ" (Profile), "Cài đặt" (Settings), "Đăng xuất" (Logout)
  - Logout confirmation dialog (prevents accidental logouts)
- ✅ **Responsive**: Works on mobile, tablet, and desktop
- ✅ **Dark Mode**: Full dark mode support

#### **Navigation Pattern:**
Place navigation buttons ("Quay lại", etc.) in the **main content area**, NOT in the header:

```tsx
<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div className="mb-6">
        <Link href="/manager">
            <Button variant="ghost" size="sm" className="hover:bg-slate-100 dark:hover:bg-slate-800">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Quay lại
            </Button>
        </Link>
    </div>
    
    {/* Rest of content */}
</main>
```

#### **Examples of Correct Subtitles:**
| Page | Subtitle |
|------|----------|
| `/samples` | "Quản lý mẫu" |
| `/manager/approvals` | "Phê duyệt kết quả" |
| `/manager/assays` | "Quản lý danh mục chỉ tiêu xét nghiệm/kiểm nghiệm" |
| `/manager/users` | "Quản lý tài khoản và phân quyền người dùng" |
| `/analyst/accession` | "Tiếp nhận mẫu" |

#### **❌ DO NOT:**
- Create custom headers with inline user profile display
- Use `LogoutButton` component directly
- Place navigation buttons in the header
- Omit CDC logo
- Skip the DashboardHeader component

#### **✅ DO:**
- Always use `DashboardHeader` for all authenticated pages
- Pass `userData` with `full_name` and `role` to DashboardHeader
- Write subtitles in Vietnamese that describe the page's purpose
- Place navigation buttons in main content area
- Follow the established pattern for consistency

This unified pattern ensures professional appearance, consistent UX, and easier maintenance across the entire application.

## **Code Generation Preferences**

### **React Components**
- Functional components with TypeScript
- Use React 19 features (Server Components, Actions)
- Shadcn UI for all UI primitives
- Use `lucide-react` for icons

### **Forms & Validation**
- `react-hook-form` for complex forms (Accessioning, Results)
- `@hookform/resolvers` with Zod for validation
- Server-side validation in Server Actions

### **Data Tables**
- `@tanstack/react-table` v8 for data grids
- Editable cells via `react-hook-form` integration
- Keyboard navigation support (Tab, Arrow keys)
- Tooltips via `@radix-ui/react-tooltip` for enhanced UX

### **Styling**
- Tailwind CSS v4 utility classes
- Use `cn()` helper from `lib/utils.ts` for conditional classes
- Follow existing component patterns for consistency

### **State Management**
- React Server Components for data fetching
- `useState`/`useReducer` for local UI state
- Server Actions stay server-only; client components call them through `src/lib/api-client.ts` hitting `/api/client-actions` (and `/api/auth/logout`) instead of importing `src/app/actions/*` directly
- No global state library (keep it simple)

## **Common Patterns**

### **Server Action with Validation**
```typescript
// src/app/actions/samples.ts
'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const schema = z.object({
  sampleId: z.string().min(3),
  clientId: z.string().uuid()
})

export async function createSample(formData: FormData) {
  const supabase = await createClient()

  // Parse and validate
  const result = schema.safeParse(Object.fromEntries(formData))
  if (!result.success) {
    return { error: result.error.flatten() }
  }

  // Insert to database
  const { error } = await supabase
    .from('samples')
    .insert(result.data)

  if (error) return { error: error.message }

  revalidatePath('/manager/samples')
  return { success: true }
}
```

### **Database Trigger for Audit Logging**
```sql
-- supabase/migrations/002_audit_triggers.sql
CREATE TRIGGER audit_log_trigger
  AFTER UPDATE ON results
  FOR EACH ROW
  EXECUTE FUNCTION trigger_audit_log();
```

## **Error Handling Checklist**

When a database error occurs:

1. **Check RLS Policies**
   - Review `supabase/migrations/003_rls_policies.sql`
   - Verify user role matches policy requirements
   - Check `auth.uid()` is being passed correctly

2. **Check Triggers**
   - Review `supabase/migrations/002_audit_triggers.sql`
   - Ensure trigger isn't rejecting valid updates
   - Check trigger function logic

3. **Check Input Validation**
   - Verify Zod schema matches database constraints
   - Check for required fields
   - Validate data types match

4. **Common Issues**
   - "RLS violation" → Analyst trying to modify approved result
   - "Foreign key violation" → Referenced record doesn't exist
   - "Not null violation" → Required field is missing

## **Testing Workflow**

### **Manual Testing Checklist**
- [ ] Login as Analyst → Can access only analyst pages
- [ ] Login as Manager → Can access all pages
- [ ] Accession sample → QR scanner works, form validates
- [ ] Assign tests → Search works, tests are assigned
- [ ] Enter results → Grid navigation, validation, batch save
- [ ] Approve results → Approval dialog, audit log updated
- [ ] Check audit log → All changes are recorded
- [ ] Generate PDF → Report contains correct data

### **Database Verification**
```sql
-- Check audit logs
SELECT * FROM audit_logs
WHERE record_id = '<sample-id>'
ORDER BY timestamp DESC;

-- Check RLS policies
SELECT * FROM pg_policies
WHERE tablename = 'results';
```

## **Deployment**

### **Local Development**
1. Start Supabase: `docker compose up -d`
2. Run migrations: Check `docs/DATABASE_SETUP.md`
3. Start Next.js: `npm run dev`
4. Access: http://localhost:3000

### **Production (Docker Compose)**
- Follow `docs/DOCKER_SETUP.md`
- Single-tenant VPS deployment
- Nginx reverse proxy recommended

### **Cloud (Railway/Render)**
- Follow `docs/DEPLOYMENT_RAILWAY.md` or `docs/DEPLOYMENT_RENDER.md`
- Use `railway-docker-compose.yml` for Railway
- Supports managed PostgreSQL + Next.js container

## **Reference Documentation**

- **Requirements:** `docs/cdc-lims-mvp.md`
- **Technical Design:** `docs/TechDesign-CDC-LIMS.md`
- **Setup Guides:** `docs/DATABASE_SETUP.md`, `docs/DOCKER_SETUP.md`
- **Deployment:** `docs/DEPLOYMENT_*.md`
- **Localization:** `docs/vietnamese_dictionary.md`
- **Progress Notes:** `docs/NOTES.md`

## **Key Principles**

1. **Data Integrity > Speed** - Always prioritize correctness
2. **Audit Everything** - Changes must be traceable
3. **Respect Roles** - Enforce RBAC at database and UI levels
4. **Build Incrementally** - Small, testable changes
5. **Vietnamese First** - All UI text in Vietnamese
6. **Type Safe** - Use TypeScript and Zod strictly
7. **Self-Documented** - Code should be clear without excessive comments

## Git Workflow and Commit Messages

### Conventional Commits

This project follows **Conventional Commits** specification for commit messages. Writing clear, standardized commit messages is a critical skill that answers two essential questions: **What did you do?** and **Why?**

### Commit Message Format

The basic syntax is: `<type>: <subject>`

**Type:** Describes the category of change. Use these main types:

- **feat**: Add a new feature
- **fix**: Fix a bug
- **docs**: Update documentation
- **refactor**: Refactor code (optimize, restructure) without adding features or fixing bugs
- **style**: Format code (whitespace, semicolons, indentation, etc.)
- **test**: Add or update tests
- **chore**: Update build tasks, package manager configs, etc.
- **perf**: Performance improvements

**Subject:** A brief description (under 100 characters) of what you did. Write in imperative mood, present tense (as if giving a command).

### Examples

✅ **Good commit messages:**
```
fix: Correct login logic for admin user
feat: Add Google login button to homepage
docs: Update API documentation for user endpoints
refactor: Optimize database query performance in practitioners list
style: Fix indentation in auth components
test: Add unit tests for credit calculation
```

❌ **Bad commit messages:**
```
Fixed stuff
WIP
Updated files
changes
asdfgh
```

### Commit Message Best Practices

1. **Be specific:** Describe what changed, not just where
2. **Use imperative mood:** "Add feature" not "Added feature" or "Adds feature"
3. **Keep subject line short:** Under 100 characters
4. **Don't end with period:** No punctuation at the end of subject line
5. **Reference issues when relevant:** `fix: Resolve login error (#123)`

### Extended Format (Optional)

For more complex changes, you can use the extended format with body and footer:

```
<type>: <subject>

<body>

<footer>
```

**Example:**
```
feat: Add bulk practitioner import functionality

Implement Excel file upload and validation for importing multiple
practitioners at once. Includes error handling and progress tracking.

Closes #45
```

### When to Use Each Type

- **feat** - Adding any new functionality users can see or use
- **fix** - Fixing broken functionality that wasn't working as intended
- **docs** - ONLY documentation changes (README, guides, comments)
- **refactor** - Code changes that neither fix bugs nor add features (performance, readability)
- **style** - Code formatting only (no logic changes)
- **test** - Adding missing tests or correcting existing tests
- **chore** - Tooling changes (dependencies, configs, build scripts)

### Git Operations Reference

When creating commits in this project:

1. **Always use Conventional Commits format**
2. **Verify changes before committing:** `git status` and `git diff`
3. **Stage relevant files:** `git add <files>`
4. **Create commit with proper format:** `git commit -m "type: subject"`
5. **Review commit history for context:** `git log --oneline`

See the [Development Workflow](#development-workflow) section for detailed git operations and the full commit creation process.


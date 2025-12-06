# CDC LIMS-Lite Architecture & Documentation

## 1. Project Architecture

**Tech Stack:**
*   **Frontend Framework:** Next.js 16 (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **UI Components:** Shadcn UI (built on Radix UI + Tailwind)
*   **State Management:** React Server Components + Server Actions (Server-side), React Hooks (Client-side)
*   **Form Handling:** React Hook Form + Zod
*   **Database:** Supabase (PostgreSQL) - **SELF-HOSTED via Docker**
*   **Authentication:** Supabase Auth (GoTrue)
*   **ORM/Client:** Supabase JS Client
*   **UI Language:** Vietnamese (All user-facing text must be in Vietnamese)

**Backend Infrastructure:**
*   **Deployment:** Self-hosted Supabase stack via Docker Compose
*   **Database:** PostgreSQL 15 (container: `lims-postgres`, port: 5432)
*   **Auth Service:** GoTrue v2.143.0 (container: `lims-auth`, port: 9999)
*   **REST API:** PostgREST v12.0.2 (container: `lims-rest`, port: 3001)
*   **API Gateway:** Kong 2.8.1 (container: `lims-kong`, port: 8000)
*   **Storage:** Supabase Storage API (container: `lims-storage`, port: 5000)
*   **Admin UI:** Supabase Studio (container: `lims-studio`, port: 3002)
*   **Migration Method:** Manual SQL execution via Docker (NOT Supabase CLI)

**Key URLs (Local Development):**
*   Application: `http://localhost:3000`
*   Supabase API: `http://localhost:8000` (Kong gateway)
*   Supabase Studio: `http://localhost:3002` (Database UI)
*   Direct PostgreSQL: `localhost:5432`

**Architecture Pattern:**
The project follows a standard Next.js App Router architecture. It leverages **Server Components** for data fetching and **Server Actions** for mutations (API layer), minimizing client-side JavaScript.

*   `src/app`: Contains the file-system based router.
*   `src/app/actions`: Contains Server Actions (backend logic).
*   `src/components`: Reusable UI components.
*   `src/lib`: Utility functions and Supabase client configuration.
*   `src/types`: Shared TypeScript definitions and Zod schemas.
*   `supabase/migrations`: SQL files for database schema and RLS policies.

## 2. Key Components

### Pages (Routes)
*   **Login:** `src/app/(auth)/login/page.tsx` - Entry point for authentication.
*   **Analyst Dashboard:** `src/app/(dashboard)/analyst/page.tsx` - Main view for laboratory analysts.
    *   **Accession:** `src/app/(dashboard)/analyst/accession/page.tsx` - Form to receive new samples and optionally assign initial tests.
    *   **Samples:** `src/app/(dashboard)/analyst/samples/page.tsx` - List of samples for analysts.
    *   **Results:** `src/app/(dashboard)/analyst/results/page.tsx` - Interface for analysts to enter and save test results.
*   **Manager Dashboard:** `src/app/(dashboard)/manager/page.tsx` - Overview for lab managers.
    *   **Sample Management:** `src/app/(dashboard)/manager/samples/page.tsx` - Advanced sample control (e.g., test assignment).
    *   **Approvals:** `src/app/(dashboard)/manager/approvals/page.tsx` - Queue for reviewing and approving/rejecting pending results.
    *   **Assay Management:** `src/app/(dashboard)/manager/assays/page.tsx` - CRUD interface for assay definitions and method links.

### Core UI Components
*   **SampleAccessionForm** (`src/components/sample-accession-form.tsx`): Handles new sample creation and optional test assignment.
*   **SampleListTable** (`src/components/sample-list-table.tsx`): A reusable data table for displaying samples with pagination and filtering.
    *   Includes `updated_at` column for tracking sample modifications
    *   Supports sorting by update timestamp
    *   Auto-highlights recently assigned samples
*   **QrScanner** (`src/components/qr-scanner.tsx`): Integrates camera functionality to scan sample QR codes.
*   **TestAssignmentModule** (`src/components/test-assignment-module.tsx`): Module for managers to assign tests to samples with auto-focus functionality.
*   **AssignedTestsPanel** (`src/components/assigned-tests-panel.tsx`): Shows tests assigned to a specific sample with tooltips.
*   **AssayDefinitionsTable** (`src/components/assay-definitions-table.tsx`): Data table for managing assay definitions.
*   **ApprovalQueueTable** (`src/components/approval-queue-table.tsx`): Table for managers to review results requiring approval.
*   **ResultCellEditor** (`src/components/result-cell-editor.tsx`): Inline editor for entering result values with validation.
*   **AssayMethodsList** (`src/components/assay-methods-list.tsx`): Manages the many-to-many relationship between assays and methods.

### Database Schema
*   **users:** Extended user profiles linked to Supabase Auth `auth.users`. Stores `role` ('analyst' or 'manager').
*   **samples:** The core entity. Tracks `sample_id`, `client_name`, `status`, `received_by`, etc.
*   **methods:** Stores laboratory test methods/procedures.
*   **assay_definitions:** Defines specific assays/tests.
*   **assay_methods:** Junction table managing the many-to-many relationship between assays and methods (supports defaults).
*   **results:** Stores test data (`value`, `status`) for a sample + assay combination. Supports 'pending', 'entered', 'approved' statuses.
*   **audit_logs:** Tracks all changes for 21 CFR Part 11 compliance.

## 3. API Endpoints (Server Actions)

This project uses Next.js Server Actions as the API layer.

### Authentication (`src/app/actions/auth.ts`)
*   **`login(formData)`**: Authenticates user, checks role, redirects to dashboard.
*   **`logout()`**: Signs out user.

**Token Expiry Configuration:**
*   **Access Token (JWT):** 1 hour (3600s).
*   **Refresh Token:** 4 hours (14400s).
*   **Behavior:** Auto-refresh via middleware; session timeout after 4 hours inactivity.

### Sample Management (`src/app/actions/samples.ts`)
*   **`createSample(data)`**: Creates sample, optionally with initial test assignments.
*   **`updateSample(data)`**: Updates sample details.
*   **`getSamples(params)`**: Fetches paginated, filtered, sorted samples.
*   **`assignTests(data)`**: Creates pending results for a sample, updates status/timestamps.
*   **`getSampleTests(sampleId)`**: Returns assigned tests (results).

### Assay Management (`src/app/actions/assays.ts`, `src/app/actions/assay-methods.ts`)
*   **`createAssayDefinition`, `updateAssayDefinition`, `deleteAssayDefinition`**: CRUD for assays.
*   **`getAssayDefinitions`**: Lists assays with their linked methods.
*   **`addMethodToAssay`, `removeMethodFromAssay`**: Manages the M2M relationship.

### Results Management (`src/app/actions/results.ts`)
*   **`saveBatchResults(data)`**: Batch saves result values, updates status to 'entered'.
*   **`approveResults(data)`**: (Manager) Approves selected results, locks them.
*   **`cancelApproval(data)`**: (Manager) Revokes approval, returns results to 'entered' or 'pending'.

## 4. Database Migration Workflow

**CRITICAL:** This project uses **self-hosted Supabase via Docker**, NOT Supabase Cloud or Supabase CLI.

### How to Apply Migrations

**Step 1: Create Migration File**
```bash
# Naming: XXX_description.sql (e.g., 026_add_column.sql)
touch supabase/migrations/026_add_column.sql
```

**Step 2: Write Migration SQL**
```sql
-- Migration 026: Description
SET search_path TO public;

-- Your changes here
ALTER TABLE samples ADD COLUMN IF NOT EXISTS priority TEXT;

-- Always include RLS policies if creating tables
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "policy_name" ON new_table FOR SELECT USING (auth.uid() IS NOT NULL);
```

**Step 3: Apply to Database**
```bash
# PowerShell (Windows)
Get-Content supabase\migrations\026_add_column.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# Bash/WSL
cat supabase/migrations/026_add_column.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

**Step 4: Verify**
```bash
# Check table structure
docker exec lims-postgres psql -U postgres -d postgres -c "\d samples"

# Check policies
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM pg_policies WHERE tablename = 'samples';"

# Run automated security tests
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"

# Verify application
npm run typecheck
npm run dev
```

### Migration Best Practices

1. **Always use `IF NOT EXISTS` / `IF EXISTS`** for idempotency
2. **Always include RLS policies** for new tables
3. **Always use role checks** in policies: `get_user_role() IN ('analyst', 'manager')`
4. **Test locally first** before production
5. **Never use Supabase Studio** for schema changes (use migrations)

### Common Migration Patterns

**Add Column:**
```sql
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name TYPE DEFAULT value;
```

**Add RLS Policy:**
```sql
CREATE POLICY "policy_name"
ON table_name FOR operation
USING (condition)
WITH CHECK (condition);
```

**Create RPC Function:**
```sql
CREATE OR REPLACE FUNCTION function_name(params)
RETURNS return_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Function body
END;
$$;

GRANT EXECUTE ON FUNCTION function_name TO authenticated;
```

**Security-Critical Policy Example:**
```sql
-- ✅ CORRECT: Includes role check
CREATE POLICY "Analysts can insert"
WITH CHECK (
    get_user_role() IN ('analyst', 'manager')  -- Role check
    AND status = 'pending'
);

-- ❌ WRONG: No role check (security vulnerability)
CREATE POLICY "Anyone can insert"
WITH CHECK (
    auth.uid() IS NOT NULL  -- Only checks authentication
    AND status = 'pending'
);
```

## 5. Development Workflow

*   **Validation:** Use `npm run typecheck` to validate code changes instead of `npm run build`.

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

---

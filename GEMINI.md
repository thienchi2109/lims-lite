# CDC LIMS-Lite Architecture & Documentation

## 1. Project Architecture

**Tech Stack:**
*   **Frontend Framework:** Next.js 16 (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **UI Components:** Shadcn UI (built on Radix UI + Tailwind)
*   **State Management:** React Server Components + Server Actions (Server-side), React Hooks (Client-side)
*   **Form Handling:** React Hook Form + Zod
*   **Database:** Supabase (PostgreSQL)
*   **Authentication:** Supabase Auth
*   **ORM/Client:** Supabase JS Client
*   **UI Language:** Vietnamese (All user-facing text must be in Vietnamese)

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
    *   **Accession:** `src/app/(dashboard)/analyst/accession/page.tsx` - Form to receive new samples.
    *   **Samples:** `src/app/(dashboard)/analyst/samples/page.tsx` - List of samples for analysts.
*   **Manager Dashboard:** `src/app/(dashboard)/manager/page.tsx` - Overview for lab managers.
    *   **Sample Management:** `src/app/(dashboard)/manager/samples/page.tsx` - Advanced sample control (e.g., test assignment).

### Core UI Components
*   **SampleAccessionForm** (`src/components/sample-accession-form.tsx`): Handles new sample creation/accessioning.
*   **SampleListTable** (`src/components/sample-list-table.tsx`): A reusable data table for displaying samples with pagination and filtering.
*   **QrScanner** (`src/components/qr-scanner.tsx`): Integrates camera functionality to scan sample QR codes.
*   **TestAssignmentDialog** (`src/components/test-assignment-dialog.tsx`): Modal for managers to assign assays to samples.

### Database Schema
*   **users:** Extended user profiles linked to Supabase Auth `auth.users`. Stores `role` ('analyst' or 'manager').
*   **samples:** The core entity. Tracks `sample_id` (human-readable), `client_name`, `status`, and `received_by`.
*   **methods:** Stores laboratory test methods/procedures.
*   **assay_definitions:** Defines specific assays/tests that can be performed (linked to methods).
*   **results:** Stores the actual test data for a sample + assay combination.
*   **audit_logs:** Tracks all changes for 21 CFR Part 11 compliance.

## 3. API Endpoints (Server Actions)

This project uses Next.js Server Actions as the API layer. These functions are called directly from client components.

### Authentication (`src/app/actions/auth.ts`)
*   **`login(formData)`**
    *   Authenticates a user against Supabase Auth.
    *   Checks the `users` table for the role.
    *   Redirects to the appropriate dashboard based on role.
*   **`logout()`**
    *   Signs the user out and redirects to the login page.

**Token Expiry Configuration:**
*   **Access Token (JWT):** Expires after 1 hour (3600s) - `GOTRUE_JWT_EXP=3600`
*   **Refresh Token:** Expires after 4 hours (14400s) - `GOTRUE_REFRESH_TOKEN_EXPIRY=14400`
*   **Behavior:**
    *   Access tokens are automatically refreshed by the Supabase client using the refresh token
    *   After 4 hours, the refresh token expires and users must re-login
    *   Middleware (`src/middleware.ts`) enforces authentication and triggers token refresh on each request
*   **Security:** This configuration ensures sessions timeout after 4 hours of inactivity, meeting audit requirements while maintaining good UX

### Sample Management (`src/app/actions/samples.ts`)
*   **`createSample(data: CreateSample)`**
    *   Generates a sequential sample ID (e.g., `20231027-001`).
    *   Inserts a new record into the `samples` table.
    *   Revalidates relevant dashboard paths.
*   **`updateSample(data: UpdateSample)`**
    *   Updates fields like `client_name` or `status`.
*   **`getSamples(params: SampleListParams)`**
    *   Fetches a paginated list of samples.
    *   Supports filtering by `status` and searching by `sample_id` or `client_name`.
*   **`assignTests(data: AssignTests)`**
    *   **Manager Only.**
    *   Creates `results` records (status: 'pending') for selected assays linked to a sample.
    *   Updates sample status to 'assigned'.
*   **`getAssayDefinitions()`**
    *   Returns a list of all available assays for assignment.
*   **`getSampleTests(sampleId)`**
    *   Returns all tests (results) currently assigned to a specific sample.

## 4. Development Workflow

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

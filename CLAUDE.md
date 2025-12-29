# CLAUDE.md - CDC-LIMS Configuration

## Project Context

**Project:** CDC-LIMS (MVP)
**Stack:** Next.js 16, React 19, Supabase (Self-hosted Docker), PostgreSQL 16
**Goal:** 21 CFR Part 11 Compliant Lab Information Management System
**Deployment:** Docker Compose (VPS) or Railway/Render (Cloud)
**Localization:** Vietnamese UI (all user-facing text)

**Auth Config:**
- Access tokens: 1h, Refresh tokens: 4h
- `GOTRUE_JWT_EXP=3600`, `GOTRUE_REFRESH_TOKEN_EXPIRY=14400`

## Behavioral Directives

### Beads Task Tracking (Windows)

**Always use PowerShell for bd commands.**

```bash
# View tasks
powershell -Command "bd ready"                    # Show unblocked work
powershell -Command "bd show <id>"                # Show issue details
powershell -Command "bd list -l <label>"          # List by label
powershell -Command "bd blocked"                  # Show blocked issues

# Create tasks (use 'create', NOT 'add')
powershell -Command "bd create 'Task title' -p 2 -l label1,label2 -t task"
powershell -Command "bd create 'Task title' -d 'Description here' -p 1"
# Priority: -p 0 (P0 highest) to -p 4 (P4 lowest), default P2
# Types: -t bug|feature|task|epic|chore (default: task)

# Add dependencies (positional args, NOT --blocks flag)
powershell -Command "bd dep add <issue-id> <depends-on-id> -t blocks"
# Example: bd dep add lims-lite-abc lims-lite-xyz -t blocks
# Means: abc depends on xyz (xyz blocks abc)

# Update tasks
powershell -Command "bd update <id> --status in_progress"
powershell -Command "bd close <id> -r 'Implementation details'"
# Can close multiple: bd close id1 id2 id3 -r 'Reason'

# Sync with remote
powershell -Command "bd sync"
```

**Common mistakes to avoid:**
- `bd add` → Use `bd create` instead
- `bd dep add X --blocks Y` → Use `bd dep add X Y -t blocks` (positional args)
- `bd close <id> --notes` → Use `-r` for reason, not `--notes`
- Missing `-t blocks` → Dependencies default to "blocks" type anyway

### Windows Command Execution

**CRITICAL:** When running commands on Windows, avoid mixing bash and Windows syntax.

**File system operations:**
```bash
# ❌ WRONG - Windows cmd syntax in bash (will fail)
if not exist "D:\path" mkdir "D:\path"

# ✅ CORRECT - Use PowerShell explicitly
powershell -Command "if (-not (Test-Path 'D:\path')) { New-Item -ItemType Directory -Path 'D:\path' }"

# ✅ CORRECT - Use bash syntax
[ ! -d "D:/path" ] && mkdir -p "D:/path"
```

**Directory creation:**
```bash
# ❌ WRONG
if not exist "src\components\feature" mkdir "src\components\feature"

# ✅ CORRECT (PowerShell)
powershell -Command "if (-not (Test-Path 'src\components\feature')) { New-Item -ItemType Directory -Path 'src\components\feature' }"

# ✅ CORRECT (bash-style, forward slashes)
mkdir -p src/components/feature
```

**Key rules:**
- Use `powershell -Command` for Windows-specific operations
- Use forward slashes (`/`) in paths for bash compatibility
- Never mix `if not exist`, `mkdir` (cmd) with bash syntax
- Prefer `mkdir -p` (bash) over Windows `mkdir` when possible

### Core Rules
1. **Compliance First**: Soft delete/void only, all changes auditable, respect RLS
2. **Database via Migrations**: SQL files in `supabase/migrations/`, include RLS policies
3. **Incremental Development**: Structure → functionality → validation
4. **Vietnamese Localization**: All UI in Vietnamese (see `docs/vietnamese_dictionary.md`)
5. **Type Safety**: Zod schemas, strict TypeScript, no `any` types

## CRITICAL: Tool Priority Rules

### 🔍 Code Search: ALWAYS use warp-grep
warp-grep is 4x faster and semantically understands code.

**Use warp-grep for:**
- Finding implementations
- Understanding code flows
- Debugging issues
- Exploring codebase
- ANY code-related search

**Syntax:** Semantic queries, not keywords
- ✅ "Where is user authentication handled?"
- ❌ "Find 'auth'" (too literal)

### ✏️ File Editing: ALWAYS use edit_file
edit_file is 60x faster and more accurate (98% vs 86%).

**Use edit_file for:**
- ALL modifications to existing files
- Works with partial snippets
- Use `// ... existing code ...` markers

**Never use:**
- ❌ write_file for edits
- ❌ str_replace (outdated)

## Workflow Pattern

Every code task follows:
1. **Search** with warp-grep → Understand context
2. **Edit** with edit_file → Make changes
3. **Verify** → Confirm changes work

## Tool Decision Matrix

| Task | Tool | Why |
|------|------|-----|
| Find code | warp-grep | Semantic, fast |
| Edit code | edit_file | Precise, efficient |
| Create file | write_file | Only for new files |
| Find config | search_files | OK for non-code |

## Examples

### Adding a Feature
```
1. warp-grep: "Where are API routes defined?"
2. edit_file: Add new route using the pattern
3. warp-grep: "How are routes tested?"
4. edit_file: Add test for new route
```

### Debugging
```
1. warp-grep: "Where does 'User not found' error occur?"
2. warp-grep: "How is user lookup implemented?"
3. edit_file: Fix the lookup logic
4. edit_file: Add error logging
```

## Anti-Patterns

❌ Using grep when warp-grep is available
❌ Using write_file to edit existing files
❌ Using str_replace at all
❌ Keyword search when semantic search is better

✅ Always warp-grep first to understand
✅ Always edit_file for modifications
✅ Use lazy edits with context markers
✅ Ask semantic questions to warp-grep

## Development Commands

```bash
npm run dev              # Start dev server (port 3000)
npm run build            # Production build
npm run typecheck        # Type checking (preferred for validation)
npm run lint             # ESLint

docker compose up -d     # Start Supabase stack
docker compose down      # Stop stack
docker compose logs -f   # View logs
```

## Backend Infrastructure

Self-hosted Supabase in Docker (NOT Supabase Cloud).

**Services:**
| Service | Container | Port |
|---------|-----------|------|
| PostgreSQL | lims-postgres | 5432 |
| Auth (GoTrue) | lims-auth | 9999 |
| REST (PostgREST) | lims-rest | 3001 |
| Storage | lims-storage | 5000 |
| API Gateway (Kong) | lims-kong | 8000 |
| Studio | lims-studio | 3002 |

**Key URLs:**
- API: `http://localhost:8000`
- Studio: `http://localhost:3002`

## Database Migration Workflow

**IMPORTANT:** We do NOT use Supabase CLI. Apply migrations via Docker.

### Quick Reference
```bash
# Apply migration (Windows)
powershell -Command "Get-Content supabase\migrations\XXX_name.sql | docker exec -i lims-postgres psql -U postgres -d postgres"

# Restart PostgREST after RPC function changes
docker compose restart rest

# Run security tests
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"

# Verify typecheck
npm run typecheck
```

### Migration Security (CRITICAL)
- **Always** `DROP POLICY IF EXISTS` before `CREATE POLICY`
- **Always** include role checks: `get_user_role() IN ('analyst', 'manager')`
- **Always** run `run_security_tests()` after migration
- **Never** use Supabase Studio for schema changes

**Full checklists:**
- [docs/MIGRATION_SECURITY_CHECKLIST.md](docs/MIGRATION_SECURITY_CHECKLIST.md)
- [docs/SQL_MIGRATION_PATTERNS.md](docs/SQL_MIGRATION_PATTERNS.md)

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login routes
│   ├── (dashboard)/         # Protected routes
│   │   ├── analyst/         # Analyst pages
│   │   └── manager/         # Manager pages
│   └── actions/             # Server Actions
├── components/
│   ├── ui/                  # Shadcn primitives
│   └── *.tsx                # Domain components
├── lib/
│   ├── supabase/            # Client/server setup
│   ├── data/                # Data fetching
│   └── utils.ts             # Utilities
└── types/index.ts           # Zod schemas & types

supabase/migrations/         # SQL migrations
docs/                        # Documentation
```

**Priority Files:**
1. `supabase/migrations/*.sql` - Schema, RLS, triggers
2. `src/types/index.ts` - Zod schemas
3. `src/app/actions/*.ts` - Server Actions
4. `src/components/*.tsx` - Feature components

## File Structure Expectations

- Files: 250-350 lines maximum, single responsibility
- Filenames: Descriptive, match content exactly
- Headers: First 5-10 lines explain purpose (multi-item files only)

## Code Quality Standards

- Self-documenting: names explain intent
- Clear variables: `userAuthenticatedAt` not `uat`
- Action-based functions: `calculateTaxForOrder()` not `calcTax()`
- Semantic directories: group by feature/domain, max 3-4 levels

## Working Approach

- Navigate first: Understand structure before reading code
- Read purposefully: Only open relevant files
- Trust the structure: Filename and location tell you what's inside
- Small focused changes: Maintain 250-350 line limit
- Keep it clean: Don't break existing conventions

## Quality Check

Before completing tasks:
1. Files under 350 lines
2. Filenames accurately describe content
3. Code is self-documenting
4. Directory structure stays logical
5. Changes follow existing patterns

## Token Optimization

- Don't read entire files unnecessarily
- Use grep to find specific patterns
- Check file headers before reading full content
- Navigate using directory structure, not memory


## Code Generation Preferences

**React:** Functional + TypeScript, React 19 features, Shadcn UI, lucide-react icons

**Forms:** react-hook-form + @hookform/resolvers + Zod

**Tables:** @tanstack/react-table v8, editable cells, keyboard navigation

**Styling:** Tailwind CSS v4, `cn()` helper

**State:** Server Components for data, useState for local UI
- Client components use `src/lib/api-client.ts` (hits `/api/client-actions`)
- Never import `src/app/actions/*` directly in client code

## Common Patterns

### Server Action with Validation
```typescript
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
  const result = schema.safeParse(Object.fromEntries(formData))
  if (!result.success) return { error: result.error.flatten() }

  const { error } = await supabase.from('samples').insert(result.data)
  if (error) return { error: error.message }

  revalidatePath('/manager/samples')
  return { success: true }
}
```

### Server Action with Role Check
```typescript
'use server'
import { requireRole, isAuthError } from '@/lib/auth-helpers'
import { createClient } from '@/lib/supabase/server'

export async function managerOnlyAction(id: string) {
  // 2 lines instead of 12 - validates session + role
  const auth = await requireRole('manager')
  if (isAuthError(auth)) return auth

  const supabase = await createClient()
  // auth.id and auth.role now available
  // ... rest of action
}
```

**Auth helpers** (`src/lib/auth-helpers.ts`):
- `requireAuth()` - Any authenticated user
- `requireRole('manager')` - Single role check
- `requireRole(['analyst', 'manager'])` - Multiple roles
- `isAuthError(result)` - Type guard for error handling

### Database Trigger
```sql
CREATE TRIGGER audit_log_trigger
  AFTER UPDATE ON results
  FOR EACH ROW
  EXECUTE FUNCTION trigger_audit_log();
```

## Error Handling

When database errors occur:
1. Check RLS policies (`supabase/migrations/003_rls_policies.sql`)
2. Check triggers (`supabase/migrations/002_audit_triggers.sql`)
3. Verify Zod schema matches DB constraints

**Common issues:**
- "RLS violation" → Analyst trying to modify approved result
- "Foreign key violation" → Referenced record doesn't exist
- "Not null violation" → Required field missing

## Testing Checklist

- [ ] Login as Analyst → Only analyst pages accessible
- [ ] Login as Manager → All pages accessible
- [ ] Accession sample → QR scanner, form validation
- [ ] Enter results → Grid navigation, batch save
- [ ] Approve results → Audit log updated
- [ ] Generate PDF → Correct data

## Deployment

**Local:** `docker compose up -d` → `npm run dev` → http://localhost:3000

**Production:** See `docs/DOCKER_SETUP.md`

**Cloud:** See `docs/DEPLOYMENT_RAILWAY.md` or `docs/DEPLOYMENT_RENDER.md`

## Key Principles

1. **Data Integrity > Speed**
2. **Audit Everything**
3. **Respect Roles** (RBAC at DB and UI)
4. **Build Incrementally**
5. **Vietnamese First**
6. **Type Safe**
7. **Self-Documented**

## Reference Documentation

| Topic | File |
|-------|------|
| Requirements | `docs/cdc-lims-mvp.md` |
| Technical Design | `docs/TechDesign-CDC-LIMS.md` |
| Database Setup | `docs/DATABASE_SETUP.md` |
| Docker Setup | `docs/DOCKER_SETUP.md` |
| Migration Security | `docs/MIGRATION_SECURITY_CHECKLIST.md` |
| Migration Patterns | `docs/SQL_MIGRATION_PATTERNS.md` |
| Full-Text Search | `docs/SEARCH_SETUP.md` |
| Localization | `docs/vietnamese_dictionary.md` |

## Git Workflow

See `AGENTS.md` for:
- Conventional Commits format
- File structure expectations (250-350 lines max)
- Code quality standards
- Session completion workflow

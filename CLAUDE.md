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

### Core Rules
1. **Compliance First**: Soft delete/void only, all changes auditable, respect RLS
2. **Database via Migrations**: SQL files in `supabase/migrations/`, include RLS policies
3. **Incremental Development**: Structure → functionality → validation
4. **Vietnamese Localization**: All UI in Vietnamese (see `docs/vietnamese_dictionary.md`)
5. **Type Safety**: Zod schemas, strict TypeScript, no `any` types

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

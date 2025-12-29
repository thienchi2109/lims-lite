# CLAUDE.md - CDC-LIMS Configuration

## Project Context

**Project:** CDC-LIMS (MVP) | **Stack:** Next.js 16, React 19, Supabase (Docker), PostgreSQL 16
**Goal:** 21 CFR Part 11 Compliant LIMS | **Localization:** Vietnamese UI
**Auth:** Access tokens 1h (`GOTRUE_JWT_EXP=3600`), Refresh 4h (`GOTRUE_REFRESH_TOKEN_EXPIRY=14400`)

## Core Rules

1. **Compliance First**: Soft delete/void only, all changes auditable, respect RLS
2. **Database via Migrations**: SQL in `supabase/migrations/`, include RLS policies
3. **Vietnamese Localization**: All UI in Vietnamese (see `docs/vietnamese_dictionary.md`)
4. **Type Safety**: Zod schemas, strict TypeScript, no `any` types

## Tool Priority (CRITICAL)

| Task | Tool | Notes |
|------|------|-------|
| Find code | warp-grep | Semantic queries: "Where is auth handled?" |
| Edit code | edit_file | Use `// ... existing code ...` markers |
| Create file | write_file | Only for new files |

**Workflow:** warp-grep → edit_file → verify

## Beads Task Tracking (Windows PowerShell)

```bash
powershell -Command "bd ready"                    # Show unblocked work
powershell -Command "bd create 'Title' -p 2 -l label -t task"  # Create (NOT 'add')
powershell -Command "bd dep add <id> <depends-on> -t blocks"   # Dependencies
powershell -Command "bd close <id> -r 'Reason'"   # Close with reason
```

## Windows Commands

Use `powershell -Command` or bash syntax with forward slashes. Never mix cmd syntax.
```bash
mkdir -p src/components/feature  # ✅ bash-style
```

## Development Commands

```bash
npm run dev          # Dev server :3000     | npm run typecheck  # Type check
npm run build        # Production build     | npm run lint       # ESLint
docker compose up -d # Start Supabase       | docker compose logs -f
```

## Backend (Self-hosted Supabase)

| Service | Container | Port |
|---------|-----------|------|
| PostgreSQL | lims-postgres | 5432 |
| Auth | lims-auth | 9999 |
| REST | lims-rest | 3001 |
| Storage | lims-storage | 5000 |
| Kong | lims-kong | 8000 |
| Studio | lims-studio | 3002 |

## Database Migrations

```bash
# Apply migration
powershell -Command "Get-Content supabase\migrations\XXX_name.sql | docker exec -i lims-postgres psql -U postgres -d postgres"
docker compose restart rest  # After RPC changes
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"
```

**Security:** Always `DROP POLICY IF EXISTS` before `CREATE POLICY`, include role checks, run `run_security_tests()` after migrations. See `docs/MIGRATION_SECURITY_CHECKLIST.md`.

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/              # Login
│   ├── (dashboard)/               # Protected routes
│   │   ├── analyst/               # accession, reports, results/[sampleId], samples
│   │   ├── manager/               # approvals, assays, qr-code, reports, results/[sampleId], samples, users
│   │   ├── profile/               # User profile
│   │   └── samples/               # Shared samples view
│   ├── actions/                   # Server Actions (entity-based: samples.ts, auth.ts, coa.ts)
│   ├── api/                       # auth, client-actions, coa, samples, signatures
│   └── coa/access/                # Public COA access
├── components/
│   ├── ui/                        # Shadcn primitives
│   ├── assay-definition-dialog/   # Assay form parts
│   ├── auth/                      # Auth guards
│   ├── hooks/                     # Component-specific hooks
│   ├── reports/                   # Report components
│   ├── sample-filters/            # Filter UI
│   ├── test-assignment/           # Test assignment grid
│   ├── walkthrough/tours/         # Onboarding tours
│   └── *.tsx                      # Domain components
├── hooks/                         # Shared hooks (use-samples, use-client, use-results-editor)
├── lib/
│   ├── supabase/                  # client.ts, server.ts, edge-admin.ts
│   ├── client-actions/            # Client action types
│   ├── coa/                       # COA template & helpers
│   ├── data/                      # Data fetching
│   ├── qr/                        # QR parsing
│   ├── walkthrough/               # Driver.js config
│   └── *.ts                       # Utils (auth-helpers, api-client, utils)
└── types/                         # Domain-split: core, lab, workflow, analytics, query-keys
```

**Priority Files:** migrations/*.sql → types/*.ts → actions/*.ts → hooks/*.ts → components/*.tsx

## Code Standards

- **Files:** 250-350 lines max, single responsibility
- **Names:** Self-documenting (`userAuthenticatedAt` not `uat`)
- **Functions:** Action-based (`calculateTaxForOrder()` not `calcTax()`)
NOTE: Always use context7 when I need code generation, setup or configuration steps, or library/API documentation. This means you should automatically use the Context7 MCP tools to resolve library id and get library docs without me having to explicitly ask.

## Code Generation

**React:** Functional + TypeScript, React 19, Shadcn UI, lucide-react
**Forms:** react-hook-form + @hookform/resolvers + Zod
**Tables:** @tanstack/react-table v8
**State:** Server Components for data, useState for local UI
**Client calls:** Use `src/lib/api-client.ts` (hits `/api/client-actions`), never import actions directly

## Common Patterns

### Server Action with Validation
```typescript
'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const schema = z.object({ sampleId: z.string().min(3), clientId: z.string().uuid() })

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

export async function managerOnlyAction(id: string) {
  const auth = await requireRole('manager')  // validates session + role
  if (isAuthError(auth)) return auth
  // auth.id and auth.role available
}
```

**Auth helpers:** `requireAuth()`, `requireRole('manager')`, `requireRole(['analyst', 'manager'])`, `isAuthError()`

## Error Handling

| Error | Cause |
|-------|-------|
| RLS violation | Analyst modifying approved result |
| Foreign key violation | Referenced record missing |
| Not null violation | Required field missing |

Check: RLS policies → triggers → Zod schema matches DB

## Testing Checklist

- [ ] Login as Analyst/Manager → correct access
- [ ] Accession sample → QR scanner, validation
- [ ] Enter/Approve results → Audit log updated
- [ ] Generate PDF → Correct data

## Deployment

**Local:** `docker compose up -d` → `npm run dev` → http://localhost:3000
**Production:** See `docs/DOCKER_SETUP.md` | **Cloud:** `docs/DEPLOYMENT_RAILWAY.md`

## Key Principles

1. Data Integrity > Speed | 2. Audit Everything | 3. Respect Roles (RBAC)
4. Vietnamese First | 5. Type Safe | 6. Self-Documented

## Reference Docs

| Topic | File |
|-------|------|
| Requirements | `docs/cdc-lims-mvp.md` |
| Technical Design | `docs/TechDesign-CDC-LIMS.md` |
| Database/Docker | `docs/DATABASE_SETUP.md`, `docs/DOCKER_SETUP.md` |
| Migrations | `docs/MIGRATION_SECURITY_CHECKLIST.md`, `docs/SQL_MIGRATION_PATTERNS.md` |
| Localization | `docs/vietnamese_dictionary.md` |

## Git Workflow

See `AGENTS.md` for Conventional Commits, file structure expectations, session workflow.

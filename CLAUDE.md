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

## ⚠️ ENFORCEMENT CHECKLIST (Read Before Every Action)

**BEFORE searching code, ASK:** Am I about to use `grep`, `Grep`, or `Glob`?
→ **STOP.** Use `mcp__filesystem-with-morph__warpgrep_codebase_search` instead.

**BEFORE editing code, ASK:** Am I about to use the `Edit` tool?
→ **STOP.** Use `mcp__filesystem-with-morph__edit_file` with `// ... existing code ...` placeholders.

**BEFORE generating code with a library, ASK:** Does this involve Supabase, React, Zod, TanStack, Recharts, or any external package?
→ **STOP.** Use Context7: `resolve-library-id` → `query-docs` FIRST.

**BEFORE looking for a function/class definition, ASK:** Do I need to find where something is defined or what calls it?
→ **STOP.** Use GKG: `mcp__gkg__search_codebase_definitions` or `mcp__gkg__get_references`.

**AFTER editing a file, CHECK:** Is the file now >350 lines?
→ **STOP.** Refactor immediately - extract to separate files.

**BEFORE any task, ASK:** Could ANY skill apply (even 1% chance)?
→ **STOP.** Invoke the skill FIRST before doing anything else.

| ❌ NEVER | ✅ ALWAYS |
|----------|-----------|
| `grep`, `Grep`, `rg` for code search | `warpgrep` MCP tool |
| `Edit` tool for file changes | `edit_file` MCP tool |
| Generate library code from memory | Context7 lookup first |
| Manual search for definitions | GKG `search_codebase_definitions` |
| Create files >350 lines | Split into focused modules |
| Skip skills that might apply | Invoke skill, then decide |
| Use `cat`, `head`, `tail` | Use `Read` tool |

## 🧠 CONTEXT ENGINEERING (MANDATORY SKILL - NON-NEGOTIABLE)

> **This is NOT optional.** Context engineering determines whether tasks succeed or fail at scale.
> **Invoke `Skill` tool with `context-engineering`** AT THE START of any session involving complex work.

### ❌ STOP Signs - You MUST Invoke Context Engineering Skill When:

| Situation | Why It Matters |
|-----------|----------------|
| Task has 5+ steps | Context will degrade without isolation |
| Conversation is getting long | Token budget exhaustion causes failures |
| You're about to spawn sub-agents | Need partitioning strategy |
| Cross-session work (user returns) | Must recover context via episodic memory |
| Debugging takes multiple attempts | Context pollution obscures root cause |
| Building anything with LLMs/agents | This IS context engineering |

### Automatic Triggers (No Judgment Required)

| Trigger | Immediate Action |
|---------|------------------|
| Token usage >50% estimated | `Skill: context-engineering` → apply compression |
| Starting multi-file refactor | Spawn isolated sub-agents per file group |
| User says "continue from yesterday" | Search episodic memory FIRST |
| Task involves prompt design | Context engineering principles apply |
| Performance/cost concerns raised | Optimization patterns needed |

### Core Principles (Internalize These)

1. **Quality > Quantity**: Smallest high-signal token set wins
2. **Four Buckets**: Write (externalize) → Select (retrieve) → Compress (summarize) → Isolate (sub-agents)
3. **Degradation is Silent**: Context issues don't throw errors - they cause subtle failures
4. **Sub-agents are Cheap**: Use them liberally for context isolation

### Reference Materials

Read `.claude/skills/context-engineering/references/` for:
- `fundamentals.md` - Core concepts
- `degradation.md` - Warning signs
- `optimization.md` - Token efficiency
- `compression.md` - Summarization techniques
- `memory.md` - Episodic memory patterns
- `multi-agent.md` - Partitioning strategies
- `evaluation.md` - Measuring effectiveness
- `tool-design.md` - Tool call optimization

## Tool Priority (CRITICAL)

| Task | Tool | Notes |
|------|------|-------|
| Find code | warpgrep | `mcp__filesystem-with-morph__warpgrep_codebase_search` - semantic queries |
| Edit code | edit_file | `mcp__filesystem-with-morph__edit_file` - use `// ... existing code ...` |
| Create file | write_file | Only for new files |
| Library docs | Context7 | `mcp__context7__resolve-library-id` → `mcp__context7__query-docs` |

**MCP Tools - USE PROACTIVELY:**

1. **Morph (warpgrep)** - For ANY code search:
   - Use BEFORE grep/glob for semantic queries like "Where is auth handled?"
   - Faster and smarter than manual file searching
  **Workflow:** warpgrep → edit_file → verify

2. **Context7** - For ANY library/framework questions:
   - Code generation with external libraries (Supabase, React, Zod, etc.)
   - Setup or configuration steps
   - API documentation lookup
   - Always: `resolve-library-id` first → then `query-docs`

      NOTE: Always use context7 when I need code generation, setup or configuration steps, or library/API documentation. This means you should automatically use the Context7 MCP tools to resolve library id and get library docs without me having to explicitly ask.

3. **GitLab Knowledge Graph (GKG)** 
This project is indexed with **GitLab Knowledge Graph MCP**. You have access to the following tools:

    #### When to Use GKG:

    **✅ ALWAYS use GKG for:**
    - Finding where functions/classes are defined
    - Understanding code structure and relationships
    - Discovering what calls/uses a specific function
    - Mapping dependencies between modules
    - Finding all implementations of an interface/class
    - Impact analysis ("what breaks if I change X?")
    - Locating test files for specific code

    **❌ DON'T use GKG for:**
    - Understanding business logic flow (use code reading instead)
    - Finding configuration values (just read config files)
    - Simple grep tasks (e.g., "find string 'TODO'")
    - When user explicitly asks to read specific files

    #### Available GKG Tools:

    1. **`list_projects`**
      - Lists all indexed projects in knowledge graph
      - Use when: User asks "what projects do you have access to?"

    2. **`search_codebase_definitions`**
      - Search for functions, classes, methods, types, interfaces
      - Parameters: `query` (string), `project_name` (optional)
      - Example: Find all controller classes, locate UserService, find calculatePrice function
      - **Use this FIRST** when user asks about specific code elements

    3. **`get_references`**
      - Find all places where a definition is used/called
      - Parameters: `uri` (from search results), `project_name`
      - Example: "What calls this function?", "Where is this class used?"
      - **Critical for impact analysis**

    4. **`get_definition`**
      - Get full details of a specific definition
      - Parameters: `uri` (from search results), `project_name`
      - Returns: Code location, signature, documentation
      - Use when: Need exact implementation details

    5. **`reindex_project`**
      - Refresh knowledge graph after code changes
      - Only use if: User reports stale/missing results
      - Note: Requires GKG server restart


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
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"
```

**IMPORTANT - After RPC/Function Changes:**
```bash
docker compose restart rest  # Refresh PostgREST schema cache
```
Without this, you'll get "Could not find the function in the schema cache" errors.

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

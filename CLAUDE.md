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

**BEFORE searching code, ASK:** Do I need broad semantic discovery, symbol graph context, or an exact string lookup?
→ **STOP.** In this repo, prefer `gitnexus` first for graph-backed discovery. Use Morph `codebase_search` only as a single in-flight semantic search when needed. If Morph returns `429`, fall back immediately to `gitnexus` and then `rg` for exact text lookups.

**BEFORE editing code, ASK:** Am I about to use the `Edit` tool?
→ **STOP.** Use `mcp__filesystem-with-morph__edit_file` with `// ... existing code ...` placeholders.

**BEFORE generating code with a library, ASK:** Does this involve Supabase, React, Zod, TanStack, Recharts, or any external package?
→ **STOP.** Use Context7: `resolve-library-id` → `query-docs` FIRST.

**BEFORE looking for a function/class definition, ASK:** Do I need symbol context, callers/callees, or blast-radius analysis?
→ **STOP.** Use GitNexus: `gitnexus context <symbol> --file <path>` for symbol context or `gitnexus impact <symbol>` for blast radius. Use `gitnexus query <term>` for graph-backed discovery.

**AFTER editing a file, CHECK:** Is the file now >350 lines?
→ **STOP.** Refactor immediately - extract to separate files.

**BEFORE any task, ASK:** Could ANY skill apply (even 1% chance)?
→ **STOP.** Invoke the skill FIRST before doing anything else.

| ❌ NEVER | ✅ ALWAYS |
|----------|-----------|
| Parallel Morph search from multiple agents | Single-flight Morph search only; otherwise use GitNexus |
| Keep retrying Morph after `429` | Fall back to `gitnexus` then `rg` |
| `grep`, `Grep`, `rg` for broad semantic search | `gitnexus` first, Morph as secondary semantic tool |
| `Edit` tool for file changes | `edit_file` MCP tool |
| Generate library code from memory | Context7 lookup first |
| Manual symbol lookup / callers | GitNexus `context` / `impact` |
| Create files >350 lines | Split into focused modules |
| Skip skills that might apply | Invoke skill, then decide |
| Use `cat`, `head`, `tail` | Use `Read` tool |

## 🐛 DEBUGGING & PROBLEM-SOLVING (AUTO-INVOKE SKILLS)

> **These skills are NOT optional when triggers are detected.**
> Invoke the appropriate skill BEFORE attempting any fix or solution.

### Skill Invocation Table

| Skill | Invoke Command | When to Auto-Use |
|-------|----------------|------------------|
| **systematic-debugging** | `Skill: superpowers:systematic-debugging` | Bug, error, test failure, unexpected behavior |
| **beads-triage** | `Skill: beads-triage` | Session start, task selection, after completing work |
| **planning-pipeline** | `Skill: planning-pipeline` | After brainstorming, before implementation |
| **test-driven-development** | `Skill: superpowers:test-driven-development` | Before implementing fix, need failing test |
| **verification-before-completion** | `Skill: superpowers:verification-before-completion` | Before claiming "done" or "fixed" |

### 🔴 STOP Signs - You MUST Invoke Debugging Skill When:

| Trigger Keywords | Immediate Action |
|------------------|------------------|
| "error", "failed", "broken", "doesn't work" | `Skill: superpowers:systematic-debugging` |
| "bug", "crash", "exception", "unexpected" | `Skill: superpowers:systematic-debugging` |
| Test failure output | `Skill: superpowers:systematic-debugging` |
| Stack trace in message | `Skill: superpowers:systematic-debugging` |
| "fix", "solve", "debug", "investigate" | `Skill: superpowers:systematic-debugging` |
| "stuck", "can't figure out", "tried everything" | `Skill: problem-solving:when-stuck` |
| "where does X come from", "trace" | Use root-cause-tracing technique |
| Previous fix didn't work | `Skill: superpowers:systematic-debugging` (restart Phase 1) |
| 3+ fixes failed | STOP - Question architecture, discuss with user |

### The Iron Law of Debugging

```
╔═══════════════════════════════════════════════════════════════╗
║  NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST              ║
║                                                               ║
║  If you haven't completed Phase 1, you CANNOT propose fixes.  ║
╚═══════════════════════════════════════════════════════════════╝
```

### Four Phases (Must Complete In Order)

| Phase | Key Activities | Success Criteria |
|-------|----------------|------------------|
| **1. Root Cause** | Read errors, reproduce, check changes, gather evidence | Understand WHAT and WHY |
| **2. Pattern** | Find working examples, compare differences | Identify what's different |
| **3. Hypothesis** | Form single theory, test minimally | Confirmed or new hypothesis |
| **4. Implementation** | Create failing test, fix, verify | Bug resolved, tests pass |

### Pre-Fix Checklist (Verify Before ANY Fix)

```
□ Have I read the full error message?
□ Can I reproduce the issue?
□ Do I understand WHERE it breaks?
□ Do I understand WHY it breaks?
□ Have I traced back to the root cause?
□ Have I formed a single hypothesis?
□ Am I proposing ONE change, not multiple?

If any □ unchecked → Continue investigation
If all ☑ checked → Propose fix
```

### Red Flags - STOP and Return to Phase 1

If catching yourself thinking:
- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "It's probably X, let me fix that"
- "I don't fully understand but this might work"
- "One more fix attempt" (when already tried 2+)

**ALL of these mean: STOP. Return to Phase 1.**

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
| File autocomplete | File Suggestion | rg + fzf fuzzy matching (~50ms) |
| Find code by concept | GitNexus | `gitnexus query <term>` first in this repo |
| Find code by semantic natural-language search | Morph `codebase_search` | Single-flight only; do not run parallel Morph searches |
| Find symbol context | GitNexus | `gitnexus context <symbol> --file <path>` - definitions, callers, callees |
| Impact analysis | GitNexus | `gitnexus impact <symbol>` - upstream blast radius before changes |
| Exact string / config lookup | `rg` | Use after GitNexus or when Morph is rate-limited |
| Edit code | edit_file | `mcp__filesystem-with-morph__edit_file` - use `// ... existing code ...` |
| Create file | write_file | Only for new files |
| Library docs | Context7 | `mcp__context7__resolve-library-id` → `mcp__context7__query-docs` |

**Hybrid Search Strategy:**
- **Layer 1 (Graph Context):** GitNexus - `query`, `context`, `impact`
- **Layer 2 (Semantic):** Morph `codebase_search` for one broad natural-language search at a time
- **Layer 3 (Exact Text):** `rg` for config keys, SQL text, literals, and fallback after Morph `429`

**MCP Tools - USE PROACTIVELY:**

1. **Morph (warpgrep / `codebase_search`)** - For broad semantic exploration only:
   - Do not launch more than one Morph search at a time
   - Do not assign parallel Morph searches to multiple subagents in the same task
   - If Morph returns `429`, stop using it for the current task/session and switch to GitNexus + `rg`
  **Workflow:** GitNexus → single Morph search if needed → `rg` / direct reads → edit_file → verify

2. **Context7** - For ANY library/framework questions:
   - Code generation with external libraries (Supabase, React, Zod, etc.)
   - Setup or configuration steps
   - API documentation lookup
   - Always: `resolve-library-id` first → then `query-docs`

      NOTE: Always use context7 when I need code generation, setup or configuration steps, or library/API documentation. This means you should automatically use the Context7 MCP tools to resolve library id and get library docs without me having to explicitly ask.

3. **GitNexus**
This machine has a working global `gitnexus` CLI. Use it as the default graph-based code intelligence tool for this repo.
If multiple GitNexus indexes exist on this machine, prefer `--repo lims-lite` in this workspace.

    #### When to Use GitNexus:

    **✅ ALWAYS use GitNexus for:**
    - Inspecting a known symbol with callers/callees
    - Impact analysis before refactors, renames, and shared-utility edits
    - Mapping dependencies between modules
    - Discovering inbound usages of a function/class/symbol
    - Graph-backed concept lookup when raw text search is too shallow

    **❌ DON'T use GitNexus for:**
    - Simple string/config searches (use Morph or direct file reads)
    - Understanding business logic flow end-to-end without first reading the code
    - Requests where the user explicitly asked to read specific files
    - Blindly running `gitnexus analyze` in this repo without approval

    #### Safe GitNexus Workflow:

    1. **`gitnexus status`**
      - Check whether the current repo is already indexed
      - Use first before assuming graph commands will work

    2. **`gitnexus list`**
      - Lists indexed repositories
      - Use when multiple repos may be registered
      - If more than one repo is listed, use `--repo lims-lite` in follow-up commands from `E:\lims-lite`

    3. **`gitnexus query <term>`**
      - Graph-backed concept search across the indexed repo
      - Prefer `gitnexus query <term> --repo lims-lite` when more than one repo is indexed
      - Use after Morph when you know the concept/module and want relationship-aware results

    4. **`gitnexus context <symbol> --file <path>`**
      - Best default for a known symbol
      - Prefer `gitnexus context <symbol> --repo lims-lite --file <path>` when more than one repo is indexed
      - Returns definition context plus inbound/outbound relationships
      - Use for: "where is this used?", "what does this call?", "show me the symbol neighborhood"

    5. **`gitnexus impact <symbol>`**
      - Blast-radius analysis for upstream dependants
      - Prefer `gitnexus impact <symbol> --repo lims-lite` when more than one repo is indexed
      - Use before changing shared helpers, hooks, utilities, and types

    6. **`gitnexus analyze [path]`**
      - Indexes a repository and generates local helper files
      - **Do not run this in `E:\lims-lite` unless the user explicitly asks or you are in a disposable worktree**
      - Reason: it can generate/update `AGENTS.md`, `CLAUDE.md`, and `.claude/skills/*`


## Beads Task Tracking + Beads Viewer (Windows PowerShell)

### 🎯 Session Workflow (Start Every Session)

```bash
# 1. Get AI-optimized task recommendations
powershell -Command "bv --robot-triage"           # Full triage with scores & recommendations

# 2. Pick your next task
powershell -Command "bv --robot-next"             # Single top pick with claim command

# 3. Claim and start work
powershell -Command "bd update <id> --status=in_progress"

# 4. Close when done
powershell -Command "bd close <id> -r 'Reason'"
```

### 📊 Beads Viewer Robot Commands (Use for AI Workflows)

| Command | Purpose |
|---------|---------|
| `bv --robot-triage` | **Primary command** - Full triage with recommendations, blockers, quick wins |
| `bv --robot-next` | Single top pick + claim command |
| `bv --robot-plan` | Parallel execution tracks for sprints |
| `bv --robot-insights` | Full graph metrics (PageRank, betweenness, bottlenecks) |
| `bv --robot-label-health` | Per-label health scores |
| `bv --robot-diff --diff-since HEAD~5` | Changes since git ref |
| `bv --robot-graph --graph-format=mermaid` | Dependency graph export |

**Scoping & Filtering:**
```bash
bv --robot-plan --label backend    # Scope to label's subgraph
bv --robot-insights --as-of HEAD~30  # Historical point-in-time
bv --recipe actionable --robot-plan  # Pre-filter: no blockers
```

### 🔧 Beads CLI Commands

```bash
powershell -Command "bd ready"                    # Show unblocked work
powershell -Command "bd create 'Title' -p 2 -l label -t task"  # Create (NOT 'add')
powershell -Command "bd dep add <id> <depends-on> -t blocks"   # Dependencies
powershell -Command "bd close <id> -r 'Reason'"   # Close with reason
powershell -Command "bd show <id>"                # Show issue details
powershell -Command "bd doctor"                   # Health check
```

### 🧠 Graph Analysis Metrics (via `bv --robot-insights`)

- **PageRank**: Identifies foundational blockers (recursive importance)
- **Betweenness**: Reveals bottlenecks and bridges (shortest-path traffic)
- **Critical Path**: Shows keystones with zero slack (longest chain)
- **HITS**: Hub/Authority duality (distinguishes epics from infrastructure)

## Windows Commands

Use `powershell -Command` or bash syntax with forward slashes. Never mix cmd syntax.
```bash
mkdir -p src/components/feature  # ✅ bash-style
```
- Python scripts with Unicode: use `powershell -Command "python -X utf8 'script.py'"` (not `set PYTHONIOENCODING`)

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

## Session Management

**Token Expiry:**
- Access tokens: 1h (`GOTRUE_JWT_EXP=3600`)
- Refresh tokens: 4h (`GOTRUE_REFRESH_TOKEN_EXPIRY=14400`)
- Absolute session lifetime: 4h (enforced by middleware)

**Cookie Configuration (CRITICAL):**
- Cookie name MUST be consistent across ALL Supabase clients
- Use `SUPABASE_COOKIE_NAME` from `src/lib/supabase/constants.ts`
- Files that must use this constant:
  - `src/lib/supabase/client.ts` (browser)
  - `src/lib/supabase/server.ts` (server)
  - `src/middleware.ts` (middleware)
- **WHY:** Supabase SSR defaults to URL-derived cookie names, causing mismatches between localhost/Docker/production
- **TEST:** `src/__tests__/supabase-cookie-consistency.test.ts` verifies consistency

**Concurrent Login Prevention:**
- Only one active session per user allowed
- New login invalidates all existing sessions for that user
- Previous devices logged out on next request
- Implementation: `invalidate_other_user_sessions()` RPC called in `src/app/actions/auth.ts:62-86`

**Session Invalidation Flow:**
1. User logs in with `signInWithPassword()` → new session created
2. `get_latest_session_id()` RPC retrieves the new session ID
3. `invalidate_other_user_sessions()` RPC deletes OTHER sessions (keeps current)
4. Middleware (`src/middleware.ts`) validates session on every request
5. Client guard (`SessionTimeboxGuard`) polls for session expiry
6. Invalid sessions redirect to `/login`

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

# DATABASE QUERY RULES (MUST FOLLOW)

## Token Optimization Requirements

### 1. SELECT Queries - MANDATORY
- ❌ NEVER use `SELECT *` in any query
- ✅ ALWAYS specify exact columns needed: `SELECT column1, column2 FROM table`
- ✅ Add LIMIT for test queries: `SELECT columns FROM table LIMIT 10`
- Reason: Every returned field consumes tokens in context window

### 2. Query Result Handling
- For results > 50 rows: Summarize key insights, don't include full dataset in response
- For large datasets: Save to file and provide reference pointer
- Always count rows returned and report: "Query returned N rows"

### 3. Column Selection Priority
- Only SELECT columns that directly answer the user's question
- Exclude: timestamps, IDs, metadata unless specifically requested
- Example: For "get user names" → `SELECT name FROM users` NOT `SELECT * FROM users`

### 4. Development Phase Practices
- Even with small test data, practice selective queries
- Use LIMIT during testing to prevent unnecessary token usage
- Monitor and log token consumption per query

## Why This Matters
- Database results consume tokens proportionally to data returned
- `SELECT *` with 1000 rows × 200 tokens/row = 200K tokens wasted
- Selective queries can reduce token usage by 70-90%

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

**Server Action Barrel Files:** When splitting large action files into modules, the barrel file (re-export file) must NOT have `'use server'` directive. Each sub-module should have its own `'use server'`. Next.js requires `'use server'` files to only export async functions directly - re-exports are not allowed.

## Error Handling

| Error | Cause |
|-------|-------|
| RLS violation | Analyst modifying approved result |
| Foreign key violation | Referenced record missing |
| Not null violation | Required field missing |

Check: RLS policies → triggers → Zod schema matches DB

## Testing

- **Test runner:** `vitest` (NOT Jest) — use `npx vitest run <path>` for individual tests
- Existing regression test pattern: `src/__tests__/supabase-cookie-consistency.test.ts` (static file analysis)

## Route Architecture

- `/` — Public CDC Portal (no auth, statically prerendered)
- `/login` — Login page
- `/analyst/*` — Analyst dashboard (protected)
- `/manager/*` — Manager dashboard (protected)
- Profile "back" link uses role-based routing (`/manager` or `/analyst`), NOT `/`

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

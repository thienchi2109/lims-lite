
## Project Orientation

See `CLAUDE.md` for:
- Stack: Next.js 16 + React 19, self-hosted Supabase/PostgreSQL
- Goal: 21 CFR Part 11 compliant LIMS MVP
- Compliance: soft delete/void only, all mutations auditable, respect RLS
- Database: SQL migrations in `supabase/migrations/`, apply/query via Docker only
- Localization: All UI in Vietnamese (see `docs/vietnamese_dictionary.md`)
- Validation: Zod schemas, strict TypeScript
- Client-side: Use `src/lib/api-client.ts` for mutations (not direct imports from `src/app/actions/*`)

## Environment Responsibilities (CRITICAL)

- This workspace (`/root/lims-lite`) is source-control only: inspect, edit, test,
  commit, and push code.
- Do not deploy or operate production Docker containers, PostgreSQL, Storage,
  backups, or Cloudflare Tunnel in this environment.
- The authoritative build, deployment, and operations environment is the home
  server:
  - Hostname: `khoa-xn-cdc`
  - Tailscale IP: `100.93.19.42`
  - SSH user: `khoa-xn-cdc`
  - Production checkout: `/opt/lims-lite`
- Connect from this environment with
  `ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42`.
- Windows/Termius clients must be connected to the same Tailscale tailnet and
  use `C:\Users\admin\.ssh\id_ed25519_lims_home`. Password authentication is
  disabled and must not be re-enabled.
- After connecting, run production commands from `/opt/lims-lite` and prefix
  Docker operations with `sudo -n`.
- Only the home server may run the production Cloudflare Tunnel connector.
  Never start LIMS or Tunnel containers in this workspace.
- Never commit or copy SSH private keys, Tunnel tokens, `.env` secrets, or
  `age` identities into the repository.

## Database Migration Security (CRITICAL)

**MANDATORY:** Follow security checklist for RLS policy migrations.

### Quick Rules
1. `DROP POLICY IF EXISTS` before `CREATE POLICY`
2. Include role checks: `get_user_role() IN ('analyst', 'manager')`
3. Document security impact in migration files
4. Run `run_security_tests()` after every migration
5. Never use Supabase Studio for schema changes
6. Never use Supabase MCP or Supabase CLI for this repo's database

### Applied Migration Immutability (NON-NEGOTIABLE)

- A migration becomes immutable immediately after it is executed against any
  persistent database, including the repo's local Docker database.
- Never edit its SQL, rename it, reorder it, delete it, squash it, or reuse its
  filename/version. An uncommitted or untracked migration can still be applied;
  Git status is not evidence that it is safe to change.
- If applied status is uncertain, treat the migration as applied until database
  evidence proves otherwise.
- Fixes and follow-up changes MUST use a new, next-numbered forward-only
  migration. The new migration should validate its expected baseline, make the
  smallest required change, and verify the resulting state.
- Never patch a database by modifying and re-running an applied migration.
  Apply only the new forward-only migration through
  `docker exec ... lims-postgres psql`.
- Tests and documentation may be updated, but the historical applied migration
  file must remain byte-for-byte unchanged.

### Database Access Boundary

- Production Supabase/PostgreSQL is self-hosted in Docker on the home server.
- This workspace must not run or operate the production database.
- The only approved database access path is SSH to the home server followed by
  `sudo -n docker exec ... lims-postgres psql`.
- Do not use Supabase MCP tools for inspection, queries, migrations, or validation.
- Do not use Supabase CLI commands for local or remote DB operations.

**Full checklist:** `docs/MIGRATION_SECURITY_CHECKLIST.md`

### Post-Migration Commands
```bash
# Apply a committed migration from the home-server checkout
rtk ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite && sudo -n docker exec -i lims-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/XXX_name.sql"

# Run security tests (MANDATORY)
rtk ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  "sudo -n docker exec lims-postgres psql -U postgres -d postgres -c 'SELECT * FROM run_security_tests();'"

# Verify policy state
rtk ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  "sudo -n docker exec lims-postgres psql -U postgres -d postgres -c \"SELECT polname FROM pg_policy WHERE polrelid = 'public.TABLE_NAME'::regclass;\""

# Test source in this workspace and verify the deployed application
rtk npm run typecheck
rtk curl -fsS https://cdclims.cloud/auth/v1/health
```

## Superpowers Skills

- Local: Run `~/.codex/superpowers/.codex/superpowers-codex bootstrap` at session start
- VPS (this environment): Superpowers dir is `/root/.codex/superpowers`
- VPS bootstrap: `mkdir -p /root/.agents/skills && ln -sfn /root/.codex/superpowers/skills /root/.agents/skills/superpowers`
- Check for applicable skills before starting tasks
- Local: Load with `~/.codex/superpowers/.codex/superpowers-codex use-skill <skill>`
- VPS: Load directly from `/root/.codex/superpowers/skills/<skill>/SKILL.md`
- Follow skill checklists; don't skip mandatory workflows

## Git Workflow

### Conventional Commits

Format: `<type>: <subject>`

**Types:**
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only
- **refactor**: Code restructure (no feature/fix)
- **style**: Formatting only
- **test**: Add/update tests
- **chore**: Build/config changes
- **perf**: Performance improvements

**Examples:**
```
feat: Add Google login button to homepage
fix: Correct login logic for admin user
refactor: Optimize database query in practitioners list
```

**Best Practices:**
- Imperative mood: "Add feature" not "Added feature"
- Under 100 characters
- No period at end
- Reference issues: `fix: Resolve login error (#123)`

### Extended Format
```
<type>: <subject>

<body>

<footer>
```

## File Structure Expectations

- Application and test files: target 250-350 lines, single responsibility
- SQL migrations may exceed 350 lines when baseline assertions, security
  hardening, and verification must remain atomic and auditable. Do not split or
  compress migration logic when that would reduce correctness or reviewability.
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
- Small focused changes: Maintain the 250-350 line target outside justified
  SQL migration exceptions
- Keep it clean: Don't break existing conventions

## Session Memory Recall (CRITICAL)

**MANDATORY:** At the start of every session in this repository, before
planning, code exploration, or edits:

- Recall repo-scoped durable memory from agentmemory for the current workspace.
- Query with 3-6 distinctive concepts: repository name plus the change, feature,
  file, or phase. Example: `lims-lite add-sample-quality-assessment Phase 2`.
- Avoid long over-constrained queries and generic recency phrases such as
  `most recent work`; either can return no results even when the memory exists.
- If recall is empty, retry with fewer concrete concepts before treating memory
  as unavailable. After `memory_save`, verify immediately using the same short
  distinctive concepts.
- Do not rely on session association or relative recency. When the newest record
  matters, retrieve candidates with short queries and compare their `createdAt`
  values.
- Use recalled decisions, constraints, prior issue context, and verified
  workflows to guide discovery.
- Re-check drift-prone facts against the current repository, GitHub, or runtime
  state before relying on them.
- If recall is unavailable or empty, state that briefly and continue with
  repository inspection. Never silently skip the recall step.

## Context-Mode Usage (CRITICAL)

**MANDATORY:** Use context-mode for repo work in this workspace.

- Use `ctx_batch_execute` for grouped reads, searches, status checks, `gh`/`git` inspection, and multi-command context gathering.
- Use `ctx_execute` for tests, typecheck, lint, builds, and any command that can produce more than a few lines of output.
- Use `ctx_execute_file` when analyzing a file without editing it.
- Use `apply_patch` for file edits.
- Do not use direct shell/`exec_command` for repo exploration, tests, lint/typecheck, `git status`, `git diff`, `gh pr view`, or long command output unless context-mode cannot perform the action.
- Direct shell is acceptable only for truly tiny commands with fixed short output or interactive/process-control cases; still prefix commands with `rtk`.

## Code Graph Tooling

- Prefer `gitnexus` for graph-based code navigation in this repo
- If `gitnexus list` shows multiple indexed repos, prefer `--repo lims-lite` for commands in this workspace
- Use `gitnexus context <symbol> --file <path>` to inspect a known symbol and its callers/callees
- Use `gitnexus impact <symbol>` before refactors, renames, or dependency-sensitive edits
- Use `gitnexus query <term>` when you know the concept/module and want graph-backed discovery beyond raw text search
- Use targeted file reads for configuration lookup and business-logic walkthroughs
- Run `gitnexus status` or `gitnexus list` before assuming a repo is already indexed
- Do not run `gitnexus analyze` in `E:\lims-lite` unless the user explicitly asks or you are working in an isolated worktree, because it generates repo files such as `AGENTS.md`, `CLAUDE.md`, and `.claude/skills/*`
- Prefer `gitnexus` first when the repo is indexed; use `rg` for exact-string
  and configuration lookups or when graph results are insufficient

## Quality Check

Before completing tasks:
1. Files under 350 lines where practical; longer SQL migrations must remain
   single-purpose, explicit, and easier to audit than a split or compressed form
2. Filenames accurately describe content
3. Code is self-documenting
4. Directory structure stays logical
5. Changes follow existing patterns
6. Run focused tests that cover the changed behavior and immediate blast radius
7. Run the full test suite only for shared-core/risky changes or when explicitly requested

## Token Optimization

- Don't read entire files unnecessarily
- Use grep to find specific patterns
- Check file headers before reading full content
- Navigate using directory structure, not memory

## Landing the Plane (Session Completion)

**MANDATORY:** Work is NOT complete until `git push` succeeds.

1. File issues for remaining work
2. Run scoped quality gates: focused tests first, plus relevant linters/builds/typecheck for the touched area
3. Update issue status
4. **PUSH TO REMOTE:**
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. Clean up stashes, prune branches
6. Verify all changes committed AND pushed
7. Hand off context for next session

**CRITICAL:**
- NEVER stop before pushing
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry

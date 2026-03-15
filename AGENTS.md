<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

## Project Orientation

See `CLAUDE.md` for:
- Stack: Next.js 16 + React 19, self-hosted Supabase/PostgreSQL
- Goal: 21 CFR Part 11 compliant LIMS MVP
- Compliance: soft delete/void only, all mutations auditable, respect RLS
- Database: SQL migrations in `supabase/migrations/`, apply via Docker
- Localization: All UI in Vietnamese (see `docs/vietnamese_dictionary.md`)
- Validation: Zod schemas, strict TypeScript
- Client-side: Use `src/lib/api-client.ts` for mutations (not direct imports from `src/app/actions/*`)

## Database Migration Security (CRITICAL)

**MANDATORY:** Follow security checklist for RLS policy migrations.

### Quick Rules
1. `DROP POLICY IF EXISTS` before `CREATE POLICY`
2. Include role checks: `get_user_role() IN ('analyst', 'manager')`
3. Document security impact in migration files
4. Run `run_security_tests()` after every migration
5. Never use Supabase Studio for schema changes

**Full checklist:** `docs/MIGRATION_SECURITY_CHECKLIST.md`

### Post-Migration Commands
```bash
# Apply migration
Get-Content supabase\migrations\XXX_name.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# Run security tests (MANDATORY)
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"

# Verify policy state
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname FROM pg_policy WHERE polrelid = 'public.TABLE_NAME'::regclass;"

# Test application
npm run typecheck
npm run dev
```

## Superpowers Skills

- Run `~/.codex/superpowers/.codex/superpowers-codex bootstrap` at session start
- Check for applicable skills before starting tasks
- Load with `~/.codex/superpowers/.codex/superpowers-codex use-skill <skill>`
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

## Code Graph Tooling

- Prefer `gitnexus` for graph-based code navigation in this repo
- If `gitnexus list` shows multiple indexed repos, prefer `--repo lims-lite` for commands in this workspace
- Use `gitnexus context <symbol> --file <path>` to inspect a known symbol and its callers/callees
- Use `gitnexus impact <symbol>` before refactors, renames, or dependency-sensitive edits
- Use `gitnexus query <term>` when you know the concept/module and want graph-backed discovery beyond raw text search
- Use Morph or targeted file reads for semantic exploration, configuration lookup, and business-logic walkthroughs
- Run `gitnexus status` or `gitnexus list` before assuming a repo is already indexed
- Do not run `gitnexus analyze` in `E:\lims-lite` unless the user explicitly asks or you are working in an isolated worktree, because it generates repo files such as `AGENTS.md`, `CLAUDE.md`, and `.claude/skills/*`

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

## Landing the Plane (Session Completion)

**MANDATORY:** Work is NOT complete until `git push` succeeds.

1. File issues for remaining work
2. Run quality gates (tests, linters, builds)
3. Update issue status
4. **PUSH TO REMOTE:**
   ```bash
   git pull --rebase
   bd sync
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

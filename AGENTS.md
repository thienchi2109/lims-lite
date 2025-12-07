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

## Project Orientation (see `CLAUDE.md`)

- `CLAUDE.md` is the primary brief: Next.js 16 + React 19, self-hosted Supabase/PostgreSQL; goal is a 21 CFR Part 11 compliant LIMS MVP.
- Compliance first: prefer soft delete/void over hard delete; all mutations must be auditable and respect RLS.
- Database work only via SQL migrations in `supabase/migrations`; include RLS policies/triggers and apply through Docker (not the Supabase dashboard).
- All UI text is Vietnamese; use `docs/vietnamese_dictionary.md` and keep validation/type safety with Zod schemas and strict TypeScript.
- Build incrementally: validate inputs in Server Actions, lean on existing patterns/components listed in `CLAUDE.md`.

## Superpowers Skills

- Superpowers are installed; run `~/.codex/superpowers/.codex/superpowers-codex bootstrap` at session start to list available skills.
- Before starting a task, check for applicable skills (especially `using-superpowers`, `brainstorming`, `test-driven-development`, `systematic-debugging`) and load them with `~/.codex/superpowers/.codex/superpowers-codex use-skill <skill>`.
- Follow skill checklists with `update_plan` todos when required; do not skip mandatory workflows (brainstorm before coding, evidence before completion).
- Personal skills live in `~/.codex/skills`; superpowers skills live in `~/.codex/superpowers/skills`.

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

### File Structure Expectations

1. Files: 250-350 lines maximum, single responsibility
2. Filenames: Descriptive and match content exactly

3. Single class/function: OrderService.ts, calculateTax.py
4. Multiple items: update_inventory_on_order_placed.go


Headers: First 5-10 lines explain purpose for multi-item files only

### Code Quality Standards

Self-documenting: names explain intent completely
Clear variable names: userAuthenticatedAt not uat
Action-based functions: calculateTaxForOrder() not calcTax()
Semantic directories: group by feature/domain, max 3-4 levels deep

### Working Approach

Navigate first: Understand structure before reading code
Read purposefully: Only open files relevant to current task
Trust the structure: Filename and location tell you what's inside
Small focused changes: Maintain the 250-350 line limit
Keep it clean: Don't break existing conventions

### When Making Changes

Maintain single-responsibility principle
Keep filenames accurate to content
Split files that exceed 350 lines
Update file headers if purpose changes
Follow existing naming patterns

### Token Optimization

Don't read entire files unnecessarily
Use grep to find specific patterns
Check file headers before reading full content
Navigate using directory structure, not memory

### Quality Check
Before completing tasks, ensure:

1. Files remain under 350 lines
2. Filenames accurately describe content
3. New code is self-documenting
4. Directory structure stays logical
5. Changes follow existing patterns

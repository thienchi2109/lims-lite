# Project Context

## Purpose
CDC-LIMS (Lite Laboratory Information Management System) replaces spreadsheet-based lab tracking with a high-velocity, 21 CFR Part 11–aware workflow. The goal is to let analysts enter and scan results quickly while managers retain auditability, approvals, and CoA generation in a single-tenant deployable stack.

## Tech Stack
- Next.js 16 (App Router, React 19) with Server Actions and SSR.
- TypeScript with strict mode, ESLint (Next core-web-vitals), path alias `@/*`.
- Tailwind CSS v4 (design tokens in `src/app/globals.css`) plus Radix UI/shadcn-style primitives, tw-animate.
- Supabase self-hosted (Postgres 16, Auth, RLS, Storage) accessed via `@supabase/ssr` clients.
- TanStack Table v8 + react-hook-form + zod for editable grid workflows.
- @react-pdf/renderer for CoA PDFs, html5-qrcode for barcode scanning, lucide-react icons, clsx/tailwind-merge helpers.

## Project Conventions

### Code Style
- TypeScript first; prefer async/await and keep types close to data fetches and server actions.
- Use ESLint + typecheck (`npm run lint`, `npm run typecheck`) before commits; follow Next.js defaults (no custom prettier config).
- Keep UI strings in Vietnamese (see README localization note); avoid mixed-language labels.
- Use `@/` alias for imports, keep server/client Supabase clients in `src/lib/supabase`, and colocate component styles with the component file.

### Architecture Patterns
- App Router with role-based route groups: `(dashboard)/analyst` and `(dashboard)/manager`; `src/middleware.ts` refreshes Supabase sessions and redirects by role.
- Server Actions live under `src/app/actions` for mutations; data access via Supabase server client to honor RLS.
- Database model: users (roles analyst/manager), methods, assay_definitions, samples, results, audit_logs; soft deletes via `deleted_at`; statuses enumerated for samples/results.
- Compliance guards: audit triggers capture INSERT/UPDATE into `audit_logs`; RLS policies block analysts from approved results and restrict inserts/updates by role (see migrations 001–003).
- Deployment is single-tenant via Docker Compose (Next.js + Supabase stack); environment pulled from Supabase URL/anon key env vars.

### Testing Strategy
- Primary coverage today is in `tests/`: SQL regression script (`assay-management.test.sql`) plus manual/UI plans (`ASSAY_MANAGEMENT_TEST_PLAN.md`, `RUN_TESTS.md`, `TEST_RESULTS_SUMMARY.md`).
- Run Supabase locally (`docker compose up -d`), then execute the SQL script against the db container for fast regressions; manual UI flows start at TC-025.
- No automated frontend/unit/E2E harness yet; treat manual plans as source of truth and add new cases when features change.
- Seeds and migration order matter; use the numbered SQL files in `supabase/migrations` rather than ad-hoc DB edits.

### Git Workflow
- Follow OpenSpec guidance (`openspec/AGENTS.md`): create a change proposal for new capabilities or behavior changes before implementing.
- Work on feature branches with descriptive kebab-case names; keep migrations append-only and incremental.
- Validate specs/changes with `openspec validate --strict` when proposals are added or modified.

## Domain Context
- Users: Analysts enter results; Managers assign assays, approve results, manage users, and generate CoAs.
- Sample lifecycle: Received → Assigned → In Progress → Review → Completed; results move from pending → entered → approved.
- Assay definitions link to methods and units; results reference both assays and samples.
- Auditability is mandatory: audit_logs is immutable and records who changed what; RLS prevents unauthorized edits.
- UI/UX focus: fast grid-style data entry for analysts, dense dashboards for managers; barcode/QR scanning supported.

## Important Constraints
- 21 CFR Part 11-lite compliance: immutable audit logs, strict RBAC via RLS, no hard deletes (use `deleted_at` soft deletion).
- Single-tenant, self-hosted deployment via Docker Compose; expect Supabase services to be available.
- Maintain Vietnamese localization; avoid introducing English UI text.
- Avoid bypassing database policies—enforce permissions in Server Actions and let RLS provide the final gate.

## External Dependencies
- Supabase stack (Postgres, Auth/GoTrue, PostgREST, Storage) with migrations in `supabase/migrations`.
- Docker Compose for local/prod orchestration; Nginx reverse proxy used in deployment docs.
- Third-party libs: TanStack Table, react-hook-form, zod, Radix UI primitives, @react-pdf/renderer, html5-qrcode, lucide-react, clsx, tailwind-merge, sonner toasts.

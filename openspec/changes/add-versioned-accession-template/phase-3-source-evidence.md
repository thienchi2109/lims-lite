# Phase 3 source evidence — 2026-11-02 UTC

Status: **SOURCE ONLY**, root review **PASS**. Baseline: `97c32032aa212652ba21ad7bad2fb226c4b00246` on `main`; no branch/worktree created. The Phase 3 dispatch authorized the existing `/analyst/accession` header placement. Tasks 3.1–3.4 reach source gates; OpenSpec **13/19**, TASK-8 **In Progress**. Migration 232 was not applied by this session. No SSH, Docker, DB, production, deployment, signing configuration or dependency changes were performed.

## RED → GREEN

Before route/UI implementation:

```sh
rtk npm run test:run -- src/app/api/accession/template/route.test.ts 'src/app/(dashboard)/analyst/accession/accession-page-header.test.tsx'
```

Exit **1**: two failed files; route suite could not import missing `./route`; header **9 failed / 1 passed**, missing accessible `Tải template Excel`, preserved walkthrough test passed. Added OTP-denial regression before route implementation and ran `rtk npm run test:run -- src/app/api/accession/template/route.test.ts`: exit **1**, missing route. Assertions remain in GREEN. An additional real-generator integration assertion initially used the wrong expected metadata sheet name; corrected the test to the existing contract's literal `Thông tin template`, with no generator change.

Final focused and immediate blast-radius verification:

```sh
rtk npm run test:run -- src/app/api/accession/template/route.test.ts 'src/app/(dashboard)/analyst/accession/accession-page-header.test.tsx' 'src/app/(dashboard)/analyst/accession/page.test.tsx' src/lib/accession-template/binding.test.ts src/lib/accession-template/workbook.test.ts tests/accession-template-snapshot-migration.test.ts tests/assay-sample-type-catalog-rpc-migration.test.ts tests/assay-sample-type-catalog-stale-state-migration.test.ts tests/assay-sample-type-catalog-review-hash-migration.test.ts tests/assay-sample-type-enforcement-migration.test.ts src/middleware.manager-email-otp.test.ts src/app/api/client-actions/role-guard.client-characterization.test.ts
rtk npm run typecheck
rtk proxy node_modules/.bin/eslint src/app/api/accession/template/route.ts src/app/api/accession/template/route.test.ts 'src/app/(dashboard)/analyst/accession/accession-page-header.tsx' 'src/app/(dashboard)/analyst/accession/accession-page-header.test.tsx' 'src/app/(dashboard)/analyst/accession/page.test.tsx'
rtk proxy node_modules/.bin/react-doctor . --offline --yes --diff HEAD --verbose --no-lint
rtk proxy openspec validate add-versioned-accession-template --strict --no-interactive
rtk git diff --check
```

Focused suite: exit **0**, **111/111 PASS**, 12 files. Typecheck/scoped ESLint: exit **0**. Installed React Doctor `0.0.31`: exit **0**, **100/100**, three changed React source/test files; `--no-lint` follows the repo's installed-tool workflow and ESLint runs separately. An earlier lint-enabled Doctor invocation exited 0 but reported incomplete checks because bundled oxlint lacked `jsx_a11y/no-noninteractive-element-interactions`; it is not claimed as passing evidence. OpenSpec strict and diff whitespace checks: exit **0**. No dependency/configuration workaround or download was used.

Root independently reviewed the route, header and tests, then reran every command above: **111/111 PASS**, React Doctor **100/100**, and all commands exit **0**. Separate spec and standards/security review found no remaining issues. These checks retain the source/runtime boundary below.

## Endpoint and UI boundary

- `GET /api/accession/template`, Node runtime, cookie-backed normal `createClient()` only. Validates `auth.getUser()` and current caller's `users.role = analyst`, `deleted_at IS NULL` before template snapshot access. Profile failures/absent/deleted users fail closed. Existing `shouldRequireManagerStepUp` receives current confidential access, session identity, OTP-settings version and native Next cookies; required OTP denies before snapshot. Existing middleware still applies API session timebox. No forced-password flag gate was found in this source baseline.
- After authorization, `readTemplateSigningConfig()` and exactly one `get_accession_template_snapshot()` RPC feed existing `generateAccessionTemplate()`. The route accepts no client-supplied catalog or filename, returns XLSX bytes directly, fixed server attachment `lims-tiep-nhan-mau-v1.xlsx`, XLSX MIME and `Cache-Control: private, no-store`. Errors carry the same private no-store header and fixed Vietnamese JSON messages: unauthenticated 401; profile/SQL `42501`/OTP denial 403; unavailable catalog/RPC/signing config/generation 503. Raw auth/RPC/generator/config text is never returned or logged.
- Actual `AccessionPageHeader` beside title renders installed `Button`, `Download`/`Loader2` and Sonner error patterns, disabled/`aria-busy` Vietnamese pending state, keyboard activation/focus and flex wrapping. `WalkthroughTrigger` retains `hidden xl:inline-flex`. No importer/upload or `/samples` duplication. Browser fetch uses `cache: no-store`, same-origin credentials, validates MIME and safe server filename, creates a Blob URL and removes its temporary anchor/revokes the URL in `finally`, including download failures.
- Tests exercise authorization-before-RPC, soft-deleted profile, ordinary/OTP-accepted/OTP-denied analysts, binary bytes/headers, missing catalog/RPC/config, redacted errors, real generator → XLSX response round trip with synthetic snapshot/key, actual page/header integration, jsdom keyboard/pending/retry/errors and memory cleanup. No client mutation is invoked, so binary GET correctly bypasses the JSON mutation bridge; existing `api-client.ts` mutation convention is preserved.

## Proof limits and runtime handoff

These are source tests and mocked Supabase/browser APIs, plus real in-process signing/generation. They do **not** execute SQL, prove RLS/current production authorization, exercise real browser downloads/focus at mobile widths, inspect proxy/CDN cache behavior or confirm deployed no-retention. Source inspection found no file/Storage/cache/business write or payload/secret/PII logging in the route/control; that is not a runtime retention audit.

Phase 4 remains entirely unchecked/**NOT RUN**: authorize operations separately; apply committed forward-only migration on home server; run SQL regression and `run_security_tests()`; provide valid server signing configuration, deploy, verify real authorized/denied downloads, workbook/current revision, middleware/OTP, proxy private no-store and no retained workbook. Missing migration/config currently fails closed with safe 503. Root review, commit/push and external issue synchronization are coordinator responsibilities, not completed by this worker.

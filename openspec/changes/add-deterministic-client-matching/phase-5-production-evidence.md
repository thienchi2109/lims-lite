# Phase 5 Production Evidence

## Scope and landing point

- Only Phase 5 tasks `5.1-5.5` were implemented. No caller selects resolver v2
  as its authoritative response or mutation path, and no Phase 6 behavior was
  introduced.
- The implementation landed through PR #127 at squash commit
  `69f2d68454cddc142d3954db7a2ff08dbaf22e5e`.
- Shadow mode is controlled only by the server environment. Production remains
  configured with categories `manual,qr,upsert` and a 500 ms timeout.

## Immutable migration history

- Migration `224_add_client_resolution_shadow_telemetry.sql` failed rehearsal
  before object creation because the rehearsal database owner differed from the
  production apply role. It is immutable at SHA-256
  `1e5a5f619d39b6cd07bcaa458cc97bfe6727c970152759d80a6813d3132c1cf0`
  and was not applied to production.
- Migration `225_add_client_resolution_shadow_telemetry.sql` failed rehearsal
  before object creation because PostgreSQL rejected a generated
  `TIMESTAMPTZ + INTERVAL` expression as non-immutable. It is immutable at
  SHA-256
  `78fec17a15f11e404c3957a38ef37d54e4a650082132f1ff096560d09125f395`
  and was not applied to production.
- Migration `226_add_client_resolution_shadow_telemetry.sql` committed on the
  rehearsal database and became immutable at SHA-256
  `71a91358705a80975e651fb193e28c5dcc43aac65c3adf517b8c67939072ed7d`.
- Migration `227_fix_client_resolution_shadow_expiry_pruning.sql` is the
  forward-only correction for the ambiguous `expires_at` output/column
  reference. Its SHA-256 is
  `dcddac2c8b0b633c3323b4ea9dfc3038a59ff34a8018427fcbc30aa2df7d3850`.
- Production applied only committed migrations `226` and `227`, in that order,
  through SSH plus `sudo -n docker exec`.

## Rehearsal gate

- Migration `226` committed on `lims_phase5_224_rehearsal`.
- The first rollback SQL run exposed ambiguous expiry pruning. A failing static
  regression test was added before migration `227`.
- Migration `227` committed on the rehearsal database.
- `tests/client-resolution-shadow.test.sql` passed and ended `ROLLBACK`.
- `run_security_tests()` passed all 35 checks.
- The corrected function definition was active, the service role alone retained
  RPC execution, and the rehearsal telemetry count remained zero.

## Production switch-off gate

- The home-server checkout was synced cleanly to
  `69f2d68454cddc142d3954db7a2ff08dbaf22e5e`.
- The application was built and recreated with
  `CLIENT_RESOLUTION_SHADOW_CATEGORIES=off` and timeout `500`.
- Root and auth health returned HTTP 200.
- Migrations `226` and `227` committed, PostgREST was restarted, the rollback
  SQL suite passed, and `run_security_tests()` passed 35/35.
- An authenticated manual lookup returned HTTP 200 with the legacy result.
  Shadow telemetry remained zero, and production retained 63 clients and 97
  samples.

## Enabled evidence window

- The bounded controlled window ran from `2026-08-22 14:37:16 UTC` through
  `2026-08-22 14:42:56 UTC`.
- The application was healthy with categories `manual,qr,upsert` and timeout
  `500`.
- Two controlled passes used an authenticated analyst:
  - manual lookup: HTTP 200, legacy data present;
  - QR lookup: HTTP 200, legacy data present;
  - trusted-identity disagreement through legacy upsert: HTTP 400, error
    present, no data returned.
- The final aggregate contained six events across all three categories and six
  distinct random correlation IDs. No shadow auth, RPC, timeout, or client
  action failure was logged.
- Client and sample totals remained 63 and 97. No expired telemetry existed,
  and every event had `expires_at = observed_at + interval '30 days'`.

## Outcome and reason review

| Caller | Legacy tuple | v2 tuple | Count | Review |
| --- | --- | --- | ---: | --- |
| `manual` | `matched / legacy_name_dob_match` | `matched / name_dob_match` | 2 | Outcome parity. The reason names describe the same name-and-DOB match. |
| `qr` | `matched / legacy_name_dob_match` | `matched / trusted_identity_match` | 2 | Outcome parity. v2 records the stronger trusted identity evidence while the legacy response remains authoritative. |
| `upsert` | `not_found / legacy_would_create` | `conflict / trusted_identity_disagreement` | 2 | Intentional discrepancy. The legacy evaluator would attempt creation, but the existing Phase 4 trusted-ID guard rejected the real legacy mutation with HTTP 400; no client was created or updated. |

All observed categories were reviewed. The intentional upsert discrepancy is
the behavior Phase 6 may later adopt, but Phase 5 does not use it to control a
response or mutation.

## Telemetry and access boundary

- The production table contains only:
  `caller_category`, `legacy_outcome`, `legacy_reason_code`, `v2_outcome`,
  `v2_reason_code`, `correlation_id`, `observed_at`, and `expires_at`.
- It contains no actor/client UUID, name, phone, government identity, DOB,
  hash, fingerprint, source coordinate, or payload.
- `anon`, `authenticated`, and `service_role` have no direct table DML access.
  Only `service_role` can execute the SECURITY DEFINER recording RPC;
  `authenticated` cannot.

## Verification

- Focused Vitest: 13 files, 105 tests passed.
- TypeScript typecheck passed.
- Focused ESLint passed.
- Full lint completed with zero errors and 80 pre-existing warnings.
- `check:no-explicit-any` passed.
- React Doctor reported 100/100 with no findings in 12 changed source files.
- Next.js production build passed.
- SonarCloud reported 53.5% duplication on new code because the immutable,
  forward-only migration lineage `224-227` repeats guarded schema and RPC
  definitions. Its file-level API attributed duplicated lines only to those
  four migrations; no applied or rehearsal-immutable migration was rewritten
  to satisfy the metric.
- Strict OpenSpec validation passed.
- `git diff --check` passed.
- Migrations `215-223` remained byte-for-byte unchanged.
- Production root and auth health returned HTTP 200 after the enabled window.
- No Supabase MCP or Supabase CLI operation was used.

## Acceptance and Phase 6 block

- Phase 5 acceptance passed for switch isolation, same-snapshot comparison,
  PII-free bounded telemetry, authorization, failure containment, latency,
  retention, and zero client/sample mutation.
- Shadow mode remains independently disableable through the server environment.
- Phase 6 remains blocked and unimplemented. This evidence does not authorize
  v2 caller selection, transactional caller cutover, legacy-path retirement, or
  any Phase 6+ task.

# Phase 6 Caller Cutover and Retirement Production Evidence

## Scope and stopping point

- Phase 6 tasks `6.1-6.14` are complete as of the post-retirement verification
  recorded below.
- The irreversible retirement gate was crossed by migration
  `230_remove_clients_unique_identity.sql` on the home server. Issue #130 is
  the closeout record for this gate.
- No Phase 7 work was started.
- The application implementation landed through PR #129 at commit
  `39cc95c6745971731df84e866d06e8cabe9d773a`.
- Rehearsal coverage was corrected at
  `9fd1dd6`, and the production switch wiring hotfix landed at
  `b283bd35171579cb0845c8b611b51e2446dae21a`.

## Caller inventory and TDD boundary

- No production lookup-only consumer exists independently of a
  creation-capable workflow. Tasks `6.2-6.3` are therefore satisfied as a
  documented no-op instead of inventing a caller.
- Manual and QR accession use separate server actions for preparation, sample
  creation, and assignment. Lookup, resolve-or-create, and sample mutation
  remain one workflow unit.
- A pending preparation response is a draft selection without a trusted client
  UUID and does not create a client or sample.
- Existing client edits use explicit update mode.
- The only production `ClientForm` callsites either provide a fixed manual/QR
  preparation action or use `mode="update"`. The generic raw-upsert fallback
  has no active screen callsite and is disabled by the final server switch.
- TDD regressions cover matched, not-found, ambiguous, conflict,
  inactive/restricted outcomes, zero early mutation, address and identity
  preservation, scanner/QR behavior, confidentiality, profile edits, CoA
  raw-phone authentication, sample selection, and Vietnamese failures.

## Immutable migration and schema deployment

- Migration `228_add_transactional_client_sample_cutover.sql` is immutable at
  SHA-256
  `df135692571bb0975bd66ed052fbaf19d4cb5b4f832d18dd25ca5858251292ba`.
- The isolated rehearsal restore required `supabase_admin` because the stack
  role `postgres` is not a superuser and cannot restore extension-owned
  `LANGUAGE c` functions. Migration `228` itself remained unchanged.
- Rehearsal and production apply used `postgres`, matching the production
  migration role.
- Production contains:
  - `public.create_sample_with_client_resolution_v2`;
  - `public.accession_and_assign_tests_with_client_resolution_v2`.
- The wrappers lock and revalidate the active client, derive `client_name` from
  the locked database row, and atomically create/link client and sample data.
- PostgREST schema reload was issued through
  `NOTIFY pgrst, 'reload schema'`. The `lims-rest` log confirmed
  `Config reloaded` and `Schema cache loaded` at
  `2026-08-23 04:54:22 UTC`.

## Ordered production rollout

### Manual checkpoint

- Effective switches were `manual` for v2 and `on` for legacy upsert.
- An authenticated analyst request used a short-lived JWT signed only inside
  the `lims-app` process. The token and signing secret were never printed,
  persisted, or inserted into `auth.sessions`.
- `prepareManualAccessionClient` returned HTTP 200 with:
  - `kind = pending`;
  - `workflow = manual`;
  - `outcome = not_found`;
  - `reason_code = trusted_identity_not_found`;
  - `created = false`;
  - no client UUID and no error.
- Clients, samples, audit rows, and the selected analyst's existing auth session
  count were unchanged. One expected PII-free shadow event was recorded.

### QR checkpoint

- QR was enabled only after the manual checkpoint passed.
- `prepareQrAccessionClient` returned HTTP 200 with the same safe pending
  contract for `workflow = qr`.
- Clients remained 63, samples 97, audit rows 8220, and the selected analyst's
  auth session count remained unchanged. One expected shadow event was added.

### Tested switch rollback

- Production was recreated with:
  - `CLIENT_RESOLUTION_V2_CATEGORIES=off`;
  - `CLIENT_RESOLUTION_LEGACY_UPSERT=on`.
- An authenticated read-only manual lookup returned HTTP 200 with `data = null`
  for a synthetic non-match.
- Client, sample, result, audit, and auth-session counts were unchanged.
- The application remained healthy.

### Final reversible cutover state

- After rollback verification, production was restored to:
  - `CLIENT_RESOLUTION_V2_CATEGORIES=manual,qr`;
  - `CLIENT_RESOLUTION_LEGACY_UPSERT=off`.
- Fresh authenticated manual and QR preparation smokes both returned HTTP 200,
  `pending`, `not_found`, `created = false`, no UUID, and no error.
- The final `.env` retained mode `0600` and owner/group `root:root`.
- No recent client-action failure matched the application logs.

## Production invariants and shadow review

- Final aggregate:
  - clients: 63;
  - samples: 97;
  - results: 1525;
  - audit rows: 8220;
  - shadow events: 11;
  - canonical projection mismatches: 0.
- Final shadow tuples:

| Caller | Legacy tuple | v2 tuple | Count |
| --- | --- | --- | ---: |
| `manual` | `matched / legacy_name_dob_match` | `matched / name_dob_match` | 2 |
| `manual` | `not_found / legacy_name_dob_not_found` | `not_found / identity_not_found` | 1 |
| `qr` | `matched / legacy_name_dob_match` | `matched / trusted_identity_match` | 2 |
| `upsert` | `not_found / legacy_would_create` | `conflict / trusted_identity_disagreement` | 2 |
| `upsert` | `not_found / legacy_would_create` | `not_found / trusted_identity_not_found` | 4 |

- Telemetry contains only category, outcome/reason tuples, random correlation
  UUID, and timestamps. It contains no client/actor UUID, name, phone,
  government identity, DOB, hash, fingerprint, coordinate, or payload.

## Verification

- Focused immediate-blast-radius Vitest passed 14 files and 118 tests.
- TypeScript typecheck passed.
- `check:no-explicit-any` passed.
- Full lint completed with zero errors and 80 pre-existing warnings.
- Strict OpenSpec validation passed.
- `git diff --check` passed.
- Production rollback-only caller-cutover SQL passed and ended `ROLLBACK`.
- `run_security_tests()` passed 36/36.
- Canonical projection reconciliation reported zero mismatches.
- Root, auth health, and CoA access returned HTTP 200.
- The final `lims-app` container was healthy.
- Migration `228` on the home server matched the committed checksum.
- No Supabase MCP or Supabase CLI operation was used.

## Irreversible gate handoff

- `clients_unique_identity` remains present.
- Direct authenticated identity UPDATE remains available under the pre-gate
  compatibility surface.
- No migration `229` retirement artifact exists or has been applied.
- These retained objects were not data-loss findings. They preserved the
  reversible fallback structure before task `6.10`.
- The pre-apply state above is the baseline for task `6.10`; it is retained as
  historical evidence because the production database is now post-retirement.
- The follow-up must not delete, merge, replace UUIDs, or relink client,
  sample, result, or audit history.

## Irreversible retirement and closeout evidence

- Migration `230_remove_clients_unique_identity.sql` is immutable at SHA-256
  `2cd5448f6be5ee19825f31b4d23e956f9ecd611bea3c2f378f1e1e9b1bbbcbcb`, matching
  both the local `main` commit and `/opt/lims-lite` at `f9dc57b`.
- The post-retirement database has no `clients_unique_identity` constraint;
  authenticated table-level UPDATE is false; authenticated UPDATE is false for
  `id_card_num`, `name`, and `date_of_birth`; and the explicitly allowed
  profile columns remain writable.
- Production invariants are clean: `64` client rows, zero same-name/DOB
  duplicate groups, and the sample client-name snapshot trigger remains
  enabled.
- The rollback-only SQL suite passed, including distinct same-name/DOB
  identities, protected identity updates, profile updates, resolver behavior,
  manager correction/audit, snapshot preservation, forward-only uniqueness
  recovery failure, and zero fixture residue.
- `run_security_tests()` passed `36/36`. Local focused Vitest passed `55/55`,
  both Issue #130 `.mjs` regression scripts passed, typecheck passed, lint
  completed with `0` errors and `80` existing warnings, React Doctor exited
  successfully, strict OpenSpec validation passed, and `git diff --check`
  passed.
- The home-server checkout is clean at `f9dc57b`; `lims-app` and
  `lims-postgres` are healthy. Production root and auth health returned HTTP
  `200`. The authenticated manual/QR browser and route smoke evidence from the
  reversible checkpoint remains valid because the post-gate release changed
  only the database boundary; the new post-gate SQL suite covers the changed
  identity/profile authorization behavior.
- Recovery is forward-only after task `6.10`: no switch rollback can restore
  name/DOB uniqueness, and any future correction requires a new application and
  database release. No client, sample, result, or audit history was deleted,
  merged, relinked, or rewritten.

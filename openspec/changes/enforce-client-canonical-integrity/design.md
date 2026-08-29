## Context

Migration 230 is the immutable Phase 6 boundary. It removed the legacy
`clients_unique_identity` constraint without rewriting rows, revoked direct
authenticated updates to identity columns, and preserved the deterministic
resolver, audited lifecycle RPCs, profile updates, RLS, and sample name
snapshots. Its immutable SHA-256 is
`2cd5448f6be5ee19825f31b4d23e956f9ecd611bea3c2f378f1e1e9b1bbbcbcb`.

The compatibility entry point remains reachable:
`src/app/api/client-actions/route.ts` dispatches `upsertClient` through
`client-resolution-shadow-handlers.ts`, whose legacy branch still calls the
direct table upsert in `src/app/actions/clients.ts` with
`onConflict: 'name,date_of_birth'`. That path cannot remain successful at the
Gate A boundary because migration 230 removed the referenced constraint.

Trusted typed identity uniqueness is not new Gate A work. Migration 221 already
created `clients_unique_trusted_government_identity` on
`(government_identity_type, government_identity_value)` where
`government_identity_trusted` and the value is non-null, across active and
inactive rows.

The remaining Phase 7 work is a separate Gate A: prove that canonical client
state is clean and that all authoritative callers use the guarded contracts,
then add integrity enforcement. Gate B legacy-path retirement must remain
independently deferrable until a post-enforcement observation window is
complete.

## Goals / Non-Goals

**Goals:**

- Establish a reproducible pre-migration evidence gate for collisions,
  canonical projection drift, lifecycle audit coverage, grants, policies, and
  remaining successful legacy mutation callers.
- Validate and preserve trusted typed CCCD/CMND uniqueness, then enforce
  canonical projection consistency without making normalized phone or
  name/date-of-birth unique.
- Make every creation-capable caller use the transactional resolver before the
  migration is attempted, while retaining the compatibility entry point for
  observation and later Gate B removal.
- Preserve fail-closed resolver outcomes, authorized profile-only updates,
  audited manager lifecycle/correction behavior, RLS, and historical
  sample/result truth.
- Provide rollback-only SQL coverage and a forward-only database rollback
  rehearsal.

**Non-Goals:**

- Editing, reapplying, renaming, or restoring migration 230.
- Deleting, merging, relinking, or rewriting existing client, sample, result,
  or audit rows.
- Deleting legacy application branches or obsolete RPC grants. Delegating the
  reachable compatibility entry point to resolver v2, or disabling it
  fail-closed, is required Gate A caller adoption; physical removal requires a
  later observation-gated proposal.
- Bulk workbook parsing, import partitioning, scanner transport, or unrelated
  client search behavior.

## Decisions

### Use a two-stage Gate A

Create `tests/client-canonical-integrity-preflight.sql` as a read-only,
`ON_ERROR_STOP` script. It must return zero blocking rows and fail non-zero for
any mismatch in collision aggregates, canonical projections, migration 230
catalog state, policies, ACLs, RPC metadata, or audit coverage. Caller
adoption is verified separately by static route tests and runtime telemetry;
the combined result is recorded in the evidence artifact. Run the SQL
preflight from the home-server checkout with:

```bash
rtk ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite && sudo -n docker exec -i lims-postgres \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < tests/client-canonical-integrity-preflight.sql"
```

Record the command, commit SHA, database timestamp, non-PII aggregate counts,
catalog assertions, caller-adoption test/telemetry result, and pass/fail result
in
`openspec/changes/enforce-client-canonical-integrity/gate-a-preflight-evidence.md`.
The enforcement migration may be attempted only after that committed evidence
is reviewed and the same baseline assertions are embedded in the migration.

Alternative rejected: applying constraints first and discovering unresolved
collisions afterward. That would make remediation harder and could force
unsafe data changes.

### Pin the exact integrity predicates

- Preserve the existing
  `clients_unique_trusted_government_identity` definition exactly. It reserves
  trusted 12-digit CCCD and 9-digit CMND canonical values across active and
  inactive clients.
- Require every row to keep `normalized_name`,
  `normalized_phone`, `government_identity_value`,
  `government_identity_type`, and `government_identity_trusted` equal to the
  outputs of the versioned normalization/classification functions used by the
  existing projection trigger.
- Keep `0000000000`, invalid phones, blank values, and other rejected phone
  placeholders canonicalized to `NULL`.
- Keep `idx_clients_normalized_phone` and
  `idx_clients_normalized_name_dob` non-unique. A phone or name/date-of-birth
  match is a resolver conflict signal, not proof of identity.
- Create, restore, and correction paths must fail closed when an active or
  inactive candidate matches trusted government identity, normalized phone, or
  normalized name/date-of-birth, unless
  `is_client_collision_confirmed_distinct_v1` has a still-valid adjudication for
  both current client `updated_at` snapshots.

Alternative rejected: restoring `UNIQUE (name, date_of_birth)`, because valid
distinct people may now share those fields after migration 230.

### Require caller adoption without Gate B deletion

Before the preflight can pass, `upsertClient()` must no longer perform or reach
a direct `public.clients` upsert. The existing API action name may remain for
compatibility, but it must delegate to the transactional resolver v2 contract or
return a stable fail-closed Vietnamese error. Static search, focused route and
shadow-handler tests, and production telemetry must prove there is no successful
legacy direct upsert.

Alternative rejected: deleting the entry point in Gate A. Physical removal
needs the post-enforcement observation evidence owned by Gate B.

### Preserve the exact security and audit boundary

No RLS policy change is planned. Gate A must assert the existing client policy
set and expressions before and after migration: authenticated SELECT requires
`auth.uid() IS NOT NULL`; client INSERT requires
`get_user_role() IN ('analyst', 'manager')`; client UPDATE uses the same role
check in both `USING` and `WITH CHECK`; and the existing manager-only DELETE
policy remains inert because table-level DELETE is denied. If implementation
discovers a policy change is required, this proposal must be amended before
code is written.

The authenticated ACL must continue to deny table-level `UPDATE`, `DELETE`, and
`TRUNCATE`; deny column UPDATE on `id_card_num`, `name`, `date_of_birth`,
canonical projection fields, and lifecycle fields; and allow UPDATE only on
`gender`, `phone`, `address`, `health_insurance_num`, and `expiry_date`.
Resolver v2 RPCs remain executable by authenticated callers, while lifecycle
and correction RPCs retain internal manager-role checks, fixed `search_path`,
and no `PUBLIC` or `anon` execute grant.

Successful lifecycle operations must atomically write exactly one explicit
success event to `audit_logs` with `table_name = 'clients'`, the client UUID as
`record_id`, `changed_by = auth.uid()`, and these operation contracts. This is
in addition to any generic row-level audit trigger record; the acceptance
criterion concerns the explicit lifecycle event.

- `CLIENT_DEACTIVATED`: `reason` plus `lifecycle_status = 'inactive'`.
- `CLIENT_RESTORED`: `reason` plus `lifecycle_status = 'active'`.
- `CLIENT_IDENTITY_CORRECTED`: `reason`, `corrected_fields`, and current
  lifecycle status.

An audit insertion failure must roll back the client mutation and return
`CLIENT_AUDIT_FAILED`/SQLSTATE `P1116`. A rejected conflict must create no
client/history mutation and no lifecycle success event.

### Preserve the complete migration 230 baseline

The preflight and migration baseline must verify the immutable hash and the
post-230 catalog contract: removed `clients_unique_identity`; exact resolver v2
and accession RPC signatures; the enabled `sync_samples_client_name` trigger
and function identity; reconciled canonical projections; the authenticated ACL
above; the exact trusted-identity unique index; the owner, volatility,
`search_path`, grants, comment, and direct result of
`test_client_resolution_sample_cutover_security()`; and registration plus pass
status in `run_security_tests()`.

Migration 231 is the expected next forward-only filename, but implementation
must verify that 231 remains unused in the repository and approved deployment
checkout before creating it. If it is occupied, use the actual next number.

### Keep Gate B separate

The enforcement proposal records evidence and adds the Gate A contract only.
Successful observation after deployment is a prerequisite for a later proposal
that removes proven-unused legacy branches or RPC grants.

Alternative rejected: combining enforcement and retirement in one deployment,
which would make rollback and regression attribution ambiguous.

## Risks / Trade-offs

- [Risk] Existing unresolved collisions block the migration. → Produce
  non-PII aggregate evidence and require adjudication with current
  `updated_at` snapshots before implementation proceeds.
- [Risk] A concurrent create or restore can race with a uniqueness guard. →
  Cover sorted locking, constraint failures, retry behavior, and atomic
  resolver outcomes in rollback-only SQL tests.
- [Risk] A policy or grant change can widen access accidentally. → Use
  `DROP POLICY IF EXISTS`, explicit role checks, fixed `search_path`, minimal
  grants, and `run_security_tests()` in the deployment checklist.
- [Risk] Legacy callers remain hidden behind adapters. → Combine static code
  search, route/shadow-handler tests, runtime telemetry, aggregate evidence, and
  focused browser smoke before applying enforcement.
- [Risk] A static migration-shape test passes while runtime semantics fail. →
  Require separate rollback-only SQL and multi-session concurrency suites
  against an isolated rehearsal database.

## Migration Plan

1. Review and approve this proposal, design, delta spec, and tasks.
2. Add failing caller-adoption, preflight, migration-shape, rollback-only SQL,
   and concurrency tests.
3. Make `upsertClient()` delegate to resolver v2 or fail closed; deploy and
   prove no successful direct legacy upsert.
4. Run and commit `gate-a-preflight-evidence.md` from the approved home-server
   database before creating or applying an enforcement migration.
5. Verify the next available migration number, then implement and review one
   new forward-only migration with the complete migration 230 baseline. Never
   edit or rerun migration 230.
6. Run the named SQL suites, `run_security_tests()`, focused client/accession
   regressions, typecheck, lint, React Doctor, health checks, browser smoke, and
   Vietnamese outcome checks.
7. Apply only the committed migration in the approved Docker environment and
   verify catalog, grants, policies, audit evidence, and unchanged history.
8. Observe production usage for the agreed window. Open a separate Gate B
   proposal only after the observation evidence proves legacy paths unused.

Before Gate A enforcement, rollback disables only application selection or
adapter behavior and leaves additive schema in place. After the new guard is
applied, recovery uses a new forward-only migration; migration 230 remains
immutable and the removed name/date-of-birth constraint is never restored.

## Open Questions

- Which observation window and telemetry retention period will the later Gate B
  proposal require? This does not block Gate A approval.

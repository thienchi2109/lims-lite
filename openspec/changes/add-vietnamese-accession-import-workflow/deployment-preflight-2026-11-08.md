# TASK-13 production deployment preflight — 2026-11-08

User authorized app deployment and backend/migration compatibility verification after Phase 3 source acceptance. Worker `gpt-6.1-sol/high` performed home-server inspection and candidate build; read-only Luna `gpt-6-luna/max` traced existing deployment/configuration requirements. Root independently inspected the production RPC catalog and candidate/rollback/running-app metadata.

## Result

| Evidence lane | Result |
| --- | --- |
| Production-bound candidate app build | PASS, exit 0; not promoted |
| Backend/configuration compatibility | INCOMPLETE: SQL, preview configuration and proxy prerequisites missing |
| App deployment / authenticated browser E2E | NOT RUN |
| Existing production app | Healthy; original image remains active |

Operations ran only through SSH to `khoa-xn-cdc@100.93.19.42`, checkout `/opt/lims-lite`, with Docker prefixed `sudo -n`. No workspace Docker, database mutations, runtime configuration edits, service replacement, Storage or Tunnel operations occurred. Home Git checkout was fast-forwarded from `39553a8` to the exact reviewed source `bd3b0a273c8abea12910a04ffaa896f517945054`; ignored production secrets remained on the home server.

## Candidate and rollback

- Candidate tag: `lims-lite-app:git-bd3b0a273c8abea12910a04ffaa896f517945054`.
- Candidate image: `sha256:5225ab2cf49f3979234a18a2696430fceff9ac674a9e4610e106d80da1c9499e`.
- OCI revision: exact `bd3b0a273c8abea12910a04ffaa896f517945054`; source `https://github.com/thienchi2109/lims-lite`.
- Home artifacts: `/tmp/lims-lite-task13-deploy-20261108.9cpYEJ/`, including `app-candidate.json` and final build log. The candidate uses the existing production build arguments, not the isolated synthetic-auth image.
- Active app tag: `lims-lite-app:git-7e1888a7043a93cacad5fff64b08f78e8fd1e491`.
- Active/rollback image: `sha256:b38a5ef20e7d1a809811d9e052885feb7f47a87f1b7ce960fa12282feb6d2371`.
- Preserved rollback tag: `lims-lite-app:pre-task13-bd3b0a2`; root independently verified that it resolves to the active image.
- Active Compose override: `/tmp/lims-lite-task11-phase4-20261106/app-provenance-7e1888a7043a93cacad5fff64b08f78e8fd1e491.json` with the base `/opt/lims-lite/docker-compose.yml`.
- Root observed the original app container `9af641c26c89` healthy after the candidate build. Worker confirmed its start time remains `2026-11-06T10:29:23.127694272Z`.

## Verified compatibility gaps

### Database

Production has the migration-239-style `confirm_accession_import` definition; worker matched its source fingerprint to that baseline. Root independently confirmed that the recovery/status and maintenance RPCs are absent. A read-only worker security run passed 36/36 plus the existing atomic/provenance/commitment/validation checks.

The existing `public.schema_migrations` table contains upstream timestamp versions, not the repository's numbered migrations. There are no 220–260 ledger entries; this is a structural/signature/fingerprint baseline, not a claim that the ledger records version 239.

Required forward-only path, not executed: **240 → 241 → 243 → 244**. Skip immutable failed/rolled-back 242; do not edit historical SQL.

- 240: owner/active-analyst/confidentiality-checked status, service-only boundary.
- 241: linked retry state/lock rechecks.
- 243: narrow no-password maintenance role, private deny-all capability policy, guarded purge/status/immutability work.
- 244: BIGINT generation values reconstructed as decimal strings.

Any separately authorized application must retain each migration's baseline/result assertions and run `run_security_tests()` after each migration. Maintenance execution is a separate operation; applying its definition is not permission to run a purge worker.

### App configuration and policy

The home `.env` and running app both lack these settings (presence checks only; no values copied):

- `ACCESSION_PREVIEW_BINDING_KEY_ID`
- `ACCESSION_PREVIEW_BINDING_KEYS`
- `ACCESSION_PREVIEW_POLICY`

The base Compose app environment forwards template signing settings but does not forward these three preview settings. Provisioning requires explicit forwarding and an independent preview key ring, generated and retained only on the home server.

There is no approved production-measured policy literal. The test-only literal is marked `synthetic-test-only` and must not be promoted. [Preview design](../add-accession-preview-commitment/design.md#phase-4-source-release--2026-11-04) requires measured request byte/response/time budgets and fails closed without valid configuration. TASK-7/#134 retains measurement/acceptance of request/parser limits, leases, heartbeat and DB/HTTP behavior; no production values were invented in this preflight.

### Proxy

Tracked and effective nginx configuration have no explicit upload-size, request-body buffering or temporary-file controls for import. Default request size is 1 MiB, incompatible with the source contract accepting files below 10,000,000 decimal bytes. The reviewed rollout must bind route limits to the measured multipart `request.maxBytes`, stream requests with HTTP/1.1, prevent request/response disk buffering and body logging, and align timeouts with the accepted policy. Include preview and confirmation upload paths and protect status/sample reads. No proxy configuration was changed in this preflight.

## Next checkpoint

Candidate preparation is complete. Promotion is held while approval is requested for the additional prerequisite scope: measured TASK-7 policy on an isolated environment, the four production migrations, and app/proxy configuration. The original request authorized deploying the app and verifying migrations; it did not explicitly authorize applying production SQL. Source tasks remain **21/24**. Browser/runtime tasks and Backlog AC #5 stay open; candidate build and health checks do not establish import readiness or authenticated E2E acceptance.

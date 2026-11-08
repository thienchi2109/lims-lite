# TASK-13 production rollout — 2026-11-08

The user explicitly approved completing the identified prerequisites and deploying on the home server. This record supersedes the pending rollout state in the [preflight](deployment-preflight-2026-11-08.md). Production operations use SSH to `khoa-xn-cdc@100.93.19.42`, checkout `/opt/lims-lite`, and `sudo -n docker`; the source workspace runs no production containers.

## Accepted prerequisites

- Phase 1–3 UI source: `bd3b0a273c8abea12910a04ffaa896f517945054`; source verification and independent reviews are recorded in [tasks](tasks.md).
- Measured policy and reviewed Compose/nginx configuration: `92a9ec22699068473693c6a8d5ed2ded2c796f89`, pushed to `main`. See [bounded policy evidence](policy-evidence-2026-11-08.md) for the selected limits, exact ingress/deadline/retention witnesses and limitations. This is not full TASK-7 certification.
- Fresh online encrypted backup: `/var/backups/lims-lite/task13/20261108T075404Z`, completed `2026-11-08T07:54:09.844760+00:00`. Root independently verified all nine checksums and inspected the safe manifest. Database dump/age/archive-decode pipeline exits were `[0,0,0]`; globals dump/age exits were `[0,0]`; complete archive decode used `pg_restore --file=/dev/null`, with no database execution or persistent plaintext dump. Existing public recipient matched the prior recovery manifest; five production function fingerprints remained unchanged. Directory/file modes were 0700/0600. No Tunnel stop or container restart occurred for backup.
- Encrypted decrypt/restore test: **NOT RUN**, offline identity unavailable in the runtime. Storage object backup: **NOT RUN**, outside this database migration prerequisite. Archive decode and checksum validation do not establish a tested encrypted restore.
- Home-only env/rollback preparation: `/var/lib/lims-lite-ops/task13-20261108T075519Z`, protected outside the build context. Preview keyring is independent from template signing keys. Secret values are excluded from source and evidence.

## Production SQL — PASS

Applied committed migrations **240 → 241 → 243 → 244**, skipping immutable failed migration 242. All four apply exits were zero; security was **36/36 after each**. No historical migration was edited. Production's upstream timestamp ledger is not a ledger of the repo's numbered migrations; the baseline and resulting state are established through definitions, committed file hashes and assertions.

Safe execution evidence: `/var/lib/lims-lite-ops/task13-20261108T075519Z/sql/summary.json`, four `*-apply.log` and matching `*-security.json` files. Root independently inspected those logs/summary and ran a fresh production query: security **36/36**, expected postgres-owned status/preparation/start/validation/maintenance functions and restricted execute ACLs, maintenance role without superuser/bypass-RLS/inheritance, capability table with RLS and one policy. Worker additionally verified dedicated status/retry/maintenance assertions, deny-all policy, cleared table ACL, password-NULL role without memberships and empty capability table.

Root compared pre/post-SQL container identity records: PostgreSQL, Storage and Tunnel IDs/start times were identical. PostgREST received a schema-cache `NOTIFY` only; no global PostgreSQL setting changed. SQL application installs definitions/capabilities and does not import business rows.

## Deployment verification — PASS within the stated scope

Final production-bound build exited zero:

- Revision: `92a9ec22699068473693c6a8d5ed2ded2c796f89`.
- Image: `lims-lite-app:git-92a9ec22699068473693c6a8d5ed2ded2c796f89`.
- Image ID: `sha256:74ab760de139e2dd156c2c42dd058cb99084f6df70c1cd2b869429d24ac21c8c`.
- Build evidence: protected `build-summary.json`, `build.log`, `build.exit`; external provenance override `app-provenance.json` in the home-only preparation directory above. Production public anon configuration was used; no synthetic measurement image was promoted.

Only app/nginx were recreated, using `sudo -n docker compose --env-file /opt/lims-lite/.env -f /opt/lims-lite/docker-compose.yml -f /var/lib/lims-lite-ops/task13-20261108T075519Z/app-provenance.json -p lims-lite up -d --no-deps --force-recreate app nginx`. App started at `2026-11-08T08:04:32.551294819Z`; nginx at `2026-11-08T08:04:39.153707164Z`. Existing template keys were preserved; only the three reviewed preview variables were added. Old app image `sha256:b38a5ef20e7d1a809811d9e052885feb7f47a87f1b7ce960fa12282feb6d2371`, env, nginx and provenance remain available for app/config rollback. This is not a database rollback claim.

Root independently verified the running app's exact image/revision and healthy status, runtime policy deep-equality with the measured policy, valid active preview keyring shape, and unchanged 1 CPU / 1 GiB limits. The in-container nginx file hash exactly matched tested source `9bef5c0b373515c813c3a1b563388df4c024eedb405d44175a65414db9a83e97`; `nginx -t` exited zero. Fresh production security remained **36/36**, and dedicated status/retry/maintenance assertions all returned true. Root compared actual live PostgreSQL, Storage and Tunnel IDs/images/start times/running states against the pre-SQL baseline: **3/3 unchanged**.

Independent public checks from the source workspace after rollout:

| Request | Observed |
| --- | --- |
| GET `/login` | 200 |
| GET `/auth/v1/health` | 200 |
| GET `/coa/access` | 200 |
| GET `/analyst/accession` without session | 307 to login |
| POST `/api/accession-preview` without session | 401 |
| GET confirmation status without session | 401 |
| GET confirmation samples without session | 401 |

These probes did not perform authenticated imports or business writes. The home Python public `/login` probe returned **403 with Server: cloudflare**, so its original public-check gate is recorded as failed. Changing only its User-Agent to `Mozilla/5.0` on the same host returned 200; home checks with that User-Agent matched all seven expected statuses above. Home internal nginx login/auth health also returned 200. No rollback or extra recreation was performed for that client-dependent public response. These observations do not establish the exact Cloudflare rule responsible. Safe final evidence is `promotion-summary.json` and `untouched-containers-after-promotion.json` in the protected preparation directory; the original failed probe is preserved in `production-promotion-launcher.log`.

## Remaining acceptance

Authenticated production browser download → upload → preview → confirm → status/receipt/official IDs and the browser fault/ownership matrix remain **NOT RUN**. TASK-13 AC #5 and OpenSpec 4.2/4.3 remain open. Full TASK-7 concurrency, atomicity/fault, exact SQL budgets and TTL/purge certification remain **INCOMPLETE**; isolated policy evidence and deployment health do not replace them.

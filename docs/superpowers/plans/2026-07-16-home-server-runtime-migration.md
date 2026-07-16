# Home Server Runtime Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development
> (if subagents are available) or superpowers:executing-plans to implement this
> plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the complete LIMS runtime from the VPS to the home server while
preserving all real user accounts, authentication state, signature metadata and
signature files, and the existing `cdclims.cloud` Cloudflare Tunnel.

**Architecture:** Use a cold physical migration of the PostgreSQL and Storage
Docker volumes as the primary transfer. Pre-build the identical Compose stack
on the home server, restore and verify it without public ingress, then move the
existing remotely managed Cloudflare Tunnel by starting exactly one connector
on the home server. Keep the stopped VPS volumes unchanged for rollback.

**Tech Stack:** Ubuntu 24.04, Tailscale, Git, Docker Engine, Docker Compose,
Next.js 16, self-hosted Supabase/PostgreSQL 15, Nginx, Cloudflare Tunnel.

---

## Scope And Safety Invariants

- Preserve all 31 real accounts and their auth identities, password hashes,
  profiles, roles, OTP configuration, sessions and refresh tokens.
- Preserve all 25 signature records and all 25 physical objects in the private
  `user-signatures` bucket.
- Preserve the current `.env` values, including JWT keys, database encryption
  keys, Supabase keys, email configuration and `CLOUDFLARE_TUNNEL_TOKEN`.
- Transfer both named volumes: `lims-lite_postgres-data` and
  `lims-lite_storage-data`.
- Keep `COMPOSE_PROJECT_NAME=lims-lite` so restored volume names remain stable.
- Keep the existing Cloudflare Tunnel, public hostname, DNS route, Access
  policies, WAF and rate limits.
- Never run the VPS and home-server Tunnel connectors simultaneously while they
  point to separate database copies.
- Require a temporary whole-hostname Cloudflare Access maintenance policy
  before stopping writes. Keep it active until the home-server acceptance
  checkpoint passes.
- Never run `docker compose down -v`, `docker volume prune`, or delete the VPS
  volumes during the rollback window.
- Do not apply SQL migrations, edit applied migration files, or clean sample,
  submission or CoA data during cutover.
- Do not rotate JWT, Supabase or PostgreSQL secrets during migration.
- Direct rollback to the original VPS volumes is allowed only before public
  access is reopened. After reopening, the home volumes are authoritative and
  rollback requires a reverse cold copy to avoid losing new writes.
- Rotate the Tunnel token only after the seven-day rollback window and a
  successful backup restore drill.

## Verified Baseline

- VPS database logical size: approximately 35 MB.
- VPS Docker volumes: approximately 100 MB PostgreSQL and 2.7 MB Storage.
- Real identity rows: 31 `auth.users`, 29 `auth.identities`, 31 `public.users`.
- Roles: 22 analysts, 8 managers and 1 doctor.
- Signature state: 25 database rows, 25 Storage objects and 586,119 bytes.
- Sample/CoA data is test data and is not required to be removed during
  migration.
- Current public checks return HTTP 200 for `/` and `/auth/v1/health`.
- Home server: `khoa-xn-cdc@100.93.19.42`, i5-10400, 7.5 GiB RAM and
  approximately 856 GB free.
- Home Docker works through passwordless `sudo`; Docker, containerd, Tailscale
  and SSH are enabled at boot.
- Home server currently has no `/opt/lims-lite` checkout and no GitHub deploy
  key.

## Planned Files

- Modify: `.env.example`
  - Document `COMPOSE_PROJECT_NAME=lims-lite` and all deployment-only variables
    without adding secret values.
- Modify: `docker-compose.yml`
  - Pin every third-party service to the source VPS repository digest so the
    cutover cannot pull a different image behind the same tag.
- Create: `ops/home-server/backup.sh`
  - Produce logical PostgreSQL backups, cold volume archives and checksums.
- Create: `ops/home-server/restore.sh`
  - Validate checksums and restore only the two expected named volumes.
- Create: `ops/home-server/verify.sh`
  - Verify container health, database security checks, account/signature
    invariants and local or public HTTP endpoints.
- Create: `ops/home-server/deploy.sh`
  - Perform manual fast-forward-only application deployments without touching
    PostgreSQL, Storage or the Tunnel during normal code releases.
- Create: `ops/home-server/docker-compose.return.yml`
  - Map the Compose volume keys to separate return volumes for a post-acceptance
    reverse migration without overwriting the original VPS volumes.
- Create: `ops/home-server/tests/migration-scripts.test.sh`
  - Exercise backup, encryption, corruption rejection, restore guards and
    metadata preservation against disposable volumes.
- Create: `docs/operations/home-server-runtime-runbook.md`
  - Hold the operator-facing preparation, cutover, rollback and recovery
    procedure. Never include secret values.

## Chunk 1: Repository And Home-Server Preparation

### Task 1: Add Reproducible Deployment Controls

**Files:**
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Create: `ops/home-server/backup.sh`
- Create: `ops/home-server/restore.sh`
- Create: `ops/home-server/verify.sh`
- Create: `ops/home-server/deploy.sh`
- Create: `ops/home-server/docker-compose.return.yml`
- Create: `ops/home-server/tests/migration-scripts.test.sh`
- Create: `docs/operations/home-server-runtime-runbook.md`

- [ ] **Step 1: Create an implementation branch**

Run:

```bash
rtk git switch main
rtk git pull --ff-only
rtk git switch -c ops/home-server-runtime-migration
```

Expected: branch starts from current `origin/main` with a clean worktree.

- [ ] **Step 2: Pin and record every runtime image**

Create a source image manifest containing the repository digest, image ID,
architecture and creation time for every third-party Compose image. Pin every
service to that repository digest, including PostgreSQL and fixed-version tags.
The locally built app is reproducible from the exact Git commit and Dockerfile
hash.

The currently verified floating-image digests are:

```text
cloudflare/cloudflared@sha256:6d91c121b803126f7a5344005d17a9324788fc09d305b6e2560ec6040a7ae283
nginx@sha256:b0f7830b6bfaa1258f45d94c240ab668ced1b3651c8a222aefe6683447c7bf55
supabase/studio@sha256:5f7a6900725d658edddf1b7639826be7d5369559751c9e9b020d128f0f060b42
```

Before physical restore, require exact source/destination matches for:

- PostgreSQL image repository digest and amd64 architecture.
- PostgreSQL `PG_VERSION=15`, server version `15.1`, block size `8192` and WAL
  segment size `16MB`.
- Extensions: `pgcrypto=1.3`, `plpgsql=1.0`, `unaccent=1.1`,
  `uuid-ossp=1.1`.
- Every remaining third-party image repository digest.

Do not upgrade or repull a different service image during migration.

- [ ] **Step 3: Add fail-closed operational scripts**

Each script must use:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
```

Requirements:

- Refuse to run unless `COMPOSE_PROJECT_NAME=lims-lite`.
- Refuse unknown volume names.
- Require an explicit backup directory argument.
- Never print `.env` values.
- Require the Tunnel to be stopped before cold archive/restore operations.
- Refuse restore into a non-empty target volume unless an explicit,
  interactively confirmed recovery flag is provided.
- Write SHA-256 checksums for every archive.
- Read an `age` identity only from an explicit path under `/run`; refuse
  persistent identity files inside the repository or backup directory.
- Require return-volume names to differ from the original production volumes.

- [ ] **Step 4: Validate scripts and Compose**

Run:

```bash
rtk bash -n ops/home-server/*.sh
rtk bash ops/home-server/tests/migration-scripts.test.sh
rtk docker compose config --quiet
RETURN_POSTGRES_VOLUME=lims-lite-return-postgres-data \
RETURN_STORAGE_VOLUME=lims-lite-return-storage-data \
  rtk docker compose -f docker-compose.yml \
  -f ops/home-server/docker-compose.return.yml config --quiet
rtk npm run typecheck
rtk npm run test:run
rtk npm run build
```

The script tests must cover:

- Encrypted backup/decryption round-trip on disposable volumes.
- Corrupted archive/checksum rejection.
- Wrong project or volume-name rejection.
- Non-empty restore-target refusal.
- UID/GID, mode, size and file-hash preservation.
- Return-volume names equal to original production names are rejected.

Expected: shell syntax, behavioral tests, both Compose configurations,
typecheck, tests and production build all pass.

- [ ] **Step 5: Commit and push preparation artifacts**

```bash
rtk git add .env.example docker-compose.yml ops/home-server \
  docs/operations/home-server-runtime-runbook.md
rtk git commit -m "chore: Add home server migration controls"
rtk git push -u origin ops/home-server-runtime-migration
```

Open and merge the preparation PR into `main`, then record the exact merged
commit as `MIGRATION_COMMIT`. Do not prepare the home checkout from an unmerged
branch.

### Task 2: Prepare Git And Secrets On The Home Server

- [ ] **Step 1: Create a dedicated read-only GitHub deploy key**

Generate a dedicated key on the home server:

```bash
rtk ssh khoa-xn-cdc@100.93.19.42 \
  "ssh-keygen -t ed25519 -f ~/.ssh/lims-lite-deploy -N '' \
  -C 'lims-lite-home-deploy'"
```

Add only the public key to the GitHub repository as a read-only deploy key.
Do not reuse the VPS operator key and do not grant write access.

- [ ] **Step 2: Create the deployment checkout**

```bash
rtk ssh khoa-xn-cdc@100.93.19.42 \
  "sudo -n install -d -o khoa-xn-cdc -g khoa-xn-cdc -m 0750 /opt/lims-lite"
```

Clone with the dedicated key and verify the checked-out commit:

```bash
rtk ssh khoa-xn-cdc@100.93.19.42 \
  "GIT_SSH_COMMAND='ssh -i /home/khoa-xn-cdc/.ssh/lims-lite-deploy \
  -o IdentitiesOnly=yes' \
  git clone --branch main --single-branch \
  git@github.com:thienchi2109/lims-lite.git /opt/lims-lite &&
  test \"\$(git -C /opt/lims-lite rev-parse HEAD)\" = '<MIGRATION_COMMIT>'"
```

Expected: the home checkout equals the recorded merged `MIGRATION_COMMIT`.

- [ ] **Step 3: Transfer the production environment securely**

Transfer `.env` only over SSH/Tailscale. Store it as
`/opt/lims-lite/.env`, owned by `root:root`, mode `0600`.

Add this line to the protected source copy before transfer:

```env
COMPOSE_PROJECT_NAME=lims-lite
```

Do not rotate or regenerate any existing value during this step.

- [ ] **Step 4: Validate the complete environment file**

Compare the SHA-256 of the complete source and destination files without
printing values. Require exact byte equality, `root:root` ownership and mode
`0600`. Also compare sorted key names. Required production keys include:

```text
ANON_KEY
API_EXTERNAL_URL
CLOUDFLARE_TUNNEL_TOKEN
DB_ENC_KEY
JWT_SECRET
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_URL
POSTGRES_PASSWORD
RESEND_API_KEY
SECRET_KEY_BASE
SERVICE_ROLE_KEY
SITE_URL
```

- [ ] **Step 5: Prepare encrypted-transfer tooling**

Require compatible `age`, `rsync`, `sha256sum` and `tar` binaries on both
hosts. Create an `age` recovery identity outside both servers and store its
public recipient in the private operations record.

During restore, supply the private identity from the operator workstation to a
temporary root-owned `/run/lims-lite-age-key` file:

```bash
ssh khoa-xn-cdc@100.93.19.42 \
  "sudo -n sh -c 'umask 077; cat > /run/lims-lite-age-key'" \
  < /secure/offline/lims-lite-age-key.txt
```

Use the key only for restore, then remove `/run/lims-lite-age-key`. `/run` must
be tmpfs; never copy the identity into `/opt/lims-lite` or a backup directory.

- [ ] **Step 6: Verify Cloudflare recovery access**

Record the existing Tunnel name, Tunnel ID, public hostname, current origin
service and Cloudflare account owner in the private operations record.

Both of these are mandatory before cutover:

- Access to the Cloudflare dashboard/account for the temporary maintenance
  policy, connector-state verification and later token rotation.
- A confirmed secure copy of the current `CLOUDFLARE_TUNNEL_TOKEN`.

Stop if either requirement is unavailable. Do not create a new Tunnel or change
DNS.

### Task 3: Pre-Pull And Pre-Build Without Starting Services

- [ ] **Step 1: Validate the home-server Compose configuration**

```bash
rtk ssh khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite && sudo -n docker compose config --quiet"
```

- [ ] **Step 2: Pull pinned third-party images**

```bash
rtk ssh khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite && sudo -n docker compose pull --ignore-buildable"
```

- [ ] **Step 3: Build the application image**

```bash
rtk ssh khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite && sudo -n docker compose build app"
```

Expected: all images are amd64 and no containers or named volumes are started.
Compare every destination repository digest to the source image manifest.

- [ ] **Step 4: Rehearse backup, restore and return-volume startup**

On the home server, run the migration script tests, then create a disposable
`lims-rehearsal` Compose project without Tunnel. Initialize synthetic
PostgreSQL and Storage volumes, stop them cleanly, encrypt/archive them, restore
them into different rehearsal-return volumes and start the restored stack with
`docker-compose.return.yml`.

Require matching file manifests, clean PostgreSQL startup and successful
internal health checks. Remove only volumes whose names begin with the exact
`lims-rehearsal_` test prefix after recording the result. Never use production
volume names during rehearsal.

## Chunk 2: Cold Data And Tunnel Cutover

### Task 4: Enter Maintenance And Freeze Writes

- [ ] **Step 1: Announce the maintenance window**

Target a 30-minute window. Do not begin unless the home build, deploy key,
secret validation, image compatibility and rollback checklist have passed.

- [ ] **Step 2: Enable a temporary Cloudflare Access maintenance policy**

Protect `cdclims.cloud/*` with an allow-list containing only the cutover
operator. Verify an operator browser session is allowed and a normal anonymous
request is denied. Keep this policy active until the acceptance checkpoint.

- [ ] **Step 3: Stop and disable the VPS Tunnel connector**

Run on the VPS with explicit project context:

```bash
cd /root/lims-lite
rtk docker update --restart=no lims-tunnel
rtk docker compose -p lims-lite stop tunnel
rtk docker inspect -f '{{.State.Running}} {{.HostConfig.RestartPolicy.Name}}' \
  lims-tunnel
```

Expected: `false no`. In Cloudflare, wait until the VPS connector is inactive.
Do not proceed while any unexpected connector is active.

- [ ] **Step 4: Stop every write-capable service except PostgreSQL**

```bash
cd /root/lims-lite
rtk docker compose -p lims-lite stop \
  nginx app kong auth storage rest realtime studio meta
rtk docker compose -p lims-lite ps
```

Expected: only PostgreSQL remains running. Storage files and all application
tables are now quiescent.

### Task 5: Capture The Authoritative Source Manifest

- [ ] **Step 1: Create a protected cutover directory**

Create a timestamped root-owned directory with mode `0700`. All manifests,
encrypted archives and checksum files must be mode `0600`.

- [ ] **Step 2: Capture counts and whole-row digests**

`ops/home-server/verify.sh` must emit only counts and SHA-256 digests, never row
contents. Capture complete-row digests for:

```text
auth.users
auth.identities
auth.sessions
auth.refresh_tokens
auth.mfa_factors
public.users
public.manager_otp_settings
public.manager_otp_challenges
public.user_signatures
storage.objects WHERE bucket_id IN ('user-signatures', 'coa-reports')
```

Also capture role distribution, orphan checks, bucket counts and byte totals.
Expected initial account/signature counts are `31/29/31/25/25`, but the
post-freeze manifest is authoritative.

- [ ] **Step 3: Capture physical Storage checksums**

Create a sorted manifest containing relative path, size, numeric UID/GID, mode
and SHA-256 for every file in `lims-lite_storage-data`. This proves signature
and CoA file contents without exposing them.

- [ ] **Step 4: Create logical database recovery backups**

After writes are frozen, create:

- `postgres.dump.age` from `pg_dump --format=custom`.
- `globals.sql.age` from `pg_dumpall --globals-only`.

Stream both through `age` encryption so plaintext backups are never written to
disk. Store the recipient fingerprint in the manifest; keep the private
recovery key outside both servers.

- [ ] **Step 5: Stop PostgreSQL cleanly**

```bash
cd /root/lims-lite
rtk docker compose -p lims-lite stop postgres
rtk docker compose -p lims-lite ps
```

Using the exact pinned PostgreSQL image and the volume mounted read-only, require:

```text
Database cluster state: shut down
postmaster.pid: absent
PG_VERSION: 15
```

Stop if PostgreSQL did not shut down cleanly.

### Task 6: Create And Transfer Cold Volume Archives

- [ ] **Step 1: Record source volume metadata**

Capture `docker volume inspect` for both volumes. Require driver `local`, no
driver options and Compose labels for project `lims-lite`.

- [ ] **Step 2: Create encrypted cold archives**

Use `ops/home-server/backup.sh` to stream tar archives with numeric ownership
through `age` encryption:

```text
lims-lite_postgres-data.tar.gz.age
lims-lite_storage-data.tar.gz.age
```

Generate archive SHA-256 values and sorted file metadata manifests. No
unencrypted database or signature archive may remain on disk.

- [ ] **Step 3: Transfer over Tailscale**

Create `/var/backups/lims-lite/cutover/<timestamp>` on the home server as
`root:root`, mode `0700`. Transfer with:

```bash
rsync -aH --partial --progress --checksum \
  --rsync-path="sudo -n rsync" \
  <cutover-directory>/ \
  khoa-xn-cdc@100.93.19.42:/var/backups/lims-lite/cutover/<timestamp>/
```

Expected: transferred file count, modes and sizes match the source; encrypted
files are mode `0600`. Verify `sha256sum -c SHA256SUMS` on the home server
before restore.

### Task 7: Restore And Verify The Private Home Runtime

- [ ] **Step 1: Restore exact named volumes**

Run on the home server:

```bash
rtk ssh khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite && sudo -n \
  ops/home-server/restore.sh \
  --identity /run/lims-lite-age-key \
  /var/backups/lims-lite/cutover/<timestamp>"
```

Decrypt archives only as streams into tar. Require exact target names:

```text
lims-lite_postgres-data
lims-lite_storage-data
```

Remove `/run/lims-lite-age-key` immediately after the restore command exits,
including failure paths.

- [ ] **Step 2: Compare physical metadata before startup**

Require exact source/destination matches for:

- Volume driver and logical Compose labels.
- PostgreSQL and Storage sorted file manifests.
- Relative paths, sizes, hashes, UID/GID and modes.
- PostgreSQL clean shutdown state and compatibility baseline.
- Every third-party image repository digest and architecture.

- [ ] **Step 3: Start every service except Tunnel**

```bash
rtk ssh khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite && sudo -n docker compose -p lims-lite up -d \
  postgres auth rest storage realtime kong meta studio app nginx"
```

- [ ] **Step 4: Wait for health checks and inspect logs**

```bash
rtk ssh khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite &&
  sudo -n docker compose -p lims-lite ps &&
  sudo -n docker compose -p lims-lite logs --tail=100 \
  postgres auth storage kong app nginx"
```

Expected: PostgreSQL, Kong, Studio and app are healthy with no auth, Storage or
database startup errors.

- [ ] **Step 5: Run mandatory database security verification**

```bash
rtk ssh khoa-xn-cdc@100.93.19.42 \
  "sudo -n docker exec lims-postgres psql -U postgres -d postgres \
  -c 'SELECT * FROM run_security_tests();'"
```

Expected: no security test failure.

- [ ] **Step 6: Compare logical preservation manifests**

Run `ops/home-server/verify.sh` on the home server and require exact matches for
all source counts, role distribution, whole-row table digests, orphan checks,
Storage metadata and physical file manifests. This includes password hashes,
MFA/OTP state, sessions and refresh tokens inside non-reversible digests.

- [ ] **Step 7: Test Nginx internally**

```bash
rtk ssh khoa-xn-cdc@100.93.19.42 \
  "sudo -n docker exec lims-nginx \
  wget -qO- http://127.0.0.1/ >/dev/null &&
  sudo -n docker exec lims-nginx \
  wget -qO- http://127.0.0.1/auth/v1/health >/dev/null"
```

Expected: both checks succeed before public ingress starts.

### Task 8: Move Public Ingress And Set The Acceptance Boundary

- [ ] **Step 1: Reconfirm connector mutual exclusion**

Require all three:

- VPS `lims-tunnel` is stopped with restart policy `no`.
- Cloudflare shows the VPS connector inactive.
- No unexpected connector is active for the Tunnel.

If connector state cannot be proven, keep the maintenance outage and do not
start another connector.

- [ ] **Step 2: Start only the home-server Tunnel**

```bash
rtk ssh khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite &&
  sudo -n docker compose -p lims-lite up -d tunnel &&
  sudo -n docker compose -p lims-lite logs --tail=100 tunnel"
```

Expected: Cloudflare shows only the home connector active. The temporary Access
maintenance policy remains enabled.

- [ ] **Step 3: Verify through Cloudflare as the allowed operator**

Before interactive login, confirm exact source/destination equality one final
time. Then perform the operator tests below, recording the designated user ID
and start time so expected mutable-row changes can be isolated.

Verify in an authenticated operator browser:

- Application load and `/auth/v1/health`.
- Real-user login without recording the password.
- Role and OTP behavior.
- Signature rendering and Storage retrieval.
- CORS rejection and existing WAF/rate-limit behavior.

- [ ] **Step 4: Declare the acceptance checkpoint**

Re-run logical and physical manifests:

- Require continued exact equality for users, identities, profiles, password
  hashes, roles, MFA factors, signature rows, Storage metadata and physical
  files.
- For `auth.sessions`, `auth.refresh_tokens` and
  `public.manager_otp_challenges`, permit only rows attributable to the
  designated operator test after the recorded start time.
- Reject every unexplained delta.
- Store the resulting home manifest as the authoritative acceptance baseline.

If any gate fails, use pre-acceptance rollback while the maintenance policy
still blocks users.

If all gates pass:

1. Record the home server as the authoritative write source.
2. Remove the temporary whole-hostname maintenance policy.
3. Verify anonymous HTTP 200 for `/` and `/auth/v1/health`.
4. Announce the end of maintenance.

After this point, never restart the stale VPS volumes as production. Any
rollback must reverse cold-copy the current home volumes.

## Chunk 3: Rollback, Stabilization And Ongoing Deployment

### Task 9: Execute Rollback When A Gate Fails

Rollback triggers:

- Any account, identity, role, OTP or signature count mismatch.
- Missing signature object or physical file.
- Failed real-user login.
- Failed `run_security_tests()`.
- Persistent container health failure or public HTTP 5xx.
- Tunnel unable to reach home Nginx within 10 minutes.
- Connector mutual exclusion cannot be proven.

#### Pre-Acceptance Rollback

This path is allowed only while the temporary maintenance policy is active and
general users have not been allowed to write to the home server.

1. Stop and disable the home connector:

   ```bash
   rtk ssh khoa-xn-cdc@100.93.19.42 \
     "cd /opt/lims-lite &&
     sudo -n docker update --restart=no lims-tunnel &&
     sudo -n docker compose -p lims-lite stop tunnel &&
     sudo -n docker compose -p lims-lite stop"
   ```

2. Wait until Cloudflare reports the home connector inactive. If this cannot
   be proven, keep the outage and do not start the VPS connector.
3. Restore the VPS Tunnel restart policy and start the original stack:

   ```bash
   cd /root/lims-lite
   rtk docker update --restart=unless-stopped lims-tunnel
   rtk docker compose -p lims-lite up -d
   rtk docker compose -p lims-lite ps
   ```

4. Verify the VPS through the maintenance policy, then remove the temporary
   policy and confirm public health.

#### Post-Acceptance Reverse Migration

After the acceptance boundary, the home volumes contain authoritative writes.
Never start the original stale VPS volumes as production.

1. Re-enable the whole-hostname maintenance policy.
2. Stop and disable the home Tunnel, stop write-capable services, capture final
   home manifests and logical backups, then stop PostgreSQL cleanly.
3. Create encrypted cold archives from the home volumes and transfer them to
   the VPS.
4. Keep the original VPS volumes untouched. Restore the current home data into
   separate return volumes using `ops/home-server/docker-compose.return.yml`.
5. Remove only the stopped VPS containers, never the original volumes, then
   start the return volumes without Tunnel and repeat all private verification.
6. Prove the home connector is inactive, start only the VPS connector, verify
   through Access and remove the maintenance policy.

If the home data cannot be read, preserve the outage and recover from the
latest verified encrypted backup. Do not create a split-brain fallback.

Do not modify or delete any failed restore until logs, manifests and checksums
have been captured.

### Task 10: Stabilize The Home-Server Runtime

- [ ] Keep the stopped VPS volumes and all cutover archives for at least seven
  days.
- [ ] Monitor container restarts, memory, disk, Tunnel logs and auth failures
  throughout the seven-day rollback window.
- [ ] After the seven-day rollback window and a successful restore drill,
  rotate the Cloudflare Tunnel token in the Cloudflare account.
- [ ] Update only the home `.env`, recreate only `tunnel`, then prove the old
  VPS token cannot establish a new connector.
- [ ] Reboot the home server once during the rollback window and verify Docker,
  all containers, Tailscale, SSH and the Tunnel recover automatically.
- [ ] Configure encrypted nightly PostgreSQL and Storage backups to the VPS and
  run one restore drill.
- [ ] Keep backup directories root-owned with mode `0700`, backup files mode
  `0600`, and private decryption keys outside both servers.
- [ ] Remove the old VPS `.env` and Tunnel capability only after the rollback
  window and backup restore drill pass.
- [ ] Delete expired encrypted cutover archives only after explicit approval
  and confirmation that newer backups restore successfully.
- [ ] Treat removal of sample, submission and CoA test data as a separate,
  reviewed cleanup plan.

### Task 11: Establish Manual Deployments From `main`

`ops/home-server/deploy.sh` must:

1. Acquire a deployment lock.
2. Run Git operations as `khoa-xn-cdc` with the dedicated deploy key.
3. Refuse non-fast-forward updates and a dirty checkout.
4. Detect new files under `supabase/migrations/` and stop for explicit database
   review instead of applying them automatically.
5. Fetch `origin/main` and fast-forward the checkout as `khoa-xn-cdc`.
6. Use passwordless `sudo` only for Docker Compose operations that need root
   access to `.env` and the Docker socket.
7. Tag the current app image as the deployment rollback image.
8. Build the new app image.
9. Recreate only `app` and `nginx` for an application-only release.
10. Leave `postgres`, `storage` and `tunnel` running.
11. Run local and public health checks.
12. Roll back to the previous Git commit and app image if verification fails.

Initial deployment remains manual:

```bash
rtk ssh khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite && ops/home-server/deploy.sh"
```

Automatic polling, webhooks or a self-hosted GitHub runner are out of scope
until manual deployments and rollback have been proven.

### Task 12: Final Verification And Closeout

- [ ] Run `rtk npm run typecheck`, focused tests and `rtk npm run build`.
- [ ] Run `rtk bash -n ops/home-server/*.sh`.
- [ ] Run `rtk docker compose config --quiet` on both hosts.
- [ ] Verify `cdclims.cloud`, auth health, real login, OTP and signature access.
- [ ] Verify the home server is the only active Tunnel connector.
- [ ] Verify nightly backups and one restore drill.
- [ ] Update the operations runbook with measured downtime and final checksums.
- [ ] Commit using Conventional Commits.
- [ ] Push the implementation branch and verify it is up to date with origin.

# PostgreSQL Alpine to Supabase Migration Guide

**Migration Version:** 15-alpine → supabase/postgres:15.8.1.085
**Date:** December 16, 2025
**Purpose:** Enable Supabase Realtime `postgres_changes` functionality via wal2json plugin

---

## Overview

This guide provides step-by-step instructions for migrating from `postgres:15-alpine` to `supabase/postgres:15.8.1.085` on any development PC running the CDC-LIMS stack via Docker Compose.

### Why This Migration Is Needed

- **Problem:** Alpine Linux (musl libc) does not include the `wal2json` PostgreSQL output plugin
- **Impact:** Supabase Realtime cannot use `postgres_changes` subscriptions for Change Data Capture (CDC)
- **Solution:** Use Supabase's official Postgres image (Debian-based with glibc) which includes wal2json pre-installed

### Key Facts

- **Breaking Change:** Alpine and Debian Postgres use incompatible binary database formats
- **Migration Method:** Full dump/restore (cannot reuse existing volume)
- **Downtime:** ~10-20 minutes for development environments
- **Data Loss Risk:** Medium (mitigated by backup verification)
- **Image Size:** Increases from ~80MB to ~450MB

---

## Prerequisites

Before starting the migration, ensure you have:

- [ ] Docker and Docker Compose installed and running
- [ ] Git installed (for committing changes)
- [ ] Access to PowerShell or bash terminal
- [ ] Sufficient disk space (~2GB free for image + backup)
- [ ] Administrative access to the PC

**Important:** This guide assumes you are migrating a **development environment**. For production, schedule a maintenance window and follow additional verification steps.

---

## Migration Steps

### Phase 1: Pre-Migration Verification and Backup

#### Step 1.1: Verify Current State

```bash
# Check all containers are running
docker ps

# Verify current Postgres image
docker inspect lims-postgres --format='{{.Config.Image}}'
# Expected output: postgres:15-alpine

# Check volume name
docker volume ls | grep postgres
# Expected output: lims-lite_postgres-data
```

#### Step 1.2: Record Current Data Counts (for verification)

```bash
docker exec lims-postgres psql -U postgres -d postgres -c "
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'samples', COUNT(*) FROM samples
UNION ALL SELECT 'results', COUNT(*) FROM results
UNION ALL SELECT 'clients', COUNT(*) FROM clients
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
ORDER BY table_name;
"
```

**Save this output!** You'll need it to verify data integrity after migration.

#### Step 1.3: Create Full Database Backup

**Windows (PowerShell):**
```powershell
docker exec -t lims-postgres pg_dumpall -c -U postgres > full_backup.sql
```

**Linux/macOS (bash):**
```bash
docker exec -t lims-postgres pg_dumpall -c -U postgres > full_backup.sql
```

#### Step 1.4: Verify Backup Integrity

```bash
# Check file size (should be several MB)
ls -lh full_backup.sql

# Verify backup contains data
grep -E "CREATE TABLE|INSERT INTO" full_backup.sql | head -20

# Count INSERT statements
grep -c "INSERT INTO" full_backup.sql
```

#### Step 1.5: Create Safety Backup Copy

**Windows:**
```powershell
cp full_backup.sql "full_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
```

**Linux/macOS:**
```bash
cp full_backup.sql full_backup_$(date +%Y%m%d_%H%M%S).sql
```

---

### Phase 2: Stop Containers and Remove Volume

#### Step 2.1: Stop All Containers

```bash
docker compose down
```

#### Step 2.2: Verify Containers Stopped

```bash
docker ps -a | grep lims
# Expected: No output (all removed)
```

#### Step 2.3: Remove Incompatible Postgres Volume

```bash
docker volume rm lims-lite_postgres-data
```

#### Step 2.4: Verify Volume Removed

```bash
docker volume ls | grep postgres
# Expected: No output
```

---

### Phase 3: Update docker-compose.yml

#### Step 3.1: Open docker-compose.yml

Use your preferred text editor to open `docker-compose.yml`.

#### Step 3.2: Update Postgres Service Configuration

**Find this section (around line 2-18):**
```yaml
  postgres:
    image: postgres:15-alpine
    container_name: lims-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-your-super-secret-and-long-postgres-password}
      POSTGRES_DB: postgres
    command:
      - postgres
      - -c
      - wal_level=logical
      - -c
      - max_replication_slots=10
      - -c
      - max_wal_senders=10
```

**Replace with:**
```yaml
  postgres:
    image: supabase/postgres:15.8.1.085
    container_name: lims-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-your-super-secret-and-long-postgres-password}
      POSTGRES_DB: postgres
    command:
      - postgres
      - -c
      - listen_addresses=*
      - -c
      - wal_level=logical
      - -c
      - max_replication_slots=10
      - -c
      - max_wal_senders=10
```

**Key Changes:**
1. **Line 3:** `image: supabase/postgres:15.8.1.085` (was `postgres:15-alpine`)
2. **Line 14-15:** Added `listen_addresses=*` (CRITICAL for Docker networking)

#### Step 3.3: Validate Configuration Syntax

```bash
docker compose config
# Should output valid YAML without errors
```

---

### Phase 4: Start Containers with New Image

#### Step 4.1: Pull New Supabase Postgres Image

```bash
docker compose pull postgres
```

**Note:** This downloads ~450MB. May take 5-10 minutes depending on internet speed.

#### Step 4.2: Start All Containers

```bash
docker compose up -d
```

#### Step 4.3: Wait for Postgres to Initialize

```bash
# Wait 30 seconds for initialization
sleep 30

# Check Postgres container status
docker compose ps postgres
# Expected: STATUS = "Up" and "healthy"
```

#### Step 4.4: Verify Postgres is Listening on Network

```bash
docker compose logs postgres | grep "listening on"
```

**Expected Output:**
```
listening on IPv4 address "0.0.0.0", port 5432
listening on IPv6 address "::", port 5432
```

**❌ If you see `listening on IPv4 address "127.0.0.1"`:**
You forgot to add `listen_addresses=*` to the command. Go back to Step 3.2.

---

### Phase 5: Restore Database from Backup

#### Step 5.1: Restore Data

**Windows (PowerShell):**
```powershell
Get-Content full_backup.sql | docker exec -i lims-postgres psql -U postgres
```

**Linux/macOS (bash):**
```bash
cat full_backup.sql | docker exec -i lims-postgres psql -U postgres
```

**Note:** This may take 1-5 minutes. You'll see many SQL statements scroll by.

#### Step 5.2: Expected Warnings (Can Be Ignored)

You may see these errors - they are **normal and safe to ignore**:

```
ERROR: role "postgres" already exists
ERROR: role "anon" already exists
ERROR: role "authenticated" already exists
ERROR: role "service_role" already exists
```

**Reason:** The Supabase image comes pre-configured with these roles.

#### Step 5.3: Verify Data Was Restored

```bash
docker exec lims-postgres psql -U postgres -d postgres -c "
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'samples', COUNT(*) FROM samples
UNION ALL SELECT 'results', COUNT(*) FROM results
UNION ALL SELECT 'clients', COUNT(*) FROM clients
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
ORDER BY table_name;
"
```

**Compare with Step 1.2 output.** All counts must match exactly!

---

### Phase 6: Verify Realtime Functionality

#### Step 6.1: Restart Realtime Service

```bash
docker compose restart realtime
```

#### Step 6.2: Wait for Realtime to Initialize

```bash
sleep 10
```

#### Step 6.3: Check Realtime Logs for Errors

```bash
docker compose logs realtime --tail 50 | grep -i "error\|wal2json"
```

**Expected:** No "wal2json" errors should appear.

**✅ Success Indicators:**
- "Migrations already up"
- "Starting Realtime"
- "Running RealtimeWeb.Endpoint"
- No "could not access file wal2json" errors

#### Step 6.4: Test wal2json Plugin

```bash
# Create a test replication slot
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM pg_create_logical_replication_slot('test_slot', 'wal2json');"
```

**Expected Output:**
```
 slot_name |    lsn
-----------+-----------
 test_slot | 0/XXXXXXX
```

**If you see an error about wal2json not found, the migration failed!**

#### Step 6.5: Clean Up Test Slot

```bash
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT pg_drop_replication_slot('test_slot');"
```

#### Step 6.6: Verify All Containers Are Running

```bash
docker compose ps
```

**Expected:** All 11 containers should show status "Up" (no "Restarting").

---

### Phase 7: Commit Changes

#### Step 7.1: Stage docker-compose.yml

```bash
git add docker-compose.yml
```

#### Step 7.2: Commit with Descriptive Message

```bash
git commit -m "infra: migrate from postgres:15-alpine to supabase/postgres:15.8.1.085

- Changed base image to enable wal2json plugin for Realtime
- Added listen_addresses=* for Docker network connectivity
- Full dump/restore migration completed successfully
- All data integrity verified"
```

---

## Post-Migration Verification Checklist

Use this checklist to ensure the migration was successful:

- [ ] All 11 containers running (`docker compose ps` shows all "Up")
- [ ] Postgres listening on `0.0.0.0:5432` (not just `127.0.0.1`)
- [ ] Data counts match pre-migration values exactly
- [ ] Database size is similar to before (~14MB for dev data)
- [ ] Realtime logs show no wal2json errors
- [ ] Test replication slot created successfully with wal2json
- [ ] Application loads without database connection errors
- [ ] Login works with existing credentials
- [ ] Changes committed to git

---

## Rollback Procedure (If Migration Fails)

If something goes wrong, follow these steps to restore the Alpine image:

### Step 1: Stop Containers

```bash
docker compose down
```

### Step 2: Remove New Volume

```bash
docker volume rm lims-lite_postgres-data
```

### Step 3: Revert docker-compose.yml

Change the image back to:
```yaml
image: postgres:15-alpine
```

Remove the `listen_addresses=*` line from the command.

### Step 4: Start Containers

```bash
docker compose up -d
```

### Step 5: Wait for Postgres to Initialize

```bash
sleep 30
```

### Step 6: Restore from Backup

**Windows:**
```powershell
Get-Content full_backup.sql | docker exec -i lims-postgres psql -U postgres
```

**Linux/macOS:**
```bash
cat full_backup.sql | docker exec -i lims-postgres psql -U postgres
```

### Step 7: Verify Rollback

```bash
docker compose ps
# All containers should be "Up"

docker inspect lims-postgres --format='{{.Config.Image}}'
# Should show: postgres:15-alpine
```

---

## Troubleshooting

### Issue: "connection refused" errors in auth/storage/realtime logs

**Cause:** Postgres is only listening on `127.0.0.1` instead of `0.0.0.0`

**Solution:**
1. Verify `listen_addresses=*` is in docker-compose.yml command section
2. Restart containers: `docker compose down && docker compose up -d`
3. Verify: `docker compose logs postgres | grep "listening on"`
   - Should see `0.0.0.0`, not `127.0.0.1`

### Issue: "could not access file wal2json" in Realtime logs

**Cause:** Still using Alpine image or wrong image version

**Solution:**
1. Verify image: `docker inspect lims-postgres --format='{{.Config.Image}}'`
2. Should be: `supabase/postgres:15.8.1.085`
3. If wrong, update docker-compose.yml and run `docker compose down && docker compose up -d`

### Issue: Data counts don't match after restore

**Cause:** Restore failed or was incomplete

**Solution:**
1. Check restore output for critical errors (ignore role exists errors)
2. Re-run restore command
3. If still failing, perform rollback and investigate backup file

### Issue: Realtime container keeps restarting

**Cause:** Cannot connect to Postgres due to network configuration

**Solution:**
1. Check Postgres logs: `docker compose logs postgres`
2. Ensure `listen_addresses=*` is configured
3. Restart Realtime: `docker compose restart realtime`

---

## Important Notes

### For Production Environments

**⚠️ Production migrations require additional steps:**

1. **Schedule Maintenance Window:** 60-90 minutes recommended
2. **Notify Stakeholders:** Inform users of planned downtime
3. **Test Backup Restoration:** Verify backup can be restored before starting
4. **Extended Verification:** Test all critical features before resuming service
5. **Monitor for 24 Hours:** Watch logs for any issues
6. **Keep Alpine Backup:** Retain backup image for emergency rollback

### Image Size Considerations

- **Alpine:** ~80MB
- **Supabase Postgres:** ~450MB
- **Trade-off:** Functionality (wal2json) > minimalism

### Version Pinning

This guide uses `supabase/postgres:15.8.1.085` (specific version) for reproducibility.

**To check for newer versions:**
```bash
# Visit https://hub.docker.com/r/supabase/postgres/tags
# Or check Supabase's official docker-compose.yml:
# https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml
```

**When updating to a newer version:**
1. Update version in docker-compose.yml
2. Test in development first
3. Verify compatibility with current Realtime version
4. Document the version change in git commit

---

## Quick Reference Commands

### Check Container Status
```bash
docker compose ps
```

### View Logs
```bash
docker compose logs postgres --tail 50
docker compose logs realtime --tail 50
docker compose logs auth --tail 50
```

### Database Connection Test
```bash
docker exec lims-postgres psql -U postgres -c "SELECT version();"
```

### Restart Specific Service
```bash
docker compose restart postgres
docker compose restart realtime
```

### Full Stack Restart
```bash
docker compose down && docker compose up -d
```

---

## Success Criteria Summary

Your migration is **successful** when:

1. ✅ All containers healthy (no restart loops)
2. ✅ Postgres listening on `0.0.0.0` and `::`
3. ✅ All data counts match pre-migration values
4. ✅ Realtime logs show NO "wal2json" errors
5. ✅ Test replication slot created with wal2json plugin
6. ✅ Application loads and functions normally
7. ✅ Changes committed to git

---

## References

- **Supabase Realtime Documentation:** https://supabase.com/docs/guides/realtime/postgres-changes
- **PostgreSQL pg_dumpall:** https://www.postgresql.org/docs/15/app-pg-dumpall.html
- **Docker Volume Management:** https://docs.docker.com/storage/volumes/
- **Supabase Docker Images:** https://hub.docker.com/r/supabase/postgres

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-16 | 1.0 | Initial migration guide created |

---

**Document Status:** ✅ Tested and verified on Windows 11 with Docker Desktop

For questions or issues, refer to the archived OpenSpec proposal:
`openspec/changes/archive/2025-12-16-migrate-postgres-alpine-to-supabase/`

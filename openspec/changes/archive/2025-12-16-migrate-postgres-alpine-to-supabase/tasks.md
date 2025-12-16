# Implementation Tasks: Migrate Postgres Alpine to Supabase Image

## Pre-Migration Verification

- [ ] 1.1 Verify current containers are running (`docker ps`)
- [ ] 1.2 Verify current Postgres image is `postgres:15-alpine`
- [ ] 1.3 Identify current volume name (`docker volume ls | grep postgres`)
- [ ] 1.4 Check current database size and record count for verification
- [ ] 1.5 Verify Realtime currently shows wal2json errors in logs

## 1. Create Full Database Backup

- [ ] 2.1 Export all data using `pg_dumpall` while Alpine container is running
  ```bash
  docker exec -t lims-postgres pg_dumpall -c -U postgres > full_backup.sql
  ```
- [ ] 2.2 Verify backup file exists and is not empty (`ls -lh full_backup.sql`)
- [ ] 2.3 Check backup file contains expected content (grep for key tables)
  ```bash
  grep -E "CREATE TABLE|INSERT INTO" full_backup.sql | head -20
  ```
- [ ] 2.4 Create a timestamped copy as safety backup
  ```bash
  cp full_backup.sql full_backup_$(date +%Y%m%d_%H%M%S).sql
  ```

## 2. Stop Containers and Remove Incompatible Volume

- [ ] 3.1 Stop all containers gracefully
  ```bash
  docker compose down
  ```
- [ ] 3.2 Verify all containers stopped (`docker ps -a | grep lims`)
- [ ] 3.3 Remove the incompatible Postgres data volume
  ```bash
  docker volume rm lims-lite_postgres-data
  ```
- [ ] 3.4 Verify volume removed (`docker volume ls | grep postgres`)
  - Expected: No postgres volume listed

## 3. Update docker-compose.yml

- [ ] 4.1 Read current docker-compose.yml postgres service configuration
- [ ] 4.2 Update postgres image from `postgres:15-alpine` to `supabase/postgres:15.8.1.085`
- [ ] 4.3 Update command configuration to use supabase postgres config pattern
  ```yaml
  command:
    - postgres
    - -c
    - config_file=/etc/postgresql/postgresql.conf
    - -c
    - wal_level=logical
  ```
- [ ] 4.4 Verify docker-compose.yml syntax is valid (`docker compose config`)
- [ ] 4.5 Commit the docker-compose.yml change
  ```bash
  git add docker-compose.yml
  git commit -m "infra: migrate from postgres:15-alpine to supabase/postgres for wal2json support"
  ```

## 4. Start Containers with New Image

- [ ] 5.1 Pull the new Supabase postgres image
  ```bash
  docker compose pull postgres
  ```
- [ ] 5.2 Start all containers
  ```bash
  docker compose up -d
  ```
- [ ] 5.3 Wait 30 seconds for database initialization
- [ ] 5.4 Verify postgres container started successfully
  ```bash
  docker compose ps postgres
  ```
  - Expected: Status = "Up" (healthy)
- [ ] 5.5 Check postgres logs for initialization completion
  ```bash
  docker compose logs postgres | tail -20
  ```
  - Expected: "database system is ready to accept connections"

## 5. Restore Data from Backup

- [ ] 6.1 Restore data using PowerShell (Windows)
  ```powershell
  Get-Content full_backup.sql | docker exec -i lims-postgres psql -U postgres
  ```
- [ ] 6.2 Monitor restore output for critical errors (ignore "role already exists")
- [ ] 6.3 Verify restore completion (check last few lines of output)
- [ ] 6.4 Query database to verify data was restored
  ```bash
  docker exec lims-postgres psql -U postgres -d postgres -c "SELECT COUNT(*) FROM users;"
  docker exec lims-postgres psql -U postgres -d postgres -c "SELECT COUNT(*) FROM samples;"
  docker exec lims-postgres psql -U postgres -d postgres -c "SELECT COUNT(*) FROM results;"
  ```
- [ ] 6.5 Compare counts with pre-migration verification (Step 1.4)

## 6. Verify Realtime Functionality

- [ ] 7.1 Restart Realtime service to pick up new database configuration
  ```bash
  docker compose restart realtime
  ```
- [ ] 7.2 Check Realtime logs for wal2json errors
  ```bash
  docker compose logs realtime | grep -i "wal2json\|error"
  ```
  - Expected: No "could not access file wal2json" errors
- [ ] 7.3 Verify tenant seeding completed successfully
  ```bash
  docker exec lims-postgres psql -U postgres -d postgres -c "SELECT external_id FROM public.tenants;"
  ```
  - Expected: Shows "realtime-dev"
- [ ] 7.4 Verify replication slot is active
  ```bash
  docker exec lims-postgres psql -U postgres -d postgres -c "SELECT slot_name, active FROM pg_replication_slots;"
  ```
  - Expected: At least one active slot

## 7. Application Verification

- [ ] 8.1 Run typecheck to verify no TypeScript errors
  ```bash
  npm run typecheck
  ```
  - Expected: No errors
- [ ] 8.2 Start Next.js development server
  ```bash
  npm run dev
  ```
  - Expected: Starts on port 3000 without errors
- [ ] 8.3 Test login with existing credentials
  - Email: manager@example.com
  - Password: Manager123!
  - Expected: Successful login
- [ ] 8.4 Navigate to /manager/samples page
  - Expected: Sample list loads correctly
- [ ] 8.5 Test Realtime subscription (open two browser tabs, update sample in one)
  - Expected: Other tab updates without manual refresh

## 8. Update Documentation

- [ ] 9.1 Update docker-compose.yml inline comments to reference Supabase postgres
- [ ] 9.2 Update docs/DATABASE_SETUP.md with new image reference
- [ ] 9.3 Remove or update warning about "Alternative: Use Standard Postgres Image"
- [ ] 9.4 Add note about wal2json being included in supabase/postgres image
- [ ] 9.5 Commit documentation updates
  ```bash
  git add docs/DATABASE_SETUP.md docker-compose.yml
  git commit -m "docs: update database setup guide for supabase/postgres image"
  ```

## 9. Cleanup

- [ ] 10.1 Archive successful backup file to safe location
- [ ] 10.2 Remove temporary backup files from project directory
- [ ] 10.3 Verify .gitignore excludes *.sql files
- [ ] 10.4 Document the migration in docs/NOTES.md or similar

## 10. Production Deployment Planning

- [ ] 11.1 Review railway-docker-compose.yml for any image references
- [ ] 11.2 Create production migration checklist based on this task list
- [ ] 11.3 Document rollback procedure (restore Alpine image + old backup)
- [ ] 11.4 Notify stakeholders of required maintenance window

---

## Expected Errors During Restore (Can Be Ignored)

```
ERROR: role "postgres" already exists
ERROR: role "anon" already exists
ERROR: role "authenticated" already exists
ERROR: role "service_role" already exists
```

**Reason:** The Supabase image comes pre-configured with default roles. The restore script will skip creating them and proceed to populate data correctly.

---

## Rollback Procedure (If Migration Fails)

1. Stop containers: `docker compose down`
2. Remove new volume: `docker volume rm lims-lite_postgres-data`
3. Revert docker-compose.yml to `postgres:15-alpine`
4. Start containers: `docker compose up -d`
5. Restore from backup: `Get-Content full_backup.sql | docker exec -i lims-postgres psql -U postgres`

---

## Success Criteria

✅ All tasks completed without critical errors
✅ Data counts match pre-migration verification
✅ Application loads and functions normally
✅ Realtime logs show no wal2json errors
✅ `postgres_changes` subscriptions work
✅ All containers healthy: `docker compose ps`

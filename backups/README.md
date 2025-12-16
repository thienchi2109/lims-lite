# Database Backups Directory

This directory contains database backups created during migrations and maintenance operations.

## ⚠️ Security Notice

**IMPORTANT:** This directory is excluded from version control (.gitignore) because backups may contain:
- Sensitive user data
- Authentication credentials
- Audit logs
- Client information

**Never commit backup files to git!**

---

## Current Backups

### postgres-migration/

**Created:** 2025-12-16
**Purpose:** Postgres Alpine to Supabase migration safety backups
**Size:** ~2.5 MB each

Files:
- `full_backup.sql` - Full database dump before migration
- `full_backup_20251216_200413.sql` - Timestamped safety copy

**Contents:**
- All tables and schemas from postgres:15-alpine
- Users: 4
- Samples: 51
- Results: 1,387
- Clients: 40
- Audit logs: 3,163

**Retention:** Keep until migration stability confirmed (recommended: 30 days)

---

## Backup Retention Policy

### Development Environment

- **Migration Backups:** Keep for 30 days after successful migration
- **Manual Backups:** Keep for 7 days unless labeled otherwise
- **Automated Backups:** Not yet implemented

### Production Environment (When Deployed)

- **Daily Backups:** Keep for 30 days
- **Weekly Backups:** Keep for 90 days
- **Monthly Backups:** Keep for 1 year
- **Migration Backups:** Keep for 90 days after successful migration

---

## Creating New Backups

### Full Database Backup

```bash
# Create backup with timestamp
docker exec -t lims-postgres pg_dumpall -c -U postgres > backups/full_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Specific Database Backup

```bash
# Backup specific database
docker exec -t lims-postgres pg_dump -U postgres -d postgres > backups/postgres_$(date +%Y%m%d_%H%M%S).sql
```

### Schema-Only Backup

```bash
# Backup schema without data
docker exec -t lims-postgres pg_dump -U postgres -d postgres --schema-only > backups/schema_$(date +%Y%m%d_%H%M%S).sql
```

---

## Restoring from Backup

### Restore Full Database

```powershell
# Windows PowerShell
Get-Content backups/full_backup.sql | docker exec -i lims-postgres psql -U postgres
```

```bash
# Linux/macOS bash
cat backups/full_backup.sql | docker exec -i lims-postgres psql -U postgres
```

### Restore Specific Database

```bash
docker exec -i lims-postgres psql -U postgres -d postgres < backups/postgres_backup.sql
```

---

## Backup Verification

Before relying on a backup, verify its integrity:

```bash
# Check file size (should be several MB for production data)
ls -lh backups/full_backup.sql

# Check backup contains data
grep -c "INSERT INTO" backups/full_backup.sql

# Verify table structures exist
grep "CREATE TABLE" backups/full_backup.sql | wc -l
```

---

## Cleanup Guidelines

### Safe to Delete

- ✅ Migration backups older than 30 days (after migration stability confirmed)
- ✅ Manual backups older than 7 days (unless specifically retained)
- ✅ Duplicate backups (keep most recent)

### Keep Permanently

- ❌ Backups labeled with "KEEP" or "PERMANENT"
- ❌ Backups before major version upgrades
- ❌ Backups before production deployments
- ❌ Backups required for compliance/audit purposes

---

## Emergency Recovery

If the database is corrupted or lost:

1. **Stop all containers:**
   ```bash
   docker compose down
   ```

2. **Remove corrupted volume:**
   ```bash
   docker volume rm lims-lite_postgres-data
   ```

3. **Start containers (creates fresh database):**
   ```bash
   docker compose up -d
   ```

4. **Wait for Postgres to initialize:**
   ```bash
   sleep 30
   ```

5. **Restore from most recent backup:**
   ```bash
   cat backups/full_backup.sql | docker exec -i lims-postgres psql -U postgres
   ```

6. **Verify data integrity:**
   ```bash
   docker exec lims-postgres psql -U postgres -d postgres -c "SELECT COUNT(*) FROM users;"
   ```

---

## Backup Storage Locations

### Development
- **Local:** `/backups/` directory (gitignored)
- **External:** Recommended to copy to external drive weekly

### Production (Future)
- **Primary:** Automated backups to cloud storage (AWS S3/Azure Blob)
- **Secondary:** Local backups retained on server
- **Offsite:** Periodic backups copied to separate geographic location

---

## Compliance Notes (21 CFR Part 11)

For FDA compliance, ensure:
- ✅ Backups are timestamped and immutable
- ✅ Backup restoration is tested regularly
- ✅ Backup access is logged and audited
- ✅ Backups are encrypted if stored offsite
- ✅ Backup retention meets regulatory requirements

---

**Last Updated:** 2025-12-16
**Maintained By:** Development Team

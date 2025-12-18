# PostgreSQL Full-Text Search - Staging/Production Deployment Guide

## Overview

This guide explains how to deploy the PostgreSQL full-text search migrations to staging/production environments with **zero downtime** using `CREATE INDEX CONCURRENTLY`.

## Important Concepts

### Development vs Production Migrations

**Development migrations** (in `supabase/migrations/`):
- Use regular `CREATE INDEX`
- Fast index creation (locks table during creation)
- Suitable for local development with no active users
- Already applied to your local database

**Production migrations** (in `supabase/migrations/production/`):
- Use `CREATE INDEX CONCURRENTLY`
- Slower index creation (allows concurrent reads/writes)
- **Zero downtime** - table remains accessible
- Required for staging/production with active users

### Key Differences

| Feature | Regular CREATE INDEX | CREATE INDEX CONCURRENTLY |
|---------|---------------------|---------------------------|
| Table locking | Yes (blocks writes) | No (allows writes) |
| Speed | Fast | Slower (2-3x longer) |
| Transaction support | Yes | **No** (must run separately) |
| Rollback | Yes | Limited |
| Use case | Development | Staging/Production |

## Prerequisites

Before deploying to staging/production:

1. ✅ All development migrations tested locally
2. ✅ Security tests passed (`run_security_tests()`)
3. ✅ TypeScript compilation passed (`npm run typecheck`)
4. ✅ Manual testing completed
5. ✅ Database backup created

## Deployment Steps

### Step 1: Create Database Backup

```bash
# On your staging/production server
docker exec lims-postgres pg_dump -U postgres -d postgres -F c -b -v -f /tmp/backup_before_search.dump

# Or for managed PostgreSQL (Railway, Render, etc.)
pg_dump postgresql://user:pass@host:port/db -F c -b -v -f backup_before_search.dump
```

### Step 2: Apply Prerequisite Migrations

**CRITICAL**: Apply migrations in this exact order to avoid issues:

```bash
# Migration 068: Install unaccent extension (REQUIRED FIRST)
cat supabase/migrations/068_install_unaccent.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# Migration 069: Update audit trigger to exclude search_vector (REQUIRED BEFORE 070-074)
# This prevents backfill operations from flooding audit logs with search_vector updates
cat supabase/migrations/070_update_audit_exclude_search_vector.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

**Note on Migration Numbering**:
- Development migrations: 068, 069 (samples), 070 (audit exclude), 071-074 (other tables)
- Production migrations: 068, 069 (audit exclude), 070-074 (all tables with CONCURRENTLY)
- The production folder uses 070-074 to reflect the correct execution order (after 069)

**Why this order matters**:
- Migration 068 must run first (production migrations depend on `unaccent()` function)
- Migration 069/070 (audit exclude) must run before 070-074 (prevents audit log pollution during backfill)
- Without migration 069/070, backfilling 10,000 samples generates 10,000 audit log entries

### Step 3: Apply Production Migrations with CONCURRENTLY

**CRITICAL**: These migrations use `CREATE INDEX CONCURRENTLY` which:
- **Cannot run inside a transaction block**
- Must be run as separate statements
- Cannot be rolled back like regular transactions
- Include `WHERE search_vector IS NULL` for idempotent backfills

Apply each migration separately:

```bash
# Migration 070: Add search to samples (PRODUCTION VERSION)
cat supabase/migrations/production/070_add_search_to_samples.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# Migration 071: Add search to clients (PRODUCTION VERSION)
cat supabase/migrations/production/071_add_search_to_clients.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# Migration 072: Add search to assays (PRODUCTION VERSION)
cat supabase/migrations/production/072_add_search_to_assays.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# Migration 073: Add search to results (PRODUCTION VERSION)
cat supabase/migrations/production/073_add_search_to_results.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# Migration 074: Add search to audit logs (PRODUCTION VERSION - LARGEST TABLE)
# Note: This may take longest due to audit_logs size
cat supabase/migrations/production/074_add_search_to_audit_logs.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

**Idempotent Backfills**: All production migrations include `WHERE search_vector IS NULL` in UPDATE statements:
- Safe to re-run if interrupted
- Only processes unindexed rows
- Faster on subsequent runs

### Step 4: Apply Search Functions Migration

**After index creation**, apply the search functions migration to make the feature usable:

```bash
# Migration 075: Create search functions (REQUIRED FOR FRONTEND)
cat supabase/migrations/075_create_search_functions.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# Migration 076: Cleanup search vector audit noise (OPTIONAL)
cat supabase/migrations/076_cleanup_search_vector_audit_noise.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

**Why this order**:
- Migration 075 defines the RPC functions (`search_samples`, `global_search`, etc.)
- Without 075, the frontend cannot call search functionality
- Migration 076 is optional cleanup

### Step 5: Monitor Index Creation Progress

Index creation with `CONCURRENTLY` can take time. Monitor progress:

```sql
-- Check index creation status
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexname LIKE '%_search_idx'
ORDER BY tablename;

-- Expected output: 5 indexes
-- samples_search_idx
-- clients_search_idx
-- assay_definitions_search_idx
-- results_search_idx
-- audit_logs_search_idx

-- Check if indexes are valid (all should be 't')
SELECT
    schemaname,
    tablename,
    indexname,
    pg_index.indisvalid as is_valid
FROM pg_indexes
JOIN pg_class ON pg_indexes.indexname = pg_class.relname
JOIN pg_index ON pg_class.oid = pg_index.indexrelid
WHERE indexname LIKE '%_search_idx'
ORDER BY tablename;
```

### Step 6: Verify Deployment

Run verification tests to ensure everything is working:

```sql
-- 1. Verify unaccent extension
SELECT * FROM pg_extension WHERE extname = 'unaccent';
SELECT unaccent('Huyết thanh');  -- Should return "Huyet thanh"

-- 2. Verify search_vector columns exist
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE column_name = 'search_vector'
ORDER BY table_name;
-- Expected: 5 tables (samples, clients, assay_definitions, results, audit_logs)

-- 3. Verify GIN indexes created
SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE '%_search_idx';
-- Expected: 5

-- 4. Verify triggers exist
SELECT
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%_search_update'
ORDER BY event_object_table;
-- Expected: 5 triggers

-- 5. Test search functionality
SELECT * FROM search_samples('máu', 10);
SELECT * FROM global_search('test', 20);

-- 6. Run security tests
SELECT * FROM run_security_tests();
-- All tests should pass
```

### Step 7: Performance Monitoring

Monitor search performance after deployment:

```sql
-- Enable query timing
\timing on

-- Test query performance (should be < 50ms)
SELECT COUNT(*) FROM search_samples('máu', 100);
SELECT COUNT(*) FROM global_search('test', 100);

-- Check index sizes
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE indexname LIKE '%_search_idx'
ORDER BY pg_relation_size(indexname::regclass) DESC;
```

## Rollback Procedure

If issues occur, you can roll back:

### Option 1: Restore from Backup (Recommended)

```bash
# Stop application to prevent writes
docker compose down

# Restore database from backup
docker exec -i lims-postgres pg_restore -U postgres -d postgres -c /tmp/backup_before_search.dump

# Restart application
docker compose up -d
```

### Option 2: Manual Rollback

```sql
-- Drop indexes (fast, no downtime)
DROP INDEX CONCURRENTLY IF EXISTS samples_search_idx;
DROP INDEX CONCURRENTLY IF EXISTS clients_search_idx;
DROP INDEX CONCURRENTLY IF EXISTS assay_definitions_search_idx;
DROP INDEX CONCURRENTLY IF EXISTS results_search_idx;
DROP INDEX CONCURRENTLY IF EXISTS audit_logs_search_idx;

-- Drop triggers
DROP TRIGGER IF EXISTS samples_search_update ON samples;
DROP TRIGGER IF EXISTS clients_search_update ON clients;
DROP TRIGGER IF EXISTS assay_definitions_search_update ON assay_definitions;
DROP TRIGGER IF EXISTS results_search_update ON results;
DROP TRIGGER IF EXISTS audit_logs_search_update ON audit_logs;

-- Drop trigger functions
DROP FUNCTION IF EXISTS update_search_vector_samples();
DROP FUNCTION IF EXISTS update_search_vector_clients();
DROP FUNCTION IF EXISTS update_search_vector_assay_definitions();
DROP FUNCTION IF EXISTS update_search_vector_results();
DROP FUNCTION IF EXISTS update_search_vector_audit_logs();

-- Drop search functions
DROP FUNCTION IF EXISTS search_samples(TEXT, INT);
DROP FUNCTION IF EXISTS search_clients(TEXT, INT);
DROP FUNCTION IF EXISTS search_assays(TEXT, INT);
DROP FUNCTION IF EXISTS search_results(TEXT, INT);
DROP FUNCTION IF EXISTS search_audit_logs(TEXT, INT);
DROP FUNCTION IF EXISTS global_search(TEXT, INT);

-- Drop search_vector columns
ALTER TABLE samples DROP COLUMN IF EXISTS search_vector;
ALTER TABLE clients DROP COLUMN IF EXISTS search_vector;
ALTER TABLE assay_definitions DROP COLUMN IF EXISTS search_vector;
ALTER TABLE results DROP COLUMN IF EXISTS search_vector;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS search_vector;
```

## Troubleshooting

### Issue: "CREATE INDEX CONCURRENTLY cannot run inside a transaction block"

**Solution**: Ensure you're running the migration file directly, not inside a `BEGIN...COMMIT` block.

```bash
# Correct: Direct execution
cat migration.sql | psql -U postgres -d postgres

# Incorrect: Inside transaction (will fail)
psql -U postgres -d postgres -c "BEGIN; $(cat migration.sql); COMMIT;"
```

### Issue: Index creation taking too long

**Expected**: For tables with 10k+ rows, index creation may take several minutes. This is normal with `CONCURRENTLY`.

**Monitor progress**:
```sql
-- Check current activity
SELECT
    pid,
    query,
    state,
    wait_event_type,
    wait_event
FROM pg_stat_activity
WHERE query LIKE '%CREATE INDEX%';
```

### Issue: Index is invalid

**Diagnosis**:
```sql
SELECT indexname, pg_index.indisvalid
FROM pg_indexes
JOIN pg_class ON pg_indexes.indexname = pg_class.relname
JOIN pg_index ON pg_class.oid = pg_index.indexrelid
WHERE indexname LIKE '%_search_idx';
```

**Solution**: Drop and recreate the invalid index
```sql
DROP INDEX CONCURRENTLY invalid_index_name;
-- Then re-run the migration
```

## Managed PostgreSQL Providers

### Railway

```bash
# Get database connection string from Railway dashboard
# Then apply migrations:
cat supabase/migrations/production/069_add_search_to_samples.sql | psql $DATABASE_URL
```

### Render

```bash
# Use Render's internal connection string
cat supabase/migrations/production/069_add_search_to_samples.sql | psql $DATABASE_INTERNAL_URL
```

### Supabase Cloud

**Note**: If using Supabase Cloud (not self-hosted), use the Supabase CLI:

```bash
# Apply production migrations
supabase db push --include-migrations supabase/migrations/production/
```

## Best Practices

1. **Always create backups** before applying migrations
2. **Test on staging first** before production
3. **Monitor performance** after deployment
4. **Use maintenance window** for large deployments (millions of rows)
5. **Keep development and production migrations in sync** - document which version was used where

## Summary

- ✅ Production migrations created in `supabase/migrations/production/`
- ✅ Use `CREATE INDEX CONCURRENTLY` for zero downtime
- ✅ Apply migrations separately (cannot use transactions)
- ✅ Monitor index creation progress
- ✅ Verify deployment with test queries
- ✅ Keep backups before major migrations

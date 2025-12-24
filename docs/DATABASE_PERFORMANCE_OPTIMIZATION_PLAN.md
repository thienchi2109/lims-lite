# Database Performance Optimization Plan
## CDC-LIMS Performance Analysis and Recommendations

**Date:** 2025-12-20 (Updated: 2025-12-24)
**Analysis Tool:** Supabase Performance Optimizer (via Claude Code)
**Target:** Sub-500ms query response times for all RPC functions
**Compliance:** Maintain 21 CFR Part 11 audit trail integrity

---

## Executive Summary

This document provides a comprehensive performance optimization plan for the CDC-LIMS database.

**Current State (Updated 2025-12-24):**
- ✅ Good indexing foundation (full-text search, foreign keys, timestamps)
- ✅ RLS policies optimized in migrations 048, 066
- ✅ Search infrastructure with GIN indexes for tsvector columns
- ✅ Audit trigger already optimized (skips no-ops, excludes search_vector) - migration 078
- ✅ Many composite indexes already exist (migrations 080, 081)
- ⚠️ 3 composite indexes still missing
- ⚠️ 1 partial index conversion needed

**Data Volume (2025-12-24):**
| Table | Size | Records |
|-------|------|---------|
| audit_logs | 22 MB | 5,059 |
| samples | 792 kB | 61 |
| results | 736 kB | 1,400 |
| assay_definitions | 264 kB | - |
| coa_reports | 136 kB | - |

---

## Migration Status

| Proposed | Actual Migration | Status | Notes |
|----------|------------------|--------|-------|
| 085 (6 indexes) | 095 (3 indexes) | **CREATED** | 3 already existed, only 3 needed |
| 086 (2 indexes) | 096 (1 index) | **CREATED** | 1 already partial, only 1 needed |
| 087 (audit trigger) | N/A | **DEFERRED** | Current implementation sufficient |

---

## 1. Index Analysis (Updated)

### 1.1 Existing Indexes Already Optimized ✅

**Composite indexes that ALREADY EXIST:**
```sql
-- Migration 081: These were already created
idx_samples_status_received (status, received_at) WHERE deleted_at IS NULL
idx_results_entered_by_created (entered_by, created_at) WHERE entered_by IS NOT NULL
```

### 1.2 Missing Composite Indexes → Migration 095

**File:** `supabase/migrations/095_add_missing_composite_indexes.sql`

```sql
-- 1. Analyst workload queries
CREATE INDEX idx_samples_received_by_status
ON samples(received_by, status) WHERE deleted_at IS NULL;

-- 2. Sample detail + status filter
CREATE INDEX idx_results_sample_status
ON results(sample_id, status);

-- 3. CoA statistics queries
CREATE INDEX idx_coa_reports_sample_generated
ON coa_reports(sample_id, generated_at) WHERE deleted_at IS NULL;
```

**Expected Impact:** 30-40% improvement on targeted queries

### 1.3 Partial Index Conversion → Migration 096

**File:** `supabase/migrations/096_convert_samples_status_to_partial.sql`

```sql
-- Convert full index to partial
DROP INDEX IF EXISTS idx_samples_status;
CREATE INDEX idx_samples_status ON samples(status) WHERE deleted_at IS NULL;
```

**Expected Impact:** 10-15% improvement, smaller index size

---

## 2. Audit Trigger Status ✅

**Current Implementation (Migration 078):**
- ✅ Skips no-op updates (when old_data = new_data)
- ✅ Excludes search_vector from comparison and logging
- ✅ Logs full row JSONB for INSERT/DELETE
- ✅ Logs full row JSONB for UPDATE (excluding search_vector)

**Migration 087 (Changed-fields-only logging):** **DEFERRED**

Reason: The format change is a **breaking change** that requires:
- Updating all queries that read audit_logs
- Revalidation for 21 CFR Part 11 compliance
- Migration path for existing audit data

Only implement if audit_logs exceeds 10GB or storage becomes critical.

---

## 3. RLS Policy Status ✅

**Already Optimized (Migrations 048, 066):**
- ✅ `get_user_role()` marked as `STABLE`
- ✅ `auth.uid()` wrapped in subqueries
- ✅ Manager policies split into separate INSERT/UPDATE/DELETE
- ✅ Permissive policy overlaps resolved

No further RLS optimization needed.

---

## 4. Index Usage Statistics (2025-12-24)

**Most Used Indexes:**
1. `results_pkey` - 108,653 scans
2. `samples_pkey` - 23,877 scans
3. `assay_definitions_pkey` - 770 scans
4. `idx_results_sample_id` - 545 scans
5. `idx_samples_review_started` - 335 scans

**Unused Indexes (47 total):**
- Most GIN search indexes have 0 scans (low data volume)
- Monitor in production before removing

---

## 5. Apply Migrations

### Step 1: Apply Migration 095 (Composite Indexes)

```bash
# Windows PowerShell
Get-Content supabase\migrations\095_add_missing_composite_indexes.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

### Step 2: Apply Migration 096 (Partial Index)

```bash
Get-Content supabase\migrations\096_convert_samples_status_to_partial.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

### Step 3: Verify

```bash
# Check new indexes exist
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN ('idx_samples_received_by_status', 'idx_results_sample_status', 'idx_coa_reports_sample_generated', 'idx_samples_status');"

# Run security tests
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"

# Typecheck
npm run typecheck
```

---

## 6. Production Deployment

**For production (zero-downtime):**
```sql
-- Use CONCURRENTLY to avoid table locks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_samples_received_by_status
ON samples(received_by, status) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_results_sample_status
ON results(sample_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coa_reports_sample_generated
ON coa_reports(sample_id, generated_at) WHERE deleted_at IS NULL;
```

Note: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block.

---

## 7. Success Metrics

**Target Performance:**
- All RPC functions: < 500ms
- Dashboard load: < 2 seconds
- Sample detail page: < 1 second
- Reports page: < 3 seconds

**Validation Queries:**
```sql
-- Check index usage after 24-48 hours
SELECT indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE indexrelname IN (
  'idx_samples_received_by_status',
  'idx_results_sample_status',
  'idx_coa_reports_sample_generated',
  'idx_samples_status'
);
```

---

## 8. Maintenance Schedule

**Monthly:**
- Review slow query logs
- Check index usage statistics
- VACUUM ANALYZE on large tables

**Quarterly:**
- Performance regression testing
- Review and optimize new query patterns

---

## Appendix: Diagnostic Queries

```sql
-- Check table sizes
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexrelname, idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes WHERE schemaname = 'public'
ORDER BY idx_scan DESC LIMIT 20;

-- Check unused indexes
SELECT schemaname, tablename, indexrelname
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND idx_scan = 0;
```

---

## References

- [MIGRATION_SECURITY_CHECKLIST.md](MIGRATION_SECURITY_CHECKLIST.md)
- [SQL_MIGRATION_PATTERNS.md](SQL_MIGRATION_PATTERNS.md)
- [DATABASE_SETUP.md](DATABASE_SETUP.md)

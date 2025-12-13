# Pre-existing RLS Issue: `sample_id_sequences` Table

**Status**: ⚠️ **OPEN** (Low Priority - P3)  
**Detected**: 2025-12-10 during Phase 2 migration security tests  
**Impact**: Low - Does not affect application functionality  
**Related**: Phase 2 clients migration (unrelated to the issue itself)

---

## Problem

The `sample_id_sequences` table has **Row Level Security (RLS) enabled but no policies defined**.

### Current State

```sql
-- Table has RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'sample_id_sequences';

┌────────────┬─────────────────────┬─────────────┐
│ schemaname │ tablename           │ rowsecurity │
├────────────┼─────────────────────┼─────────────┤
│ public     │ sample_id_sequences │ t           │  ← RLS enabled
└────────────┴─────────────────────┴─────────────┘

-- But has NO policies
SELECT COUNT(*) FROM pg_policies WHERE tablename = 'sample_id_sequences';
┌──────────────┐
│ policy_count │
├──────────────┤
│ 0            │  ← No policies!
└──────────────┘
```

### Table Purpose

This table stores daily sequence counters for generating unique sample IDs in the format `CDC-XN-DDMMYYYY-NNNN`:

```sql
\d sample_id_sequences

              Table "public.sample_id_sequences"
    Column     │  Type   │ Nullable │   Default    
───────────────┼─────────┼──────────┼──────────────
 date_key      │ date    │ not null │ CURRENT_DATE
 current_count │ integer │          │ 0

Indexes:
    "sample_id_sequences_pkey" PRIMARY KEY, btree (date_key)
Policies (row security enabled): (none)  ← The problem
```

---

## Impact Assessment

**Security Risk**: ⚠️ **LOW**
- This is a **system table** used by the `generate_sample_id()` function
- Does NOT contain sensitive user data (just date + counter)
- RLS blocking access could **break sample ID generation**

**Functional Risk**: ⚠️ **MEDIUM IF LEFT AS-IS**
- With RLS enabled but no policies, **no one can read/write** (except superusers)
- This could potentially break sample accessioning if not fixed
- Currently working because application uses service role credentials

**Current Workaround**: Application uses **service role** which bypasses RLS

---

## Why This Happened

The table was likely created with RLS enabled by default (project-wide setting), but policies were never added because:
1. It's a system/utility table, not user data
2. It needs unrestricted access for ID generation
3. RLS policies don't make sense for this use case

---

## Recommended Fix

**Option 1: Disable RLS** (RECOMMENDED) ✅

This table doesn't need RLS since it's not user-specific data:

```sql
-- Migration: 042_fix_sample_id_sequences_rls.sql
ALTER TABLE public.sample_id_sequences DISABLE ROW LEVEL SECURITY;
```

**Rationale**:
- No sensitive data (just dates and counters)
- Needs unrestricted access for all authenticated users
- Simpler than maintaining policies
- Aligns with PostgreSQL best practices for sequence/counter tables

---

**Option 2: Add Permissive Policies** (Alternative)

If you prefer to keep RLS enabled:

```sql
-- Migration: 042_add_sample_id_sequences_policies.sql
CREATE POLICY "Allow all authenticated users to read"
  ON public.sample_id_sequences FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated users to insert"
  ON public.sample_id_sequences FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated users to update"
  ON public.sample_id_sequences FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
```

**Note**: This is more complex and offers no real security benefit since all users need full access anyway.

---

## Detection Method

Security test query:

```sql
-- Find all tables with RLS enabled but no policies
SELECT t.schemaname, t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = t.schemaname
      AND p.tablename = t.tablename
  );
```

This is part of the `run_security_tests()` function.

---

## Next Steps

- [ ] Create migration 042 to disable RLS on `sample_id_sequences`
- [ ] Test sample ID generation still works
- [ ] Re-run security tests to verify fix
- [ ] Update security test to exclude system tables from RLS check

**Priority**: P3 (Low) - Not blocking, but should be fixed for cleanliness  
**Effort**: 5 minutes  
**Risk**: Low (disabling RLS on non-sensitive system table)

---

## Related Files

- `supabase/migrations/038_atomic_sample_id.sql` - Migration that created this table
- `src/lib/sample-id-generator.ts` - Uses this table (if exists)
- Database function `generate_sample_id()` - Reads/writes to this table

---

## Testing After Fix

```bash
# Apply fix
Get-Content supabase\migrations\042_fix_sample_id_sequences_rls.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# Verify RLS disabled
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'sample_id_sequences';"
# Expected: rowsecurity = f

# Run security tests
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"
# Expected: All tests pass (5/5)
```

---

## Why This Wasn't Caught Earlier

This table was created in migration 038 (recent), and the security test was likely added around the same time. The issue is benign because:
1. Application uses service role (bypasses RLS)
2. Table has no sensitive data
3. Functionality works despite the warning

It's a **code quality issue**, not a security vulnerability.

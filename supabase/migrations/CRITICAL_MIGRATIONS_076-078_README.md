# Critical Security Migrations - Application Guide

## Overview
Created 3 corrective migrations to address critical security and data quality issues identified by Codex code review of the full-text search implementation.

## Migrations Created

### 076_cleanup_search_vector_audit_noise.sql
**Security Impact:** Low
**Purpose:** Removes polluted audit log entries created during search_vector backfills

**What it does:**
- Deletes audit log entries where only `search_vector` changed (no meaningful data changes)
- Identifies entries by comparing `old_values` and `new_values` after excluding `search_vector`
- Logs the number of deleted entries for transparency

**Why it's needed:**
The migrations 071-074 that added full-text search performed full-table UPDATEs to backfill `search_vector` columns. This triggered audit logs for every single row, creating massive noise in the audit trail without capturing any meaningful changes.

---

### 077_tighten_audit_logs_rls.sql
**Security Impact:** HIGH
**Purpose:** Implements scoped audit log access (fixes security vulnerability)

**What it does:**
- Drops the overly permissive `"Authenticated users can read audit logs"` policy
- Creates TWO new policies with role-based scoping:
  1. `"Managers can read all audit logs"` - Unrestricted access for managers
  2. `"Analysts can read scoped audit logs"` - Scoped access for analysts
- Analysts can ONLY see audit logs for samples/results they have legitimate access to
- Adds explanatory comments to both policies

**Why it's needed:**
- Current RLS allows ANY authenticated user to read ALL audit logs system-wide
- Full-text search on `audit_logs` makes it even easier to discover sensitive/PII data
- Violates principle of least privilege for 21 CFR Part 11 compliance
- Analysts should only see audit history for their own work, not all system operations

**Impact:**
- ✅ Analysts CAN still see activity logs in Sample detail panels (scoped access)
- ✅ Analysts CAN see audit logs for samples/results they have access to
- ❌ Analysts CANNOT search/view audit logs for other tables (users, methods, etc.)
- ❌ Analysts CANNOT perform system-wide audit log searches
- ✅ Managers retain full unrestricted access to all audit logs
- ✅ Maintains existing UI functionality (Sample Activity Feed still works)

---

### 078_improve_audit_trigger_skip_noop.sql
**Security Impact:** Low
**Purpose:** Prevents future audit log pollution from automated updates

**What it does:**
- Updates `trigger_audit_log()` function to skip logging when `old_values = new_values` (after excluding `search_vector`)
- Still logs INSERT and DELETE operations normally
- Only affects UPDATE operations with no meaningful changes

**Why it's needed:**
- Prevents future backfills or automated updates from creating audit noise
- Improves audit log signal-to-noise ratio
- Reduces database bloat and query performance impact

**How it works:**
```sql
-- In UPDATE operation:
old_data := to_jsonb(OLD) - 'search_vector';
new_data := to_jsonb(NEW) - 'search_vector';

-- Skip logging if identical
IF old_data = new_data THEN
    RETURN NEW;
END IF;
```

---

## Application Instructions

### Step 1: Review Migrations
Read each migration file to understand what it does:
```bash
cat supabase/migrations/076_cleanup_search_vector_audit_noise.sql
cat supabase/migrations/077_tighten_audit_logs_rls.sql
cat supabase/migrations/078_improve_audit_trigger_skip_noop.sql
```

### Step 2: Apply Migrations (In Order)

**IMPORTANT:** Apply these migrations in sequence. Do NOT skip any.

#### Migration 076 - Cleanup Audit Noise
```powershell
Get-Content supabase\migrations\076_cleanup_search_vector_audit_noise.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

Expected output:
```
SET
DELETE XXXXX
NOTICE:  Deleted XXXXX audit log entries with search_vector-only changes
DO
COMMENT
```

Verify cleanup:
```bash
# Check remaining audit logs
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT COUNT(*) FROM audit_logs WHERE operation = 'UPDATE';"
```

#### Migration 077 - Tighten RLS (CRITICAL)
```powershell
Get-Content supabase\migrations\077_tighten_audit_logs_rls.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

Expected output:
```
SET
DROP POLICY
CREATE POLICY
COMMENT
GRANT
```

**Verify the policy change:**
```bash
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.audit_logs'::regclass ORDER BY polname;"
```

Expected result (TWO policies):
```
              polname               | polcmd
------------------------------------+--------
 Analysts can read scoped audit logs | r
 Managers can read all audit logs    | r
(2 rows)
```

**Verify role checks in policies:**
```bash
# Check manager policy
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname, pg_get_expr(polqual, polrelid) AS using_clause FROM pg_policy WHERE polrelid = 'public.audit_logs'::regclass AND polname = 'Managers can read all audit logs';"

# Check analyst policy (should include EXISTS checks)
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname, pg_get_expr(polqual, polrelid) AS using_clause FROM pg_policy WHERE polrelid = 'public.audit_logs'::regclass AND polname = 'Analysts can read scoped audit logs';"
```

Manager policy should show: `get_user_role() = 'manager'::user_role`
Analyst policy should include: `get_user_role() = 'analyst'::user_role` AND EXISTS checks for samples/results

#### Migration 078 - Improve Trigger
```powershell
Get-Content supabase\migrations\078_improve_audit_trigger_skip_noop.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

Expected output:
```
SET
CREATE FUNCTION
COMMENT
```

Verify function update:
```bash
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT proname, prosrc FROM pg_proc WHERE proname = 'trigger_audit_log';" | head -n 20
```

Function should include the `IF old_data = new_data THEN RETURN NEW;` check.

### Step 3: Run Security Tests
After applying all migrations, run the security test suite:
```bash
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"
```

**All tests must pass** (all `t` in the passed column).

### Step 4: Application Testing

#### Test TypeScript compilation:
```bash
npm run typecheck
```

#### Start the application:
```bash
npm run dev
```

#### Test audit log access by role:

1. **Login as Analyst:**
   - Navigate to a Sample detail page
   - Click on the "Activity Logs" or "Hoạt động" tab
   - ✅ Verify you CAN see audit logs for that specific sample
   - ✅ Verify you CAN see audit logs for results associated with that sample
   - ❌ Try to query audit logs for other tables (e.g., via API):
     ```typescript
     // This should return EMPTY for analysts
     const { data } = await supabase.from('audit_logs')
       .select('*')
       .eq('table_name', 'users')
     ```

2. **Login as Manager:**
   - Navigate to any audit log viewing page (if exists)
   - ✅ Verify you CAN see ALL audit logs (all tables)
   - ✅ Verify you CAN search across all audit logs
   - Navigate to Sample detail page
   - ✅ Verify audit logs display correctly in Activity Feed

### Step 5: Verify Trigger Behavior

Test that the improved trigger works correctly:

```bash
# Connect to database
docker exec -it lims-postgres psql -U postgres -d postgres

# Set up test (as superuser)
# Update a record with only search_vector change (should NOT create audit log)
UPDATE clients SET search_vector = to_tsvector('simple', 'test') WHERE id = (SELECT id FROM clients LIMIT 1);

# Update a record with meaningful change (SHOULD create audit log)
UPDATE clients SET name = 'Updated Name' WHERE id = (SELECT id FROM clients LIMIT 1);

# Check audit logs - should only see the meaningful change
SELECT COUNT(*) FROM audit_logs WHERE table_name = 'clients' AND operation = 'UPDATE';
```

---

## Expected Impact

### Data Quality
- **Before:** Thousands of meaningless audit entries from backfills
- **After:** Clean audit trail with only meaningful changes

### Security
- **Before:** Any authenticated user can read all audit logs (including sensitive operations and PII)
- **After:** Only managers can access audit logs (principle of least privilege)

### Future-Proofing
- **Before:** Every automated search_vector update creates audit noise
- **After:** Automated updates that don't change meaningful data are silently skipped

---

## Rollback Plan

If you need to rollback these changes:

### Rollback Migration 078 (Trigger)
```sql
-- Restore original trigger from migration 070
-- (See supabase/migrations/070_update_audit_exclude_search_vector.sql)
```

### Rollback Migration 077 (RLS)
```sql
-- Restore original permissive policy
DROP POLICY IF EXISTS "Managers can read audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can read audit logs"
ON public.audit_logs FOR SELECT
USING (auth.uid() IS NOT NULL);
```

### Rollback Migration 076 (Cleanup)
No rollback needed - deleted data was noise. If absolutely necessary, re-run migrations 071-074 to regenerate (not recommended).

---

## Next Steps

After successfully applying these migrations:

1. **Update UI/UX:**
   - Remove audit log viewing features from analyst pages (if any)
   - Ensure manager pages properly display audit logs

2. **Monitor Performance:**
   - Check if the trigger improvement reduces audit table size growth
   - Monitor query performance on `audit_logs`

3. **Document the Change:**
   - Update `NOTES.md` with these security improvements
   - Add to project changelog/release notes

4. **Consider Future Enhancements:**
   - Implement audit log search UI for managers (using the new full-text search)
   - Add audit log export functionality (manager-only)
   - Create audit log retention/archival policy

---

## Security Compliance Notes

These migrations address the following compliance requirements for 21 CFR Part 11:

1. ✅ **Audit Trail Integrity:** Removes noise while preserving meaningful changes
2. ✅ **Access Control:** Restricts audit log access to authorized personnel (managers)
3. ✅ **Data Quality:** Ensures audit logs contain only meaningful operational changes
4. ✅ **Principle of Least Privilege:** Analysts no longer have unnecessary access to audit trails

---

**Created:** 2025-12-18
**Author:** Claude Code (via Codex review feedback)
**Status:** Ready for application

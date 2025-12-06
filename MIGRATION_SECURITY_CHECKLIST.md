# Database Migration Security Checklist

## Purpose
This checklist prevents security regressions and false positives when modifying RLS policies.

---

## Pre-Migration Checklist

### 1. Review Existing Policies
```bash
# List all policies on the table you're modifying
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname, polcmd FROM pg_policy WHERE tablename = 'TABLE_NAME' ORDER BY polname;"
```

- [ ] Document current policy names
- [ ] Identify which policies will be modified/removed
- [ ] Check for any orphaned policies from previous migrations

### 2. Security Analysis
- [ ] Does the new policy include role checks? (`get_user_role()`)
- [ ] Does the new policy include ownership checks? (`auth.uid()`)
- [ ] Is the policy more permissive than the previous one?
- [ ] Could this policy allow unauthorized access?

### 3. Migration File Preparation
- [ ] Use descriptive migration number (sequential)
- [ ] Include clear comments explaining the change
- [ ] Use `DROP POLICY IF EXISTS` before `CREATE POLICY`
- [ ] Use idempotent SQL (`IF NOT EXISTS`, `IF EXISTS`)

---

## Migration Template

```sql
-- Migration XXX: Description of what this does
-- Security Impact: [None / Low / Medium / High]
-- Changes: [What policies are being added/removed/modified]

SET search_path TO public;

-- Drop old policy (if replacing)
DROP POLICY IF EXISTS "old_policy_name" ON public.table_name;

-- Create new policy
CREATE POLICY "new_policy_name"
ON public.table_name FOR operation
WITH CHECK (
    -- ✅ ALWAYS include role check for INSERT/UPDATE/DELETE
    get_user_role() IN ('analyst', 'manager')
    AND other_conditions
);

-- Add comment explaining the policy
COMMENT ON POLICY "new_policy_name" ON public.table_name 
IS 'Description of what this policy allows and why';
```

---

## Post-Migration Checklist

### 1. Apply Migration
```bash
# PowerShell
Get-Content supabase\migrations\XXX_name.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# Bash/WSL
cat supabase/migrations/XXX_name.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

### 2. Verify Migration Success
```bash
# Check if migration applied without errors
docker compose logs postgres | tail -n 20

# Verify table structure (if schema changed)
docker exec lims-postgres psql -U postgres -d postgres -c "\d table_name"
```

### 3. Run Security Tests
```bash
# Run automated security verification
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"
```

**Expected Output:**
```
test_name                              | passed | message
---------------------------------------+--------+------------------------------------------
Results INSERT Policy Count            | t      | Verifies only one INSERT policy exists...
Results INSERT Role Check              | t      | Verifies INSERT policy includes role...
No Orphaned Vulnerable Policies        | t      | Verifies old vulnerable policies removed
All RLS Tables Have Policies           | t      | Verifies all tables with RLS have...
Critical Policies Have Access Control  | t      | Verifies critical policies have checks
```

- [ ] All tests passed (all `t` in passed column)
- [ ] No warnings in PostgreSQL logs

### 4. Verify Policy State
```bash
# List all policies on modified table
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname, polcmd FROM pg_policy WHERE tablename = 'TABLE_NAME' ORDER BY polname;"
```

- [ ] Old policy is removed (if applicable)
- [ ] New policy exists
- [ ] No duplicate policies
- [ ] Policy count matches expectations

### 5. Verify Policy Content
```bash
# Check policy expression includes role check
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname, pg_get_expr(polwithcheck, polrelid) FROM pg_policy WHERE tablename = 'TABLE_NAME' AND polcmd = 'a';"
```

- [ ] Policy includes `get_user_role()` check (for critical operations)
- [ ] Policy logic matches intended security model
- [ ] No overly permissive conditions

### 6. Application Testing
```bash
# Run TypeScript type checking
npm run typecheck

# Start development server
npm run dev
```

- [ ] No TypeScript errors
- [ ] Application starts successfully
- [ ] Test the affected functionality manually

### 7. Role-Based Testing
Test with different user roles:

- [ ] **As Analyst**: Can perform allowed operations
- [ ] **As Manager**: Can perform allowed operations
- [ ] **As Unauthorized User**: Cannot perform restricted operations

### 8. Documentation
- [ ] Update CLAUDE.md if migration workflow changed
- [ ] Update GEMINI.md if security patterns changed
- [ ] Add comment to migration file explaining security impact
- [ ] Document any breaking changes

---

## Common Mistakes to Avoid

### ❌ Don't: Forget to drop old policy
```sql
-- BAD: Creates duplicate policies
CREATE POLICY "new_policy" ON table_name ...
-- Old policy still exists!
```

### ✅ Do: Always drop before create
```sql
-- GOOD: Ensures only one policy exists
DROP POLICY IF EXISTS "old_policy" ON table_name;
CREATE POLICY "new_policy" ON table_name ...
```

---

### ❌ Don't: Skip role checks
```sql
-- BAD: Any authenticated user can insert
CREATE POLICY "policy_name"
WITH CHECK (
    auth.uid() IS NOT NULL  -- ❌ No role check
    AND status = 'pending'
);
```

### ✅ Do: Include role checks
```sql
-- GOOD: Only analysts and managers can insert
CREATE POLICY "policy_name"
WITH CHECK (
    get_user_role() IN ('analyst', 'manager')  -- ✅ Role check
    AND status = 'pending'
);
```

---

### ❌ Don't: Use Supabase Studio for schema changes
- Changes are not version controlled
- Cannot be reproduced in other environments
- No audit trail

### ✅ Do: Use migration files
- Version controlled
- Reproducible
- Auditable
- Testable

---

## Security Test Failures

If security tests fail, investigate immediately:

### Test: Results INSERT Policy Count
**Failure:** More than one INSERT policy exists

**Action:**
1. List all INSERT policies
2. Identify which policy should be removed
3. Create migration to drop orphaned policy
4. Re-run tests

### Test: Results INSERT Role Check
**Failure:** Policy missing `get_user_role()` check

**Action:**
1. Review policy expression
2. Determine if role check is needed
3. Create migration to add role check
4. Re-run tests

### Test: No Orphaned Vulnerable Policies
**Failure:** Old vulnerable policy still exists

**Action:**
1. Identify which migration should have removed it
2. Create migration to drop the policy
3. Re-run tests

---

## Emergency Rollback

If a migration causes security issues:

```sql
-- Rollback template
-- Migration XXX_rollback: Revert migration XXX

SET search_path TO public;

-- Drop problematic policy
DROP POLICY IF EXISTS "problematic_policy" ON public.table_name;

-- Restore previous policy
CREATE POLICY "previous_policy"
ON public.table_name FOR operation
WITH CHECK (
    -- Previous policy conditions
);
```

**Apply rollback:**
```bash
Get-Content supabase\migrations\XXX_rollback.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

---

## Automated Testing Integration

### Run tests after every migration:
```bash
# Add to your migration script
Get-Content supabase\migrations\XXX_name.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# Verify with security tests
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"

# Check for failures
if ($LASTEXITCODE -ne 0) {
    Write-Error "Security tests failed! Review migration."
    exit 1
}
```

---

## Quick Reference

**Apply migration:**
```bash
Get-Content supabase\migrations\XXX_name.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

**Run security tests:**
```bash
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"
```

**Check policies:**
```bash
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname FROM pg_policy WHERE tablename = 'TABLE_NAME';"
```

**Verify role check:**
```bash
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT pg_get_expr(polwithcheck, polrelid) FROM pg_policy WHERE tablename = 'TABLE_NAME' AND polcmd = 'a';"
```

---

**Remember:** Security is not optional. Always verify your migrations with automated tests.

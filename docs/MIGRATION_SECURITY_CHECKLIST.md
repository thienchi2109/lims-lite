# Database Migration Security Checklist

**CRITICAL:** Every migration that modifies RLS policies MUST follow this checklist.

## Quick Reference Commands

```bash
# Apply migration
Get-Content supabase\migrations\XXX_name.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# Run security tests (MANDATORY)
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"

# Check policies
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname FROM pg_policy WHERE polrelid = 'public.TABLE_NAME'::regclass;"

# Verify role check in policy
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT pg_get_expr(polwithcheck, polrelid) FROM pg_policy WHERE polrelid = 'public.TABLE_NAME'::regclass AND polcmd = 'a';"
```

## Pre-Migration (BEFORE writing SQL)

### 1. Review Existing Policies
```bash
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.TABLE_NAME'::regclass ORDER BY polname;"
```
- [ ] Document current policy names
- [ ] Identify which policies will be modified/removed
- [ ] Check for orphaned policies from previous migrations

### 2. Security Analysis
- [ ] Does the new policy include **role checks**? (`get_user_role()`)
- [ ] Does the new policy include **ownership checks**? (`auth.uid()`)
- [ ] Is the policy **more permissive** than the previous one?
- [ ] Could this policy allow **unauthorized access**?

### 3. Migration File Preparation
- [ ] Use descriptive migration number (sequential)
- [ ] Include clear comments explaining the change
- [ ] Use `DROP POLICY IF EXISTS` **before** `CREATE POLICY`
- [ ] Use idempotent SQL (`IF NOT EXISTS`, `IF EXISTS`)

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
USING (condition)  -- For SELECT
WITH CHECK (
    -- ALWAYS include role check for INSERT/UPDATE/DELETE
    get_user_role() IN ('analyst', 'manager')
    AND other_conditions
);

-- Add comment explaining the policy
COMMENT ON POLICY "new_policy_name" ON public.table_name
IS 'Description of what this policy allows and why';
```

## Post-Migration (AFTER applying SQL)

### 1. Apply Migration
```bash
Get-Content supabase\migrations\XXX_name.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

### 2. Restart PostgREST (if RPC functions changed)
```bash
docker compose restart rest
```

### 3. Run Security Tests (MANDATORY)
```bash
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"
```
- [ ] All tests passed (all `t` in passed column)
- [ ] No warnings in PostgreSQL logs

### 4. Verify Policy State
```bash
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.TABLE_NAME'::regclass ORDER BY polname;"
```
- [ ] Old policy is removed (if applicable)
- [ ] New policy exists
- [ ] No duplicate policies

### 5. Verify Policy Content
```bash
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname, pg_get_expr(polwithcheck, polrelid) FROM pg_policy WHERE polrelid = 'public.TABLE_NAME'::regclass AND polcmd = 'a';"
```
- [ ] Policy includes `get_user_role()` check
- [ ] Policy logic matches intended security model

### 6. Application Testing
```bash
npm run typecheck
npm run dev
```
- [ ] No TypeScript errors
- [ ] Test affected functionality with different user roles

## Common Mistakes to Avoid

### Forget to drop old policy
```sql
-- BAD: Creates duplicate policies
CREATE POLICY "new_policy" ON table_name ...
```
```sql
-- GOOD: Ensures only one policy exists
DROP POLICY IF EXISTS "old_policy" ON table_name;
CREATE POLICY "new_policy" ON table_name ...
```

### Skip role checks
```sql
-- BAD: Any authenticated user can insert
WITH CHECK (auth.uid() IS NOT NULL AND status = 'pending');
```
```sql
-- GOOD: Only analysts and managers can insert
WITH CHECK (get_user_role() IN ('analyst', 'manager') AND status = 'pending');
```

### Use Supabase Studio for schema changes
- Changes are not version controlled
- Cannot be reproduced in other environments
- No audit trail

## Emergency Rollback

```sql
-- Migration XXX_rollback: Revert migration XXX
-- Security Impact: High - Fixes security vulnerability

SET search_path TO public;

DROP POLICY IF EXISTS "problematic_policy" ON public.table_name;

CREATE POLICY "previous_policy"
ON public.table_name FOR operation
WITH CHECK (/* Previous policy conditions */);
```

Apply rollback:
```bash
Get-Content supabase\migrations\XXX_rollback.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

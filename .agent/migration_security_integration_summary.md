# Migration Security Checklist Integration Summary

## Objective
Extract key insights from `MIGRATION_SECURITY_CHECKLIST.md` and integrate them into AI agent configuration files (`GEMINI.md`, `CLAUDE.md`, `AGENTS.md`) to ensure all AI agents follow critical security rules when creating or modifying database migrations.

## Files Updated

### 1. GEMINI.md
- **Location:** Lines 209-405 (new section added after "Security-Critical Migrations")
- **Content Added:** Full Database Migration Security Checklist
- **Key Components:**
  - Pre-Migration Checklist (Review Policies, Security Analysis, File Preparation)
  - Migration Template with Security Impact documentation
  - Post-Migration Checklist (Apply, Verify, Security Tests, Policy State/Content)
  - Common Mistakes to Avoid (with ❌/✅ examples)
  - Emergency Rollback procedures
  - Quick Reference Commands

### 2. CLAUDE.md
- **Location:** Lines 209-405 (new section added after "Security-Critical Migrations")
- **Content Added:** Full Database Migration Security Checklist (identical to GEMINI.md)
- **Purpose:** Ensures consistency across all AI agent configurations

### 3. AGENTS.md
- **Location:** Lines 29-83 (new section added after "Project Orientation")
- **Content Added:** Condensed Database Migration Security section
- **Key Components:**
  - 5 Quick Security Rules (most critical)
  - Migration Template (simplified)
  - Post-Migration Checklist (essential commands)
  - References to CLAUDE.md and MIGRATION_SECURITY_CHECKLIST.md for full details

## Key Insights Extracted and Distilled

### Critical Rules Now Embedded in AI Agent Memory:

1. **Pre-Migration Requirements**
   - Always review existing policies before modifying
   - Analyze security impact (role checks, ownership, permissiveness)
   - Use idempotent SQL (`DROP POLICY IF EXISTS` before `CREATE POLICY`)

2. **Security Impact Documentation**
   - Every migration must document: `-- Security Impact: [None / Low / Medium / High]`
   - Document what policies are being added/removed/modified

3. **Mandatory Post-Migration Verification**
   - Run `run_security_tests()` after EVERY migration affecting RLS policies
   - Verify policy state (no duplicates, old policies removed)
   - Verify policy content (includes role checks)
   - Test application with different user roles

4. **Common Critical Mistakes**
   - ❌ Forgetting to drop old policy → ✅ Always `DROP POLICY IF EXISTS` first
   - ❌ Skipping role checks → ✅ Always include `get_user_role()` checks
   - ❌ Using Supabase Studio → ✅ Use version-controlled migration files

5. **Emergency Procedures**
   - Rollback template provided for security issues
   - Quick reference commands for verification

## Benefits for AI Agents

### Before Integration:
- AI agents had general migration knowledge in GEMINI.md
- Security checklist existed but was a separate file
- No systematic enforcement of security verification steps

### After Integration:
- ✅ **Proactive Security**: AI agents now have security rules embedded in their primary configuration
- ✅ **Consistent Process**: Same checklist in GEMINI.md and CLAUDE.md ensures consistency
- ✅ **Quick Reference**: AGENTS.md provides essential rules for quick checks
- ✅ **Actionable Commands**: Copy-paste ready bash commands for verification
- ✅ **Fail-Safe Patterns**: Migration template ensures security headers are always included
- ✅ **Rollback Readiness**: Emergency procedures are now part of agent knowledge

## Verification Commands Added

All three files now include these critical commands:

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

## Migration Template Now Standard

All agents now have this template embedded:

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
    get_user_role() IN ('analyst', 'manager')  -- ✅ MANDATORY for INSERT/UPDATE/DELETE
    AND other_conditions
);

-- Document the policy
COMMENT ON POLICY "new_policy_name" ON public.table_name 
IS 'Description of what this policy allows and why';
```

## Expected Impact

1. **Reduced Security Vulnerabilities**: AI agents will systematically check for role-based access control
2. **Fewer False Positives**: Proper policy cleanup (DROP before CREATE) prevents duplicate policies
3. **Better Audit Trail**: Security Impact documentation requirement
4. **Faster Issue Resolution**: Quick reference commands reduce time to verify migrations
5. **Compliance Alignment**: Supports 21 CFR Part 11 compliance goals by enforcing audit trails

## Related Files

- **Source:** `MIGRATION_SECURITY_CHECKLIST.md` (original comprehensive checklist)
- **Updated:** `GEMINI.md`, `CLAUDE.md`, `AGENTS.md`
- **Reference Workflow:** Migration workflow already mentioned in GEMINI.md section "Database Migration Workflow"

## Next Steps for Users

When working with AI agents on database migrations:
1. AI agents will now automatically follow the security checklist
2. Expect agents to ask security-relevant questions (e.g., "What is the security impact?")
3. Agents will propose running `run_security_tests()` after migrations
4. Agents will use the standard template for all new migrations

---

**Date:** 2025-12-08  
**Author:** AI Agent (Gemini)  
**Status:** ✅ Complete

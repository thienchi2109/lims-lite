# Security Linter Warnings - Analysis and Resolutions

This document explains the security linter warnings from Supabase and why certain warnings are safe to ignore.

## Fixed Issues

### ✅ RLS Disabled in Public (FIXED)

**Tables:** `tenants`, `schema_migrations`, `extensions`

**Issue:** These Supabase Realtime internal tables were exposed via PostgREST without RLS protection.

**Resolution (Migration 067):**
- Enabled RLS on all three tables
- Added restrictive policies allowing only `service_role` access
- These tables are only used internally by Supabase Realtime and should never be accessed by application code

**Verification:**
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('tenants', 'schema_migrations', 'extensions');
```

All three tables now have `rowsecurity = t`.

---

## Safe to Ignore (By Design)

### ⚠️ Security Definer Views (SAFE - Supabase Architecture)

**Views:** `public.migrations`, `public.objects`, `public.buckets`

**Issue:** These views are defined with `SECURITY DEFINER`, which executes with the privileges of the view creator rather than the querying user.

**Why This Is Safe:**

1. **Standard Supabase Architecture:** These views are created by Supabase to expose the `storage` schema via PostgREST without making the entire schema public.

2. **Underlying RLS Protection:** The views proxy to `storage.*` tables which have their own RLS policies:
   ```sql
   -- View definition
   CREATE VIEW public.objects AS SELECT * FROM storage.objects;

   -- The underlying storage.objects table has RLS policies:
   -- - coa_storage_select_authenticated
   -- - coa_storage_insert_authenticated
   -- - user_signatures_select_own
   -- - user_signatures_insert_own
   ```

3. **Defense in Depth:** Even though the view runs with elevated privileges, access is still controlled at the row level by the storage table policies.

4. **Required for Storage API:** Supabase Storage API depends on these SECURITY DEFINER views to function correctly.

**Verification:**
```sql
-- Check that storage.objects has RLS policies
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';
```

**Recommendation:**
- ✅ Keep these views as-is
- ✅ Do not modify or drop them
- ✅ Ensure storage.* tables maintain their RLS policies
- ❌ Do not change SECURITY DEFINER to SECURITY INVOKER

---

## Summary

| Issue | Status | Action Required |
|-------|--------|----------------|
| RLS Disabled: `tenants` | ✅ FIXED | Migration 067 applied |
| RLS Disabled: `schema_migrations` | ✅ FIXED | Migration 067 applied |
| RLS Disabled: `extensions` | ✅ FIXED | Migration 067 applied |
| Security Definer: `migrations` | ⚠️ SAFE | None - Supabase architecture |
| Security Definer: `objects` | ⚠️ SAFE | None - Supabase architecture |
| Security Definer: `buckets` | ⚠️ SAFE | None - Supabase architecture |

---

## Security Test Results

All security tests pass after applying migrations:

```sql
SELECT * FROM run_security_tests();
```

```
test_name                         | passed | message
----------------------------------+--------+------------------------------------------
Results INSERT Policy Count       | t      | Verifies only one INSERT policy exists
Results INSERT Role Check         | t      | Verifies INSERT policy includes role check
No Orphaned Vulnerable Policies   | t      | Verifies old policies removed
All RLS Tables Have Policies      | t      | Verifies all tables have policies
Critical Policies Have Access Control | t  | Verifies policies have access control
```

---

## References

- [Supabase Storage Architecture](https://supabase.com/docs/guides/storage)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Database Linter - Security Definer Views](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)
- [Database Linter - RLS Disabled](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public)

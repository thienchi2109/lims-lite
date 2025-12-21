# Debugging Session: Lab Specialty Filter Chips Not Working

**Date:** 2025-12-21 14:22
**Issue:** Lab specialty filter chips return no results when clicked
**Severity:** High - Core feature completely broken
**Resolution Time:** ~45 minutes

## Symptoms

- User clicks any specialty filter chip (e.g., "BIO - Sinh hóa")
- URL updates correctly with `?specialtyIds=<uuid>`
- **No samples displayed** (0 results)
- No obvious error in browser console

## Root Cause Analysis Process

### Phase 1: Initial Investigation

1. **Verified implementation** (commit 6927c92):
   - ✅ Frontend: `LabSpecialtyChips` component correctly updates URL
   - ✅ Frontend: `samples-page-client.tsx` parses `specialtyIds` correctly
   - ✅ Backend: `fetchSamples` calls RPC function
   - ✅ Database: Migration 090 creates `get_sample_ids_by_specialty` RPC

2. **Tested RPC function directly in PostgreSQL**:
   ```sql
   SELECT * FROM get_sample_ids_by_specialty(ARRAY['4d5d8cc0-e18b-4288-96c6-9ddbcd6562f4']::UUID[]);
   -- ✅ Returns 21 sample IDs
   ```

3. **Verified function exists and has permissions**:
   ```sql
   \df get_sample_ids_by_specialty
   -- ✅ Function exists

   SELECT grantee, privilege_type FROM information_schema.routine_privileges
   WHERE routine_name = 'get_sample_ids_by_specialty';
   -- ✅ Permissions granted to authenticated role
   ```

### Phase 2: Adding Debug Logging

Added console.log statements to `src/lib/data/samples.ts` to trace execution:

```typescript
console.log('[DEBUG] Specialty filter - Raw param:', validatedParams.specialtyIds)
console.log('[DEBUG] Specialty filter - Parsed UUIDs:', specialtyIds)
console.log('[DEBUG] RPC result - error:', rpcError)
console.log('[DEBUG] RPC result - data:', matchingSamples)
```

### Phase 3: Discovery

User triggered filter and terminal logs revealed:

```
[DEBUG] Specialty filter - Raw param: e102eaa0-3855-48f6-9fc5-d1fdffc2aae9
[DEBUG] Specialty filter - Parsed UUIDs: [ 'e102eaa0-3855-48f6-9fc5-d1fdffc2aae9' ]
[DEBUG] RPC result - error: {
  code: 'PGRST202',
  details: 'Searched for the function public.get_sample_ids_by_specialty with parameter p_specialty_ids or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
  hint: 'Perhaps you meant to call the function public.get_samples_by_status',
  message: 'Could not find the function public.get_sample_ids_by_specialty(p_specialty_ids) in the schema cache'
}
```

**🎯 ROOT CAUSE:** PostgREST schema cache was stale. The RPC function exists in PostgreSQL but PostgREST didn't know about it.

## The Fix

```bash
docker compose restart rest
```

Restarting the PostgREST service (`lims-rest` container) forces it to reload the schema cache and discover the new function.

## Why This Happened

When migration 090 was applied, the PostgreSQL function was created successfully, but:
1. **PostgREST caches the database schema** for performance
2. **Adding a new function doesn't automatically invalidate the cache**
3. **The REST container needs to be restarted** after migrations that add/modify RPC functions

## Lessons Learned

### 1. PostgREST Schema Cache Behavior
- PostgREST caches database schema (tables, views, functions)
- Cache is loaded on startup and doesn't auto-refresh
- Adding RPC functions requires PostgREST restart

### 2. Migration Workflow for RPC Functions
When adding new RPC functions, the workflow should be:

```bash
# 1. Apply migration
Get-Content supabase\migrations\090_*.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# 2. Verify function exists
docker exec lims-postgres psql -U postgres -d postgres -c "\df function_name"

# 3. ⚠️ CRITICAL: Restart PostgREST to reload schema cache
docker compose restart rest

# 4. Test the feature
```

### 3. Debugging Strategy That Worked
- ✅ **Verified each layer independently**: Frontend → Backend → Database
- ✅ **Added targeted logging** at the integration point (RPC call)
- ✅ **Tested RPC directly in PostgreSQL** to isolate the issue
- ✅ **Read the error message carefully** - `PGRST202` pointed to schema cache

### 4. Error Code Reference
- **PGRST202**: Function not found in schema cache
  - Function may exist in PostgreSQL
  - PostgREST needs restart to discover it

## Prevention

To avoid this issue in the future:

### Option 1: Document in Migration Instructions
Add to `CLAUDE.md`:

```markdown
⚠️ **After applying migrations that create/modify RPC functions:**
docker compose restart rest
```

### Option 2: Add to Deployment Scripts
Include in deployment automation:

```bash
# apply_migrations.sh
for migration in supabase/migrations/*.sql; do
    cat "$migration" | docker exec -i lims-postgres psql -U postgres -d postgres
done

# Restart PostgREST to reload schema
docker compose restart rest
```

### Option 3: Use PostgREST Admin API
PostgREST supports schema cache reload via API (requires enabling admin endpoints):

```bash
curl -X POST http://localhost:3001/rpc/pgrst/reload_schema
```

## Related Files

- `src/components/lab-specialty-chips.tsx` - Filter chips UI
- `src/lib/data/samples.ts` - Backend data fetching (added debug logs)
- `supabase/migrations/090_get_samples_by_specialty.sql` - RPC function migration
- `docker-compose.yml` - Supabase services (PostgREST = `rest` service)

## Impact

- **Before fix:** Filter completely broken, returns 0 results
- **After fix:** Filter works correctly, returns expected sample counts
- **No data loss or corruption**
- **No migration rollback needed**

## Time Breakdown

- Investigation: 30 minutes
- Adding debug logging: 5 minutes
- User testing to reproduce: 5 minutes
- Fix applied: 1 minute (restart container)
- Verification: 2 minutes

**Total:** ~45 minutes

## Action Items

- [ ] Update `CLAUDE.md` with PostgREST restart requirement
- [ ] Consider removing debug logging or keeping for future debugging
- [ ] Add automated PostgREST restart to migration scripts

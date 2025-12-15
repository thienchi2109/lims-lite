# Supabase Realtime Setup - TODO

## Current Status: Infrastructure Ready, Service Not Starting

### ✅ Completed

1. **PostgreSQL Configuration**
   - Configured `wal_level=logical` for logical replication
   - Added `max_replication_slots=10` and `max_wal_senders=10`
   - Location: `docker-compose.yml` lines 11-18

2. **Database Infrastructure**
   - Created `_realtime` schema
   - Created `supabase_realtime` publication
   - Added `samples` table to publication
   - Location: `supabase/migrations/064_setup_realtime_infrastructure.sql`

3. **Kong API Gateway Configuration**
   - Added Realtime service routing: `/realtime/v1` → `http://realtime:4000/socket`
   - Enabled CORS for Realtime WebSocket connections
   - Location: `supabase/kong.yml` lines 28-36

4. **Application Code**
   - Added Realtime subscription to `useSamples` hook for automatic UI updates
   - Changed approval dialog to use `router.push(pathname)` for instant refresh
   - Locations:
     - `src/hooks/use-samples.ts` (Realtime subscription with debouncing)
     - `src/components/approval-dialog.tsx` (router.push instead of router.refresh)

### ⚠️ Issue: Realtime Service Won't Start

**Problem:** The Supabase Realtime Docker container fails to start with exit code 1.

**Error:** `APP_NAME not available` in both v2.25.50 and v2.33.66 images

**Attempted Solutions:**
- Added `APP_NAME: realtime` env var (not recognized by entrypoint script)
- Tried v2.25.50 and v2.33.66 images (both fail with same error)
- Added `RLIMIT_NOFILE`, `ERL_AFLAGS`, `DNS_NODES` (didn't resolve issue)

**Current Config:** `docker-compose.yml` lines 98-121

### 🔧 Next Steps

**Option 1: Debug Realtime Service** (Recommended for Production)
- Research official Supabase self-hosting documentation for exact Realtime configuration
- Check Supabase GitHub issues for `APP_NAME not available` error
- Consider using Supabase CLI's generated docker-compose.yml as reference
- Try older/newer Realtime image versions
- Check if additional environment variables are required

**Option 2: Use Polling as Temporary Solution**
If Realtime proves difficult, modify `src/hooks/use-samples.ts`:

```typescript
// Replace Realtime subscription with polling
return useQuery({
    queryKey: sampleKeys.list(params),
    queryFn: async () => { /* ... */ },
    enabled,
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Poll every 5 seconds
    placeholderData: (previousData) => previousData,
})
```

**Pros:** Simple, works immediately
**Cons:** 5-second delay, more server load

### 📚 References

- [Supabase Self-Hosting Guide](https://supabase.com/docs/guides/self-hosting)
- [Supabase Realtime GitHub](https://github.com/supabase/realtime)
- Migration 063 already attempted to add samples table to publication (needs Realtime running)

### 🎯 Expected Behavior (When Working)

When manager approves a sample on `/manager/approvals`:
1. Sample status changes: `'review'` → `'completed'`
2. PostgreSQL broadcasts change via logical replication
3. Realtime server receives change and broadcasts to subscribed clients
4. `useSamples` hook receives broadcast → invalidates React Query cache
5. `/samples` page refetches instantly → UI updates without manual refresh

Same instant update behavior for:
- Approving results
- Canceling approvals
- Any sample table changes

### 💡 Alternative: Try Official Supabase CLI

Consider using Supabase CLI to generate proper docker-compose.yml:

```bash
npx supabase init
npx supabase start
```

Then compare the generated `supabase/docker-compose.yml` with ours to identify missing configuration.

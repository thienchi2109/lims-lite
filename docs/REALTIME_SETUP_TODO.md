# Supabase Realtime Setup

## Current Status: Realtime Running

### ✅ Infrastructure

1. **PostgreSQL**
   - Logical replication enabled: `wal_level=logical`, `max_replication_slots=10`, `max_wal_senders=10`
   - Location: `docker-compose.yml`

2. **Database**
   - `_realtime` schema and `supabase_realtime` publication exist
   - `public.samples` is included in the publication (required for `postgres_changes`)
   - Location: `supabase/migrations/064_setup_realtime_infrastructure.sql`

3. **Kong routing**
   - `/realtime/v1` routes to `http://realtime:4000/socket`
   - Location: `supabase/kong.yml`

4. **Nginx routing**
   - Nginx proxies `/realtime/v1` (and other Supabase endpoints) to Kong
   - Location: `nginx/nginx.conf`

### ✅ Realtime service

**Fix:** `lims-realtime` requires `APP_NAME` to boot.

- Location: `docker-compose.yml` (`realtime.environment.APP_NAME`)

### ✅ App behavior

- `/samples` list uses a Realtime subscription in `src/hooks/use-samples.ts`
- Manager approvals favicon badge uses Realtime subscription in `src/components/approval-tabs-client.tsx`

## Verification

```bash
docker compose ps realtime
docker compose logs --tail 50 realtime
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT pubname FROM pg_publication WHERE pubname='supabase_realtime';"
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';"
curl -i http://localhost:8000/realtime/v1/ | head
```

Expected:
- `lims-realtime` is `Up` (not `Restarting`)
- `supabase_realtime` publication exists and includes `public.samples`
- `curl` returns a 404 from upstream `Cowboy` (means Kong routing is working)

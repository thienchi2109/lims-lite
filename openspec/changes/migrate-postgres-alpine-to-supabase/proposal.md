# Change Proposal: Migrate Postgres Alpine to Supabase Image

## Why

The current `postgres:15-alpine` image lacks the `wal2json` output plugin required for Supabase Realtime's `postgres_changes` functionality. This prevents real-time database updates from being delivered to the frontend application. The commit 9375b47 configured Realtime tenant routing correctly, but the underlying Postgres image is incompatible with Realtime's CDC (Change Data Capture) requirements.

**Current Issue:**
- Realtime service logs show: `could not access file "wal2json": No such file or directory`
- `postgres_changes` subscriptions fail silently
- Only broadcast/presence channels work (not database CDC)

**Root Cause:**
- Alpine Linux (musl libc) Postgres image does not include `wal2json` plugin
- Official `supabase/postgres` image (Debian-based with glibc) includes `wal2json` pre-installed

## What Changes

- **BREAKING** Switch Postgres base image from `postgres:15-alpine` to `supabase/postgres:15.8.1.085`
- Add data migration workflow (backup → wipe volume → restore)
- Update docker-compose.yml Postgres configuration
- Verify Realtime functionality after migration
- Document the migration process for production deployments

### Technical Details

**Image Change:**
- FROM: `postgres:15-alpine` (Alpine Linux, musl libc, ~80MB)
- TO: `supabase/postgres:15.8.1.085` (Debian, glibc, includes wal2json, ~450MB)
- PostgreSQL version: 15.8 (latest stable in 15.x series with security patches)

**Why Breaking:**
- Alpine and Debian use **incompatible binary database formats**
- Existing `postgres-data` volume cannot be reused
- Requires full database dump and restore
- **⚠️ DATA LOSS RISK** if migration not performed correctly

**Migration Steps Required:**
1. Export all data using `pg_dumpall` (while Alpine container running)
2. Stop containers and remove incompatible volume
3. Update `docker-compose.yml` image reference
4. Start containers with new image (creates fresh database)
5. Restore data from dump file
6. Verify Realtime no longer shows wal2json errors

## Impact

**Affected Infrastructure:**
- `docker-compose.yml`: Postgres service image and command configuration
- `docs/DATABASE_SETUP.md`: Updated warnings about image compatibility
- `docs/Supabase Migration Guide.md`: Reference guide (already exists)
- Docker volume `lims-lite_postgres-data`: Requires recreation

**Affected Specs:**
- None (infrastructure change, no functional behavior changes)

**Affected Code:**
- No application code changes required
- Database schema remains identical
- Supabase client configuration unchanged

**Deployment Risk:**
- **HIGH** for production (requires downtime and data migration)
- **LOW** for development (can recreate test data)
- Rollback requires restoring from backup (no simple revert)

**Dependencies:**
- Commit 9375b47 (Realtime tenant routing) must remain in place
- Migration 064 (Realtime publication setup) remains valid
- All existing migrations compatible with both images

**Benefits:**
- ✅ Enables full Realtime functionality (`postgres_changes`)
- ✅ Official Supabase-recommended image
- ✅ Better compatibility with Supabase ecosystem
- ✅ Includes other useful extensions (uuid-ossp, etc.)

**Trade-offs:**
- ❌ Larger image size (~450MB vs ~80MB)
- ❌ Debian-based (vs Alpine minimalism)
- ❌ Migration complexity for existing deployments
- ❌ Potential for data loss if migration fails

## Migration Strategy

**Development Environment:**
1. Follow "Supabase Migration Guide.md" step-by-step
2. Accept data loss if migration fails (can recreate seed data)
3. Verify with `npm run typecheck` and manual testing

**Production Environment:**
1. **MANDATORY:** Create verified backup before starting
2. Schedule maintenance window (30-60 minutes)
3. Perform migration during low-traffic period
4. Keep Alpine backup image available for emergency rollback
5. Test all critical features before resuming service

## Success Criteria

- [ ] Postgres container starts successfully with `supabase/postgres:15.1.1.78`
- [ ] All existing data restored correctly (users, samples, results, etc.)
- [ ] `npm run typecheck` passes with no errors
- [ ] Application connects to database successfully
- [ ] Realtime service starts without wal2json errors
- [ ] `docker compose logs realtime` shows no `could not access file "wal2json"` errors
- [ ] Realtime subscriptions work for database changes (test with sample updates)
- [ ] All migrations can be re-applied successfully
- [ ] Database volume size matches expectations (~previous size + image overhead)

## Open Questions

- [x] ~~Should we pin to `supabase/postgres:15.1.1.78` or use a newer version?~~
  - **RESOLVED:** Using `15.8.1.085` (current official version from Supabase master)
- [ ] Do we need to update Railway/Render deployment configs?
- [ ] Should we add automated backup verification before migration?
- [ ] Do we need to update the `uuid-ossp` extension setup documented in DATABASE_SETUP.md?

## References

- Code Review: Commit 9375b47 (identified this issue)
- Guide: `docs/Supabase Migration Guide.md` (migration procedure)
- Issue: Realtime `wal2json` requirement documented in `docs/REALTIME_SETUP_TODO.md`
- Upstream: [Supabase Realtime WAL Configuration](https://supabase.com/docs/guides/realtime/postgres-changes)

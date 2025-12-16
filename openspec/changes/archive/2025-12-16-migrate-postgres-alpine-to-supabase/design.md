# Design: Postgres Alpine to Supabase Image Migration

## Context

CDC-LIMS currently uses `postgres:15-alpine` as the database container. While this provides a minimal footprint (~80MB), it lacks the `wal2json` logical decoding plugin required for Supabase Realtime's `postgres_changes` functionality.

**Background:**
- Commit 9375b47 fixed Realtime tenant routing configuration
- Migration 064 set up the required publication (`supabase_realtime`)
- However, Realtime still fails with `could not access file "wal2json"` errors
- The Alpine Linux (musl libc) ecosystem does not include pre-built wal2json binaries
- Supabase's official recommendation is to use `supabase/postgres` (Debian-based)

**Constraints:**
- Alpine and Debian Postgres use **incompatible binary database formats**
- Cannot simply change image and reuse existing volume
- Must perform full dump/restore migration
- System is currently in development (not production yet)
- Production deployment planned for Railway/Render (containerized)

**Stakeholders:**
- Developers: Need working Realtime for development workflow
- Managers: Will use real-time sample status updates in production
- Analysts: Real-time test result updates improve UX

## Goals / Non-Goals

### Goals
1. Enable full Supabase Realtime functionality (including `postgres_changes`)
2. Migrate database without data loss
3. Maintain 21 CFR Part 11 compliance (audit logs, data integrity)
4. Update documentation for future deployments
5. Provide clear rollback procedure

### Non-Goals
1. Optimize image size (accepting larger Debian image)
2. Support in-place migration (incompatible formats)
3. Zero-downtime migration (acceptable for development)
4. Support multiple Postgres versions simultaneously
5. Custom Postgres image building (use official Supabase image)

## Decisions

### Decision 1: Use Official Supabase Postgres Image

**Choice:** `supabase/postgres:15.8.1.085` (current official version)

**Alternatives Considered:**
1. **Build custom Alpine image with wal2json**
   - ❌ Requires maintaining custom Dockerfile
   - ❌ Compilation complexity for musl libc
   - ❌ No official support from Supabase
   - ❌ Ongoing maintenance burden

2. **Use vanilla postgres:15 (Debian) and install wal2json separately**
   - ❌ Requires modifying container entrypoint
   - ❌ Version compatibility issues
   - ❌ Not reproducible across environments
   - ❌ Breaks Docker Compose simplicity

3. **Use supabase/postgres (SELECTED)**
   - ✅ Official Supabase recommendation
   - ✅ Pre-configured with all required extensions
   - ✅ Includes wal2json, uuid-ossp, pgcrypto, etc.
   - ✅ Maintained by Supabase team
   - ✅ Proven in production by Supabase users
   - ⚠️ Larger image size (~450MB vs ~80MB)

**Rationale:** Using the official image reduces complexity, ensures compatibility, and provides long-term support. The image size increase is acceptable given modern disk/bandwidth capabilities.

### Decision 2: Full Dump/Restore Migration (Not In-Place)

**Choice:** pg_dumpall → wipe volume → restore

**Alternatives Considered:**
1. **Binary upgrade tools (pg_upgrade)**
   - ❌ Does not work across musl/glibc boundary
   - ❌ Requires both old and new clusters running simultaneously
   - ❌ More complex than dump/restore

2. **Live replication with Slony/Bucardo**
   - ❌ Massive overkill for single-tenant development database
   - ❌ Introduces complex dependencies
   - ❌ Higher failure risk

3. **Dump/Restore (SELECTED)**
   - ✅ Simplest and most reliable method
   - ✅ Works across all format incompatibilities
   - ✅ Standard PostgreSQL tooling
   - ✅ Easy to verify backup integrity
   - ✅ Clear rollback path

**Rationale:** Dump/restore is the battle-tested approach for cross-format migrations. The downtime is acceptable for development environments.

### Decision 3: Pin Specific Image Version

**Choice:** Pin to `supabase/postgres:15.8.1.085` (not `:latest`)

**Alternatives Considered:**
1. **Use `:latest` tag**
   - ❌ Non-deterministic builds
   - ❌ Risk of breaking changes
   - ❌ Difficult to reproduce issues

2. **Use `:15` (major version only)**
   - ❌ Still includes minor version changes
   - ❌ Potential compatibility breaks

3. **Pin exact version (SELECTED)**
   - ✅ Reproducible builds
   - ✅ Explicit version upgrades
   - ✅ Easier debugging
   - ✅ Matches Supabase CLI defaults

**Rationale:** Infrastructure-as-code best practice. Explicit upgrades prevent surprise breakage.

### Decision 4: Preserve Existing Command Configuration

**Choice:** Keep `wal_level=logical`, `max_replication_slots=10`, etc.

**Why:** The existing configuration in docker-compose.yml is already correct for Realtime. We only need to adjust the command format to work with Supabase's config file structure:

```yaml
# Old (Alpine):
command:
  - postgres
  - -c
  - wal_level=logical
  - -c
  - max_replication_slots=10

# New (Supabase):
command:
  - postgres
  - -c
  - config_file=/etc/postgresql/postgresql.conf
  - -c
  - wal_level=logical  # Still override if needed
```

The Supabase image includes `/etc/postgresql/postgresql.conf` with sensible defaults, but we can still override specific settings.

## Architecture Changes

### Before Migration

```
┌─────────────────────────────┐
│ postgres:15-alpine          │
│ - musl libc                 │
│ - Minimal extensions        │
│ - NO wal2json               │
│ - 80MB image                │
└─────────────────────────────┘
         ↓
┌─────────────────────────────┐
│ Volume: lims-lite_postgres-data
│ Format: Alpine binary       │
└─────────────────────────────┘
```

### After Migration

```
┌─────────────────────────────┐
│ supabase/postgres:15.8.1.085│
│ - glibc (Debian)            │
│ - PostgreSQL 15.8           │
│ - Full extension suite      │
│ - wal2json included         │
│ - 450MB image               │
└─────────────────────────────┘
         ↓
┌─────────────────────────────┐
│ Volume: lims-lite_postgres-data
│ Format: Debian binary       │
│ (RECREATED)                 │
└─────────────────────────────┘
```

### Realtime Flow (After Migration)

```
┌──────────────┐
│ Sample Update│
│ in DB        │
└──────┬───────┘
       │
       ↓ WAL
┌──────────────┐
│ wal2json     │ ← NOW WORKS!
│ plugin       │
└──────┬───────┘
       │
       ↓ JSON
┌──────────────┐
│ Realtime     │
│ Service      │
└──────┬───────┘
       │
       ↓ WebSocket
┌──────────────┐
│ Frontend     │
│ (Live Update)│
└──────────────┘
```

## Risks / Trade-offs

### Risk 1: Data Loss During Migration

**Likelihood:** Medium (human error, process failure)
**Impact:** HIGH (lose all development data)

**Mitigation:**
- ✅ Create backup BEFORE stopping containers
- ✅ Verify backup file integrity (check size, grep for tables)
- ✅ Create timestamped safety backup copy
- ✅ Test restore on throwaway volume first (optional for dev)
- ✅ Document rollback procedure

### Risk 2: Image Size Increase

**Impact:** LOW (disk space, download time)

**Trade-off Analysis:**
- Alpine: 80MB image, no Realtime
- Supabase: 450MB image, full Realtime functionality
- **Decision:** Functionality > minimalism for this use case

**Mitigation:**
- Modern systems have ample disk space
- One-time download, cached by Docker
- CI/CD systems can cache layers

### Risk 3: Restore Errors

**Likelihood:** Low-Medium (role conflicts, permission issues)
**Impact:** Medium (delayed migration, manual fixes)

**Mitigation:**
- ✅ Document expected errors (role already exists)
- ✅ Use `pg_dumpall -c` (clean mode, drops before creating)
- ✅ Monitor restore output for critical vs. ignorable errors
- ✅ Verify data counts after restore

### Risk 4: Production Deployment Complexity

**Likelihood:** High (first production migration)
**Impact:** HIGH (downtime, customer impact)

**Mitigation:**
- ✅ Test migration in development first
- ✅ Document production-specific steps
- ✅ Schedule maintenance window
- ✅ Prepare rollback plan
- ✅ Verify backup restoration works BEFORE starting migration

## Migration Plan

### Phase 1: Development Environment (This Change)

1. ✅ Verify current state and create backup
2. ✅ Stop containers and wipe volume
3. ✅ Update docker-compose.yml
4. ✅ Start with new image
5. ✅ Restore data
6. ✅ Verify Realtime functionality
7. ✅ Update documentation
8. ✅ Commit changes

**Timeline:** ~30 minutes
**Acceptable Risk:** Data loss acceptable (can recreate seed data)

### Phase 2: Production Deployment (Future)

1. **Pre-Migration (1 week before)**
   - Review migration procedure
   - Test backup/restore on staging environment
   - Schedule maintenance window with stakeholders
   - Prepare rollback communications

2. **Migration Day**
   - Create verified backup
   - Announce maintenance start
   - Follow development migration procedure
   - Extended verification testing
   - Monitor for 24 hours

3. **Post-Migration**
   - Document any issues encountered
   - Update runbooks
   - Archive old backups after retention period

**Timeline:** ~60 minutes active work + 24h monitoring
**Acceptable Risk:** Minimal (full testing, rollback plan ready)

### Rollback Strategy

**If Migration Fails:**

1. Stop containers: `docker compose down`
2. Remove new volume: `docker volume rm lims-lite_postgres-data`
3. Revert `docker-compose.yml` to `postgres:15-alpine`
4. Recreate volume: `docker compose up -d` (initializes fresh)
5. Restore from backup: `Get-Content full_backup.sql | docker exec -i lims-postgres psql -U postgres`

**Recovery Time Objective (RTO):** ~15 minutes
**Recovery Point Objective (RPO):** Last backup (pre-migration)

### Data Integrity Verification

**Pre-Migration Counts:**
```sql
SELECT 'users' as table, COUNT(*) as count FROM users
UNION ALL
SELECT 'samples', COUNT(*) FROM samples
UNION ALL
SELECT 'results', COUNT(*) FROM results
UNION ALL
SELECT 'clients', COUNT(*) FROM clients
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs;
```

**Post-Migration Verification:**
- Re-run same query
- Compare counts exactly
- If mismatch → investigate before proceeding

## Open Questions

### Q1: Should we update to a newer supabase/postgres version?

**Status:** ✅ RESOLVED

**Chosen Version:** `15.8.1.085`

**Rationale:**
- Current official version in Supabase's master docker-compose.yml
- PostgreSQL 15.8 includes latest security patches (vs 15.1)
- Matches ecosystem compatibility with current Realtime v2.33.66
- Verified via: https://raw.githubusercontent.com/supabase/supabase/master/docker/docker-compose.yml

**Action:** ✅ Proposal updated to use 15.8.1.085

### Q2: Do Railway/Render configs need updating?

**Status:** Needs verification

**Files to Check:**
- `railway-docker-compose.yml`
- `docs/DEPLOYMENT_RAILWAY.md`
- `docs/DEPLOYMENT_RENDER.md`

**Action:** Review deployment docs in separate task

### Q3: Does uuid-ossp extension setup change?

**Status:** Needs testing

**Current Issue (DATABASE_SETUP.md:8-9):**
> Note: uuid-ossp extension installation via Supabase Studio may fail. Manual setup required.

**Hypothesis:** `supabase/postgres` may have uuid-ossp pre-installed, making manual setup unnecessary.

**Action:** Verify after migration and update docs if needed

## Monitoring and Validation

### Key Metrics to Monitor

**During Migration:**
- Backup file size (should be ~10-100MB for dev data)
- Restore duration (should be <5 minutes)
- Error count during restore (expect ~5 ignorable errors)

**Post-Migration:**
- Container health: `docker compose ps`
- Realtime logs: `docker compose logs realtime | grep -i error`
- Application logs: Check for database connection errors
- Realtime subscription: Manual test with sample updates

### Success Indicators

✅ All containers healthy (no restart loops)
✅ Realtime logs show NO wal2json errors
✅ Database query response time <100ms (similar to before)
✅ Data counts match pre-migration verification
✅ Application loads without errors
✅ Real-time updates work in browser

### Failure Indicators

❌ Restore errors beyond expected role conflicts
❌ Missing tables or data
❌ Realtime still shows wal2json errors
❌ Application cannot connect to database
❌ Realtime subscription fails

**If any failure indicators → ROLLBACK immediately**

## References

- [Supabase Realtime WAL Configuration](https://supabase.com/docs/guides/realtime/postgres-changes)
- [PostgreSQL pg_dumpall Documentation](https://www.postgresql.org/docs/15/app-pg-dumpall.html)
- [Docker Volume Management](https://docs.docker.com/storage/volumes/)
- Internal: `docs/Supabase Migration Guide.md` (step-by-step)
- Internal: Commit 9375b47 (Realtime tenant routing fix)
- Internal: `docs/REALTIME_SETUP_TODO.md` (verification steps)

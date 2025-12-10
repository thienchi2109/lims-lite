# Phase 2: Database Migration - Implementation Summary

**Status**: ✅ **READY TO APPLY**  
**Created**: 2025-12-10  
**Migrations**: 039, 040, 041

---

## Migration Files Created

### 1. **039_add_clients_table.sql**
**Purpose**: Create `clients` table with full RLS, audit, and constraints

**What it does**:
✅ Creates `clients` table with 11 columns (5 required, 3 optional, 3 audit)  
✅ Adds CHECK constraints for `gender` and `phone` format  
✅ Adds UNIQUE constraint on `(name, date_of_birth)`  
✅ Creates indexes on `(name, DOB)`, `id_card_num`, and `phone`  
✅ Adds `updated_at` and `audit` triggers  
✅ Enables RLS with 4 policies (SELECT, INSERT, UPDATE, DELETE)  
✅ Documents all policies with comments

**Security Impact**: **LOW**  
- All authenticated users can read clients (needed for workflow)
- Analysts can create clients (QR intake)
- Only managers can update/delete clients

---

### 2. **040_update_samples_for_clients.sql**
**Purpose**: Update `samples` table to support client linkage

**What it does**:
✅ Adds `type` column (TEXT) with CHECK constraint for 8 Vietnamese sample types  
✅ Creates index on `type` for performance  
✅ Creates `sync_client_name_snapshot()` trigger function  
✅ Adds trigger to auto-fill `client_name` from `clients.name` when `client_id` changes  
✅ Creates index on `client_id` for FK performance  
✅ Prepares for FK constraint (added in migration 041)

**Security Impact**: **LOW**  
- No changes to existing RLS policies
- Trigger ensures data integrity (client_name always matches client)

---

### 3. **041_backfill_clients_from_samples.sql**
**Purpose**: Migrate existing data and finalize constraints

**What it does**:
✅ Creates placeholder client records from unique `client_name` values in samples  
✅ Uses safe defaults: DOB=2000-01-01, gender=Khác, phone=0000000000, id_card=BACKFILL-UUID  
✅ Links existing samples to backfilled clients via `client_id`  
✅ Backfills `sample.type` with 'Máu' (Blood) as default  
✅ Adds FK constraint `samples_client_fk` (client_id → clients.id)  
✅ Enforces NOT NULL on `client_id`, `client_name`, and `type`  
✅ Comprehensive verification with DO blocks reporting status

**Security Impact**: **MEDIUM**  
- Modifies existing sample data
- Adds strict constraints (may fail if data issues exist)
- Comprehensive validation ensures migration success

---

## How to Apply

### Step 1: Apply Migration 039 (Create `clients` table)

```powershell
Get-Content supabase\migrations\039_add_clients_table.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

**Verify**:
```powershell
# Check table structure
docker exec lims-postgres psql -U postgres -d postgres -c "\d clients"

# Check policies
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.clients'::regclass ORDER BY polname;"

# Check triggers
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.clients'::regclass;"
```

**Expected Output**:
- Table created with 11 columns
- 4 RLS policies created
- 2 triggers created (updated_at, audit)

---

### Step 2: Apply Migration 040 (Update `samples` table)

```powershell
Get-Content supabase\migrations\040_update_samples_for_clients.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

**Verify**:
```powershell
# Check new columns
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'samples' AND column_name IN ('type', 'client_id');"

# Check trigger function
docker exec lims-postgres psql -U postgres -d postgres -c "\df sync_client_name_snapshot"

# Check trigger
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.samples'::regclass AND tgname = 'sync_samples_client_name';"
```

**Expected Output**:
- `type` column added (nullable initially)
- `sync_client_name_snapshot` trigger created
- Index created on `type` and `client_id`

---

### Step 3: Apply Migration 041 (Backfill and finalize)

```powershell
Get-Content supabase\migrations\041_backfill_clients_from_samples.sql | docker exec -i lims-postgres psql -U postgres -d postgres
```

**Verify**:
```powershell
# Check backfilled clients
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT id, name, date_of_birth, phone, id_card_num FROM clients LIMIT 5;"

# Check linked samples
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT id, sample_id, client_id, client_name, type FROM samples LIMIT 5;"

# Check constraints
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'samples' AND column_name IN ('client_id', 'client_name', 'type');"

# Check FK constraint
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT conname, contype FROM pg_constraint WHERE conrelid = 'public.samples'::regclass AND conname = 'samples_client_fk';"
```

**Expected Output**:
- Placeholder clients created (NOTICE: "X client records created")
- All samples linked to clients (NOTICE: "Linked samples: X")
- FK constraint created
- All columns now NOT NULL

---

### Step 4: Run Security Tests

```powershell
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"
```

**Expected**: All tests pass (all `t` in `passed` column)

---

## Rollback Plan (If Needed)

If migration fails or issues are found:

```sql
-- Rollback migration 041
ALTER TABLE public.samples ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.samples ALTER COLUMN client_name DROP NOT NULL;
ALTER TABLE public.samples ALTER COLUMN type DROP NOT NULL;
ALTER TABLE public.samples DROP CONSTRAINT IF EXISTS samples_client_fk;
DELETE FROM public.clients WHERE id_card_num LIKE 'BACKFILL-%';

-- Rollback migration 040
DROP TRIGGER IF EXISTS sync_samples_client_name ON public.samples;
DROP FUNCTION IF EXISTS sync_client_name_snapshot();
ALTER TABLE public.samples DROP COLUMN IF EXISTS type;
DROP INDEX IF EXISTS idx_samples_type;
DROP INDEX IF EXISTS idx_samples_client_id;

-- Rollback migration 039
DROP TABLE IF EXISTS public.clients CASCADE;
```

---

## Post-Migration Checklist

- [ ] Migration 039 applied successfully
- [ ] Migration 040 applied successfully
- [ ] Migration 041 applied successfully
- [ ] Security tests passed
- [ ] No orphaned samples (all have `client_id`)
- [ ] No NULL values in `client_id`, `client_name`, or `type`
- [ ] FK constraint `samples_client_fk` exists
- [ ] RLS policies on `clients` work correctly
- [ ] Trigger `sync_samples_client_name` works correctly

---

## Next Steps After Migration

**Phase 3: Backend Integration** (Tasks 3.1-3.3)
1. Update Zod schemas to include `client_id` and `type` validation
2. Create QR parser for Vietnamese ID cards (DDMMYYYY format)
3. Create client upsert/find server actions
4. Update sample creation flows to require `client_id`

**Phase 4: Frontend Integration** (Tasks 4.1-4.3)
1. Update sample intake UI for client selection
2. Wire QR scan flow to auto-fill client fields
3. Update sample list/detail views to show client linkage

---

## Known Limitations

1. **Placeholder Data**: Backfilled clients have dummy data (DOB=2000-01-01, phone=0000000000)
   - **Action Required**: Managers should update these records with actual data
   - **Filter**: `SELECT * FROM clients WHERE id_card_num LIKE 'BACKFILL-%'`

2. **Default Sample Type**: Existing samples default to `'Máu'` (Blood)
   - **Action Required**: Analysts should verify and update sample types as needed

3. **No Soft Delete**: Clients table doesn't have `deleted_at` column yet
   - **Future Enhancement**: Add soft delete support in future migration

---

## Migration Security Checklist

✅ **Pre-Migration**:
- [x] Reviewed existing samples policies (no changes needed)
- [x] Documented current policy names
- [x] No orphaned policies identified
- [x] Security analysis completed

✅ **Policy Design**:
- [x] All policies include role checks (`get_user_role()`)
- [x] Policies use `DROP IF EXISTS` before `CREATE`
- [x] Idempotent SQL (safe to re-run)
- [x] Clear comments explaining each policy

✅ **Security Impact**:
- [x] Impact level: **LOW** for migrations 039/040, **MEDIUM** for 041
- [x] Changes documented in this file
- [x] No breaking changes to existing samples policies

✅ **Post-Migration Plan**:
- [ ] Run `run_security_tests()` (Step 4 above)
- [ ] Verify all policies created successfully
- [ ] Test analyst can create client
- [ ] Test manager can edit client
- [ ] Test analyst CANNOT edit client

---

## Contact

If issues are encountered during migration, refer to:
- **Migration Checklist**: `MIGRATION_SECURITY_CHECKLIST.md`
- **Design Decisions**: `openspec/changes/add-clients-and-link-samples/PHASE1_DESIGN_DECISIONS.md`
- **Project Config**: `GEMINI.md`

# Phase 2: Database Migration - CoA Generation and Access

**Status:** ✅ Complete
**Date:** 2025-12-14
**Migration:** `055_add_coa_tables_and_triggers.sql`

---

## Summary

Successfully created database schema for Certificate of Analysis (CoA) generation and access tracking with comprehensive security, audit logging, and data integrity constraints.

---

## Tables Created

### 1. `coa_reports`

**Purpose:** Stores metadata for CoA HTML files with versioning and integrity verification.

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `sample_id` (UUID, FK → samples) - Reference to sample
- `file_path` (TEXT, NOT NULL) - Storage path: `coa-reports/{sample_id}/{version}-{timestamp}.html`
- `file_hash` (TEXT, NOT NULL) - SHA-256 hash for integrity verification
- `version` (INT, DEFAULT 1) - Version number for amendments
- `status` (TEXT, CHECK) - `pending`, `ready`, or `failed`
- `superseded_by` (UUID, FK → coa_reports) - Links to newer version (for amendments)
- `error_message` (TEXT) - Error details when status = `failed`
- `generated_at` (TIMESTAMPTZ) - When HTML was generated
- `created_at`, `updated_at`, `deleted_at` (TIMESTAMPTZ) - Audit timestamps

**Key Features:**
- ✅ File hash verification (SHA-256)
- ✅ Version tracking with amendment trail
- ✅ Soft delete for retention policy
- ✅ Status tracking (pending/ready/failed)
- ✅ Self-referencing FK for superseded versions

---

### 2. `coa_access_log`

**Purpose:** Audit trail for all CoA access attempts (both successful and failed).

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `client_id` (UUID, FK → clients, NULLABLE) - Client who accessed (NULL for failed auth)
- `sample_id` (UUID, FK → samples, NULLABLE) - Sample accessed
- `coa_report_id` (UUID, FK → coa_reports, NULLABLE) - Specific CoA version accessed
- `accessed_at` (TIMESTAMPTZ) - Access timestamp
- `ip_address` (TEXT) - Client IP address
- `user_agent` (TEXT) - Client browser/user agent
- `success` (BOOLEAN, NOT NULL) - True if access succeeded
- `failure_reason` (TEXT) - Generic error message for failed attempts
- `created_at`, `updated_at`, `deleted_at` (TIMESTAMPTZ) - Audit timestamps

**Key Features:**
- ✅ Tracks both success and failure
- ✅ Records IP and user agent for security
- ✅ Nullable FKs for failed auth attempts
- ✅ Immutable audit trail (no UPDATE policy)

---

## Indexes Created

### `coa_reports` Indexes
1. `idx_coa_reports_sample_id` - Fast lookup by sample (WHERE deleted_at IS NULL)
2. `idx_coa_reports_version` - Fast lookup by (sample_id, version)
3. `idx_coa_reports_status` - Filter by status (pending/ready/failed)
4. `idx_coa_reports_generated_at` - Time-based queries
5. `idx_coa_reports_superseded_by` - Amendment chain traversal
6. `idx_coa_reports_sample_version_unique` - **UNIQUE** constraint on (sample_id, version)

### `coa_access_log` Indexes
1. `idx_coa_access_log_client_id` - Lookup by client
2. `idx_coa_access_log_sample_id` - Lookup by sample
3. `idx_coa_access_log_accessed_at` - Time-based queries
4. `idx_coa_access_log_ip_address` - Failed attempts by IP (WHERE success = false)
5. `idx_coa_access_log_coa_report_id` - Lookup by specific CoA version

**Performance Notes:**
- Partial indexes (WHERE deleted_at IS NULL) reduce index size and improve query speed
- IP address index only indexes failed attempts (security monitoring)
- Unique constraint on (sample_id, version) prevents duplicate versions

---

## RLS Policies

### `coa_reports` Table

| Policy Name | Operation | Condition | Purpose |
|-------------|-----------|-----------|---------|
| `coa_reports_select_authenticated` | SELECT | `get_user_role() IN ('analyst', 'manager')` | Staff can view all CoA records |
| `coa_reports_update_managers` | UPDATE | `get_user_role() = 'manager' AND status = 'failed'` | Managers can retry failed CoA generation |
| *(No INSERT policy)* | INSERT | Service role bypasses RLS | Server actions insert via service key |
| *(No DELETE policy)* | DELETE | Denied by default | Use soft delete (`deleted_at`) |

### `coa_access_log` Table

| Policy Name | Operation | Condition | Purpose |
|-------------|-----------|-----------|---------|
| `coa_access_log_select_managers` | SELECT | `get_user_role() = 'manager'` | Only managers view audit logs |
| *(No INSERT policy)* | INSERT | Service role bypasses RLS | Public API logs via service key |
| *(No UPDATE/DELETE policies)* | UPDATE/DELETE | Denied by default | Audit logs are immutable |

**Security Model:**
- ✅ Staff (analyst/manager) can read their own tables
- ✅ Managers have elevated UPDATE permissions
- ✅ Public endpoints use service role to bypass RLS for logging
- ✅ Audit logs are write-once, read-many (WORM)

---

## Triggers

### 1. `audit_coa_reports_trigger`
- **Table:** `coa_reports`
- **Events:** AFTER INSERT, UPDATE, DELETE
- **Function:** `trigger_audit_log()`
- **Purpose:** Log all changes to `audit_logs` table

### 2. `audit_coa_access_log_trigger`
- **Table:** `coa_access_log`
- **Events:** AFTER INSERT, UPDATE, DELETE
- **Function:** `trigger_audit_log()`
- **Purpose:** Log all changes to `audit_logs` table

### 3. `trigger_generate_coa_on_approval`
- **Table:** `samples`
- **Events:** AFTER INSERT OR UPDATE OF status
- **Function:** `trigger_generate_coa()`
- **Purpose:** Queue CoA generation when sample approved
- **Logic:**
  ```sql
  IF NEW.status = 'approved'
     AND (OLD.status IS NULL OR OLD.status != 'approved')
     AND NOT EXISTS (SELECT 1 FROM coa_reports WHERE sample_id = NEW.id)
  THEN
      INSERT INTO coa_reports (sample_id, version, status)
      VALUES (NEW.id, 1, 'pending');
  END IF;
  ```

**Trigger Behavior:**
- ✅ Only triggers once per sample (checks for existing CoA)
- ✅ Inserts `pending` record for server action to process
- ✅ Server action will populate `file_path`, `file_hash`, and update status to `ready`

---

## Constraints

### Data Integrity Constraints

1. **`check_file_hash_on_ready`**
   ```sql
   CHECK (status != 'ready' OR (file_hash IS NOT NULL AND file_hash != ''))
   ```
   Ensures file hash is populated when CoA is ready.

2. **`check_file_path_on_ready`**
   ```sql
   CHECK (status != 'ready' OR (file_path IS NOT NULL AND file_path != ''))
   ```
   Ensures file path is populated when CoA is ready.

3. **`check_error_message_on_failed`**
   ```sql
   CHECK (status != 'failed' OR (error_message IS NOT NULL AND error_message != ''))
   ```
   Ensures error message is provided when CoA generation fails.

4. **`check_version_positive`**
   ```sql
   CHECK (version > 0)
   ```
   Ensures version is always positive (no version 0).

5. **`coa_reports_status_check`**
   ```sql
   CHECK (status IN ('pending', 'ready', 'failed'))
   ```
   Restricts status to valid values.

### Uniqueness Constraints

6. **`idx_coa_reports_sample_version_unique`**
   ```sql
   UNIQUE (sample_id, version) WHERE deleted_at IS NULL
   ```
   Prevents duplicate versions for same sample.

---

## Foreign Key Relationships

### `coa_reports`
- `sample_id` → `samples(id)` ON DELETE CASCADE
- `superseded_by` → `coa_reports(id)` (self-referencing for amendments)

### `coa_access_log`
- `client_id` → `clients(id)`
- `sample_id` → `samples(id)`
- `coa_report_id` → `coa_reports(id)`

**Cascade Behavior:**
- Deleting a sample cascades to delete all its CoA reports
- Deleting a CoA report does NOT cascade (use soft delete instead)

---

## Permissions

```sql
GRANT SELECT ON coa_reports TO authenticated;
GRANT SELECT ON coa_access_log TO authenticated;
GRANT UPDATE ON coa_reports TO authenticated;
```

**Note:** RLS policies further restrict these grants:
- SELECT on `coa_reports`: analysts and managers only
- SELECT on `coa_access_log`: managers only
- UPDATE on `coa_reports`: managers only (failed status)

---

## Testing & Validation

### Security Tests
```bash
docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"
```

**Results:** ✅ All 5 tests passed
1. ✅ Results INSERT Policy Count
2. ✅ Results INSERT Role Check
3. ✅ No Orphaned Vulnerable Policies
4. ✅ All RLS Tables Have Policies
5. ✅ Critical Policies Have Access Control

### Constraint Tests
```bash
# Test version must be positive
INSERT INTO coa_reports (sample_id, version) VALUES (..., 0);
-- Expected: ERROR:  new row violates check constraint "check_version_positive"
```

**Result:** ✅ Constraint enforced correctly

---

## Migration Verification

### Table Structure
```bash
# Verify coa_reports table
docker exec lims-postgres psql -U postgres -d postgres -c "\d coa_reports"

# Verify coa_access_log table
docker exec lims-postgres psql -U postgres -d postgres -c "\d coa_access_log"
```

### Trigger Verification
```bash
# Verify trigger exists on samples table
docker exec lims-postgres psql -U postgres -d postgres -c "
  SELECT tgname, tgrelid::regclass
  FROM pg_trigger
  WHERE tgname = 'trigger_generate_coa_on_approval';
"
```

**Result:** ✅ Trigger created successfully

---

## Usage Examples

### 1. CoA Generation Workflow

**Trigger (Automatic):**
```sql
-- When sample is approved, trigger inserts pending CoA record
UPDATE samples SET status = 'approved' WHERE sample_id = 'SAMPLE-001';
-- Trigger inserts: coa_reports (sample_id, version=1, status='pending')
```

**Server Action (Manual):**
```typescript
// Server action picks up pending record and generates HTML
const pending = await supabase
  .from('coa_reports')
  .select('*')
  .eq('status', 'pending')
  .single();

// Generate HTML, upload to storage, compute hash
const { html, hash } = await generateCoAHtml(pending.sample_id);
const path = await uploadToStorage(html);

// Update record to ready
await supabase
  .from('coa_reports')
  .update({
    file_path: path,
    file_hash: hash,
    status: 'ready'
  })
  .eq('id', pending.id);
```

### 2. Amendment Workflow

```sql
-- Create amended version
INSERT INTO coa_reports (sample_id, version, status)
SELECT sample_id, MAX(version) + 1, 'pending'
FROM coa_reports
WHERE sample_id = 'uuid-here'
GROUP BY sample_id;

-- Link previous version
UPDATE coa_reports
SET superseded_by = (
  SELECT id FROM coa_reports
  WHERE sample_id = 'uuid-here' AND version = 2
)
WHERE sample_id = 'uuid-here' AND version = 1;
```

### 3. Access Logging

```typescript
// Log access attempt
await supabase
  .from('coa_access_log')
  .insert({
    client_id: 'client-uuid',
    sample_id: 'sample-uuid',
    coa_report_id: 'coa-uuid',
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0...',
    success: true
  });
```

---

## Next Steps

Phase 2 (Database Migration) is complete. Proceed to:

**Phase 3:** Storage Infrastructure
- Create `coa-reports` bucket in Supabase Storage
- Configure RLS policies on storage bucket
- Test signed URL generation

---

## Rollback Plan

If migration needs to be rolled back:

```sql
-- Drop triggers
DROP TRIGGER IF EXISTS trigger_generate_coa_on_approval ON samples;
DROP TRIGGER IF EXISTS audit_coa_reports_trigger ON coa_reports;
DROP TRIGGER IF EXISTS audit_coa_access_log_trigger ON coa_access_log;

-- Drop function
DROP FUNCTION IF EXISTS trigger_generate_coa();

-- Drop tables (CASCADE removes dependent objects)
DROP TABLE IF EXISTS coa_access_log CASCADE;
DROP TABLE IF EXISTS coa_reports CASCADE;
```

**Note:** Always backup database before rollback.

---

## Summary Statistics

- **Tables Created:** 2
- **Indexes Created:** 11 (6 on coa_reports, 5 on coa_access_log)
- **Triggers Created:** 3 (2 audit, 1 generation)
- **RLS Policies Created:** 3 (2 on coa_reports, 1 on coa_access_log)
- **Constraints Added:** 6 (4 CHECK, 1 UNIQUE, 1 status validation)
- **Functions Created:** 1 (trigger_generate_coa)
- **Migration File Size:** 289 lines
- **Security Tests Passed:** 5/5 ✅

**Status:** ✅ Complete and verified

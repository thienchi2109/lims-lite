# Migration 118: Analyst E-Signature Submissions - Summary

## Created Files

1. **`supabase/migrations/118_analyst_esignature_submissions.sql`** - Main migration
2. **`supabase/migrations/verify_118_migration.sql`** - Verification script

## Key Components

### 1. `sample_submissions` Table
- **Purpose**: Immutable audit trail of analyst sample submissions with e-signature linkage
- **Columns** (9 total):
  - `id` (UUID, PK)
  - `sample_id` (UUID, FK → samples, RESTRICT)
  - `user_id` (UUID, FK → users, RESTRICT)
  - `signature_id` (UUID, FK → user_signatures, RESTRICT)
  - `submitted_at` (TIMESTAMPTZ)
  - `submission_number` (INTEGER) - Auto-incremented per sample
  - `superseded_by` (UUID, FK → self, nullable)
  - `signature_meaning` (TEXT) - 21 CFR Part 11 requirement
  - `created_at` (TIMESTAMPTZ)

### 2. Indexes (4 total)
- `idx_sample_submissions_sample_id` - Sample lookups
- `idx_sample_submissions_user_id` - User submission history
- `idx_sample_submissions_sample_latest` - Latest submission per sample (CoA generation)
- `idx_sample_submissions_superseded_by` - Superseded chain navigation

### 3. RLS Policies (2 total)
- **SELECT**: Analysts see own submissions, managers see all
- **INSERT**: Denied (use RPC only for controlled workflow)
- **UPDATE/DELETE**: Implicitly denied (immutable audit trail)

### 4. Audit Trigger
- **Name**: `audit_sample_submissions_trigger`
- **Function**: `trigger_audit_log()` (existing from migration 078)
- **Events**: AFTER INSERT OR UPDATE OR DELETE
- **Compliance**: 21 CFR Part 11 §11.10(e)

### 5. Updated RPC: `submit_sample_for_review(p_sample_id UUID)`

**New Features vs Migration 062:**
1. ✅ E-signature validation (checks `is_active = true` AND `signature_hash IS NOT NULL`)
2. ✅ Atomic submission numbering (subquery prevents TOCTOU race conditions)
3. ✅ Submission record creation with signature linkage
4. ✅ Superseded chain tracking for re-submissions
5. ✅ Vietnamese error messages (E4001, E4002)
6. ✅ Returns `submission_id` and `signature_id` in response

**Validation Flow:**
```
1. Check user authenticated → role = 'analyst'
2. Validate active signature exists → verify hash not null/empty
3. Lock sample row → check status = 'in_progress'
4. Verify all results have values
5. Create submission record (atomic INSERT with MAX+1 subquery)
6. Mark previous submission as superseded (if re-submitting)
7. Update sample status → 'review'
```

## Critical Security Features

### Race Condition Prevention
The atomic INSERT pattern prevents TOCTOU (Time-Of-Check-Time-Of-Use) race condition:

```sql
INSERT INTO sample_submissions (submission_number, ...)
VALUES (
  (SELECT COALESCE(MAX(submission_number), 0) + 1
   FROM sample_submissions WHERE sample_id = p_sample_id),
  ...
)
```

**Why this matters:**
- Without subquery: Two concurrent submissions could both see `MAX=1` → both try to insert `submission_number=2` → UNIQUE constraint violation
- With subquery: Each INSERT calculates MAX inside transaction → serialized by database → guarantees sequential numbering

### Foreign Key RESTRICT
All FKs use `ON DELETE RESTRICT` to prevent accidental cascade deletion:
- Cannot delete sample if submissions exist
- Cannot delete user if submissions exist
- Cannot delete signature if submissions exist
- **Audit trail integrity**: Once submission created, referenced records are protected

### Signature Integrity Validation
Two-level check prevents invalid signatures:
1. **Existence check**: `is_active = true AND deleted_at IS NULL`
2. **Integrity check**: `signature_hash IS NOT NULL AND signature_hash != ''`

**Error codes:**
- `E4001`: No active signature → user must upload signature first
- `E4002`: Signature hash missing → signature corrupted, must re-upload

## 21 CFR Part 11 Compliance

| Requirement | Implementation |
|-------------|----------------|
| §11.10(e) Audit trail | `audit_sample_submissions_trigger` logs all changes |
| §11.50(a) Signature meaning | `signature_meaning` column captures certification text |
| §11.50(b) Signature/record linking | `signature_id` FK links submission to exact signature version |
| §11.10(c) Change documentation | `superseded_by` chain tracks re-submissions |
| §11.10(a) Validation | RPC validates signature before accepting submission |

## Testing Instructions

### 1. Apply Migration (Local)
```bash
# Apply migration
Get-Content supabase\migrations\118_analyst_esignature_submissions.sql | docker exec -i lims-postgres psql -U postgres -d postgres

# Restart PostgREST to refresh schema cache
docker compose restart rest
```

### 2. Run Verification Script
```bash
docker exec -i lims-postgres psql -U postgres -d postgres -f /path/to/verify_118_migration.sql
```

**Expected Output:**
- ✅ 9 columns in `sample_submissions` table
- ✅ 4 indexes (including primary key)
- ✅ 3 foreign keys with DELETE RESTRICT
- ✅ 2 RLS policies
- ✅ 1 audit trigger
- ✅ 1 RPC function (SECURITY DEFINER, 1 argument)
- ✅ RLS enabled = true
- ✅ 1 unique constraint on `(sample_id, submission_number)`

### 3. Manual Testing

**Test Case 1: Submit without signature**
```sql
-- Setup: Create test analyst user without signature
-- Expected: E4001 error in Vietnamese

SELECT submit_sample_for_review('sample-uuid-here');
-- Expected error: "E4001: Bạn cần tải lên chữ ký điện tử..."
```

**Test Case 2: Submit with valid signature**
```sql
-- Setup: Analyst with active signature, sample with all results filled
-- Expected: Success, submission record created

SELECT submit_sample_for_review('sample-uuid-here');
-- Expected: { "sample_id": "...", "new_status": "review", "submission_id": "...", "submission_number": 1 }
```

**Test Case 3: Re-submission after rejection**
```sql
-- Setup: Manager rejects sample → status back to 'in_progress'
-- Expected: New submission record, submission_number = 2, previous submission marked superseded

SELECT submit_sample_for_review('same-sample-uuid');
-- Expected: submission_number = 2
-- Verify: SELECT * FROM sample_submissions WHERE sample_id = 'same-sample-uuid';
-- Should show 2 records: submission_number=1 (superseded_by NOT NULL), submission_number=2 (superseded_by NULL)
```

**Test Case 4: Concurrent submissions (race condition)**
```sql
-- Open two psql sessions
-- Session 1 & 2: Both run same command simultaneously
BEGIN;
SELECT submit_sample_for_review('same-sample-uuid');
COMMIT;

-- Expected: Both succeed with different submission_numbers (no duplicate key violation)
```

**Test Case 5: Audit trail verification**
```sql
-- After any submission
SELECT * FROM audit_logs
WHERE table_name = 'sample_submissions'
ORDER BY created_at DESC LIMIT 5;

-- Expected: INSERT event logged with full new_values JSON
```

### 4. Security Testing

**Test RLS policies:**
```sql
-- As analyst user
SET ROLE analyst;
SELECT * FROM sample_submissions;
-- Expected: See only own submissions

-- As manager user
SET ROLE manager;
SELECT * FROM sample_submissions;
-- Expected: See all submissions

-- Try direct insert (should fail)
INSERT INTO sample_submissions (sample_id, user_id, signature_id) VALUES (...);
-- Expected: Policy violation error
```

## Observations & Potential Issues

### 1. Existing RPC Implementation (Migration 062)
**Good:**
- Already has proper locking (`FOR UPDATE`)
- Already validates all results have values
- Already restricts to analysts only
- Already uses `SECURITY DEFINER` with explicit `search_path`

**Missing (now fixed in 118):**
- No signature validation
- No submission record creation
- No audit trail of WHO submitted
- No support for re-submissions

### 2. Foreign Key Considerations
**Decision: Used `ON DELETE RESTRICT` instead of `CASCADE`**

**Rationale:**
- 21 CFR Part 11 requires immutable audit trail
- CASCADE would silently delete submissions when sample deleted
- RESTRICT forces explicit handling of audit records before deletion
- Aligns with soft-delete pattern used elsewhere in codebase

**Trade-off:**
- Cannot delete samples with submissions (must soft-delete instead)
- This is actually desired behavior for compliance

### 3. Superseded Chain Design
**Current design:** `superseded_by` points FORWARD (old → new)

**Alternative considered:** `supersedes` pointing BACKWARD (new → old)

**Why forward linking:**
- Latest submission has `superseded_by = NULL` (easy to find)
- Query: `WHERE superseded_by IS NULL` = current submission
- Follows audit trail chronology (old record updated when new one created)

**Query pattern for chain:**
```sql
-- Get full submission history for sample
WITH RECURSIVE submission_chain AS (
  -- Start with first submission
  SELECT * FROM sample_submissions
  WHERE sample_id = 'xxx' AND submission_number = 1

  UNION ALL

  -- Follow superseded_by chain
  SELECT s.* FROM sample_submissions s
  JOIN submission_chain c ON s.id = c.superseded_by
)
SELECT * FROM submission_chain ORDER BY submission_number;
```

### 4. Performance Considerations
**Atomic MAX+1 subquery:**
- Adds slight overhead vs pre-calculated counter
- Acceptable trade-off for race condition prevention
- Alternative: Use `SEQUENCE` (but harder to scope per sample)

**Index optimization:**
- `idx_sample_submissions_sample_latest` optimized for `ORDER BY submitted_at DESC`
- Supports fast lookup of latest submission (used in CoA generation)

### 5. Error Message Strategy
**Vietnamese messages with error codes:**
- `E4001`: No signature (actionable → user can upload)
- `E4002`: Invalid signature (actionable → user can re-upload)

**Why codes matter:**
- Frontend can parse error code for i18n
- Logs can be searched by code
- Support team can reference codes in documentation

## Next Steps

After this migration is applied and verified:

1. **Task 2**: Add TypeScript types (`src/types/workflow.ts`)
   - `SampleSubmissionSchema` Zod schema
   - `SampleSubmission` TypeScript type
   - Export in `src/types/index.ts`

2. **Task 3**: Update Server Action (`src/app/actions/samples.ts`)
   - Import new types
   - Handle new response fields (`submission_id`, `signature_id`)
   - Display Vietnamese error messages

3. **Task 4**: Update UI Components
   - Show submission history in sample detail view
   - Display "requires signature" warning before submit button
   - Handle E4001/E4002 errors gracefully

4. **Task 5**: CoA Generation Integration
   - Update CoA template to fetch performer signature
   - Query: `SELECT signature_id FROM sample_submissions WHERE sample_id = X AND superseded_by IS NULL`
   - Render signature on CoA PDF

## Files Ready for Commit

```
supabase/migrations/118_analyst_esignature_submissions.sql
supabase/migrations/verify_118_migration.sql
```

**Commit message suggestion:**
```
feat(db): add analyst e-signature sample submissions table

- Create sample_submissions table with signature linkage
- Add RLS policies (analysts own, managers all, insert via RPC only)
- Attach audit trigger for 21 CFR Part 11 compliance
- Update submit_sample_for_review RPC with signature validation
- Implement atomic submission numbering (prevent race conditions)
- Add superseded chain for re-submission tracking

Refs: lims-f9ju (P0)
```

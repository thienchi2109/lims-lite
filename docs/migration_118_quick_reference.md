# Migration 118 Quick Reference

## File Stats
- **Lines**: 371
- **SQL Objects**: 9
  - 1 TABLE (`sample_submissions`)
  - 4 INDEXES (including PK)
  - 2 POLICIES (SELECT, INSERT)
  - 1 TRIGGER (audit)
  - 1 FUNCTION (submit_sample_for_review)

## Apply Migration

### Local (Docker)
```bash
Get-Content supabase\migrations\118_analyst_esignature_submissions.sql | docker exec -i lims-postgres psql -U postgres -d postgres
docker compose restart rest
```

### VPS (SSH)
```bash
scp supabase/migrations/118_analyst_esignature_submissions.sql user@vps:/tmp/
ssh user@vps "docker exec -i lims-postgres psql -U postgres -d postgres < /tmp/118_analyst_esignature_submissions.sql"
ssh user@vps "docker compose -f /path/to/docker-compose.yml restart rest"
```

## Verify Migration
```bash
docker exec -i lims-postgres psql -U postgres -d postgres -f supabase/migrations/verify_118_migration.sql
```

## Key Query Patterns

### Get Latest Submission for Sample (CoA Generation)
```sql
SELECT
  ss.signature_id,
  ss.submitted_at,
  ss.submission_number,
  us.signature_path
FROM sample_submissions ss
JOIN user_signatures us ON ss.signature_id = us.id
WHERE ss.sample_id = 'sample-uuid-here'
  AND ss.superseded_by IS NULL
LIMIT 1;
```

### Get Submission History (with Superseded Chain)
```sql
SELECT
  submission_number,
  submitted_at,
  user_id,
  signature_id,
  CASE WHEN superseded_by IS NULL THEN 'Current' ELSE 'Superseded' END AS status
FROM sample_submissions
WHERE sample_id = 'sample-uuid-here'
ORDER BY submission_number ASC;
```

### Check Analyst Has Valid Signature (Pre-Submit)
```sql
SELECT
  id AS signature_id,
  signature_path,
  signature_hash,
  uploaded_at
FROM user_signatures
WHERE user_id = auth.uid()
  AND is_active = true
  AND deleted_at IS NULL
  AND signature_hash IS NOT NULL
  AND signature_hash != '';
```

### Get Audit Trail for Submission
```sql
SELECT
  al.operation,
  al.created_at,
  al.changed_by,
  al.new_values->>'submission_number' AS submission_number,
  al.new_values->>'signature_id' AS signature_id
FROM audit_logs al
WHERE al.table_name = 'sample_submissions'
  AND al.record_id = 'submission-uuid-here'
ORDER BY al.created_at ASC;
```

## Error Codes

| Code | Message (Vietnamese) | Resolution |
|------|----------------------|------------|
| E4001 | Bạn cần tải lên chữ ký điện tử trước khi gửi duyệt... | Upload signature in Profile page |
| E4002 | Chữ ký không hợp lệ. Vui lòng tải lên lại chữ ký mới. | Re-upload signature (hash corrupted) |

## Testing Checklist

- [ ] Migration applies without errors
- [ ] Verification script shows 9 columns, 4 indexes, 3 FKs
- [ ] Audit trigger exists and fires on INSERT
- [ ] RPC rejects submission without signature (E4001)
- [ ] RPC accepts submission with valid signature
- [ ] Re-submission increments submission_number correctly
- [ ] Previous submission marked with superseded_by
- [ ] Concurrent submissions don't create duplicate submission_number
- [ ] RLS: Analysts see own, managers see all
- [ ] RLS: Direct INSERT fails with policy violation
- [ ] Foreign keys prevent cascade deletion (RESTRICT works)

## Files Created

1. `supabase/migrations/118_analyst_esignature_submissions.sql` - Main migration (371 lines)
2. `supabase/migrations/verify_118_migration.sql` - Verification script
3. `docs/migration_118_summary.md` - Detailed documentation

## What's Next

**Immediate (Task 1):**
- Apply migration locally
- Run verification script
- Test submit workflow manually

**Follow-up Tasks:**
- Task 2: TypeScript types (`src/types/workflow.ts`)
- Task 3: Update server action (`src/app/actions/samples.ts`)
- Task 4: Update UI (submit button, error handling)
- Task 5: CoA integration (render performer signature)

**Issue Tracking:**
```bash
powershell -Command "bd update lims-f9ju --status=in_progress -c 'Migration 118 created, ready for testing'"
```

## Rollback (If Needed)

```sql
-- WARNING: Only run in development/staging, NEVER in production after data exists

-- Drop function
DROP FUNCTION IF EXISTS public.submit_sample_for_review(UUID);

-- Drop trigger
DROP TRIGGER IF EXISTS audit_sample_submissions_trigger ON sample_submissions;

-- Drop table (will fail if data exists due to RESTRICT - this is intentional)
DROP TABLE IF EXISTS public.sample_submissions;

-- Restore old RPC from migration 062
-- (Copy function definition from 062_fix_submit_sample_for_review.sql)

NOTIFY pgrst, 'reload schema';
```

**Note:** Rollback not recommended after production deployment. If issues found, create new forward migration instead.

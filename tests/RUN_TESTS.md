# How to Run Assay Management Tests

This guide explains how to execute the comprehensive test suite for the assay management functionality.

## Prerequisites

1. **Supabase Running Locally**
   ```bash
   docker compose up -d
   ```

2. **Database Migrations Applied**
   - All migrations in `supabase/migrations/` should be applied
   - Verify with: `docker compose logs db | grep migration`

3. **Test Users Created**
   - Test analyst: `test_analyst` / password
   - Test manager: `test_manager` / password

## Test Execution Methods

### Method 1: SQL Database Tests (Recommended First)

This method tests the database layer directly, independent of the application code.

#### Using Docker Compose

```bash
# Copy the test file into the container
docker compose cp tests/assay-management.test.sql db:/tmp/test.sql

# Execute the tests
docker compose exec db psql -U postgres -d postgres -f /tmp/test.sql
```

#### Using psql Directly (if Supabase exposed on port 54322)

```bash
psql -h localhost -p 54322 -U postgres -d postgres -f tests/assay-management.test.sql
```

**Expected Output:**
- Green checkmarks (✓) for passed tests
- Detailed results for each test case
- Test summary at the end
- All 14 tests should pass

### Method 2: UI Manual Testing

Test the functionality through the web interface.

#### Step 1: Start the Application

```bash
npm run dev
```

Navigate to: http://localhost:3000

#### Step 2: Login as Manager

- Username: `manager` (or your test manager username)
- Password: your password

#### Step 3: Navigate to Assays Page

Go to: http://localhost:3000/manager/assays

#### Step 4: Execute UI Test Cases

Follow the test cases in `tests/ASSAY_MANAGEMENT_TEST_PLAN.md` starting from **TC-025**.

**Key Tests:**
1. **TC-025**: Verify table displays all assays
2. **TC-026**: Create new assay through UI
3. **TC-027**: Edit existing assay
4. **TC-028**: Delete unused assay
5. **TC-029**: Try to delete assay in use (should fail)
6. **TC-030**: Test form validation

#### Step 5: Test Role-Based Access

1. Logout
2. Login as analyst
3. Try to access `/manager/assays` (should be denied or redirected)
4. Verify analysts cannot create/edit/delete assays

### Method 3: API Testing with curl

Test the server actions directly (advanced).

#### Create Assay (Manager)

```bash
# First, get your session cookie by logging in through the browser
# Then use it in curl requests

curl -X POST http://localhost:3000/api/assays/create \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Cookie: sb-access-token=YOUR_SESSION_TOKEN" \
  -d "name=Test Assay from API" \
  -d "units=mg/L" \
  -d "validation_rules={\"min\":0,\"max\":100}"
```

**Note:** Server Actions are not exposed as REST endpoints by default in Next.js. This method requires additional setup or testing through the UI.

### Method 4: Database Queries for Verification

Use these queries to verify the state after running tests:

```sql
-- Check all active assays
SELECT id, name, method_id, units, deleted_at
FROM assay_definitions
WHERE deleted_at IS NULL
ORDER BY name;

-- Check assay with method details
SELECT
    ad.id,
    ad.name as assay_name,
    m.name as method_name,
    ad.units,
    ad.validation_rules
FROM assay_definitions ad
LEFT JOIN methods m ON ad.method_id = m.id
WHERE ad.deleted_at IS NULL;

-- Check audit logs for a specific assay
SELECT
    operation,
    old_values,
    new_values,
    changed_by,
    changed_at
FROM audit_logs
WHERE table_name = 'assay_definitions'
    AND record_id = 'YOUR_ASSAY_ID'
ORDER BY changed_at DESC;

-- Check if an assay can be deleted (no results)
SELECT COUNT(*) as result_count
FROM results
WHERE assay_id = 'YOUR_ASSAY_ID';

-- List all methods (for dropdown testing)
SELECT id, name, description
FROM methods
WHERE deleted_at IS NULL
ORDER BY name;
```

## Test Data Setup

The SQL test script creates its own test data, but for UI testing, you may want consistent test data.

### Create Test Assays Manually

```sql
-- Connect to your database
docker compose exec db psql -U postgres -d postgres

-- Create test assays
INSERT INTO assay_definitions (name, method_id, units, validation_rules) VALUES
    ('Test Assay 1', NULL, 'mg/L', '{"min": 0, "max": 100}'),
    ('Test Assay 2', (SELECT id FROM methods LIMIT 1), 'CFU', '{"min": 0}'),
    ('Test Assay 3', NULL, 'pH', '{"min": 0, "max": 14}');
```

### Create a Sample with Results (for deletion prevention testing)

```sql
-- Create a sample
INSERT INTO samples (sample_id, client_name, received_by)
VALUES (
    'TEST-SAMPLE-001',
    'Test Client',
    (SELECT id FROM users WHERE role = 'manager' LIMIT 1)
);

-- Assign a result to an assay (to prevent its deletion)
INSERT INTO results (sample_id, assay_id, method_id, value)
VALUES (
    (SELECT id FROM samples WHERE sample_id = 'TEST-SAMPLE-001'),
    (SELECT id FROM assay_definitions WHERE name = 'Test Assay 1'),
    (SELECT method_id FROM assay_definitions WHERE name = 'Test Assay 1'),
    '50'
);
```

## Troubleshooting

### Test Fails: "relation does not exist"

**Problem:** Database tables not created.

**Solution:**
```bash
# Check migrations
docker compose exec db psql -U postgres -d postgres -c "\dt"

# If tables missing, rerun migrations
docker compose down -v
docker compose up -d
# Wait for migrations to apply
docker compose logs -f db | grep migration
```

### Test Fails: "permission denied"

**Problem:** RLS policies blocking access.

**Solution:**
- Ensure you're testing as a manager role user
- Check RLS policies in `supabase/migrations/003_rls_policies.sql`
- Verify user roles:
  ```sql
  SELECT id, username, role FROM users;
  ```

### UI Test: Assays page is blank

**Problem:** API call failing or RLS blocking access.

**Solution:**
1. Open browser DevTools (F12)
2. Check Console for errors
3. Check Network tab for failed requests
4. Verify you're logged in as manager:
   ```javascript
   // In browser console
   console.log(document.cookie)
   ```

### SQL Test: Connection refused

**Problem:** Supabase database not running.

**Solution:**
```bash
# Check status
docker compose ps

# Start if not running
docker compose up -d

# Check logs
docker compose logs db
```

### Test Fails: Foreign key violation

**Problem:** Referenced methods don't exist.

**Solution:**
```bash
# Ensure seed data is loaded
docker compose exec db psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/seed.sql

# Or manually create methods
docker compose exec db psql -U postgres -d postgres
INSERT INTO methods (name, description) VALUES ('Test Method', 'For testing');
```

## Test Results Documentation

After running tests, document results using this template:

```markdown
## Test Execution Report

**Date:** 2025-11-27
**Tester:** [Your Name]
**Environment:** Local Development
**Database:** PostgreSQL 16 (Supabase Docker)
**Application:** Next.js 16 on http://localhost:3000

### SQL Tests Results (Method 1)

- ✅ TEST 1: Get All Assay Definitions - PASSED
- ✅ TEST 2: Get Assay By ID - PASSED
- ✅ TEST 3: Soft-Deleted Assay Exclusion - PASSED
- ✅ TEST 4: Create Assay Definition - PASSED
- ✅ TEST 5: Create with Minimal Data - PASSED
- ✅ TEST 6: Update Assay Definition - PASSED
- ✅ TEST 7: Deletion Prevention (In Use) - PASSED
- ✅ TEST 8: Soft Delete Unused Assay - PASSED
- ✅ TEST 9: Get All Methods - PASSED
- ✅ TEST 10: Foreign Key Constraint - PASSED
- ✅ TEST 11: JSONB Validation Rules - PASSED
- ✅ TEST 12: updated_at Trigger - PASSED
- ✅ TEST 13: Audit Log Integration - PASSED
- ✅ TEST 14: Unicode Character Handling - PASSED

**SQL Tests: 14/14 PASSED (100%)**

### UI Tests Results (Method 2)

- ✅ TC-025: Table Display - PASSED
- ✅ TC-026: Create Assay Dialog - PASSED
- ✅ TC-027: Edit Assay Dialog - PASSED
- ✅ TC-028: Delete Assay - PASSED
- ✅ TC-029: Delete Prevention - PASSED
- ✅ TC-030: Form Validation - PASSED

**UI Tests: 6/6 PASSED (100%)**

### Issues Found

None

### Notes

- All tests executed successfully
- Performance is acceptable (< 200ms for queries)
- Vietnamese localization verified
- RLS policies working correctly
- Audit logging confirmed

### Sign-off

Ready for: ✅ Production Deployment

**Tester:** _________________
**Date:** 2025-11-27
```

## Continuous Testing

### Before Each Commit

Run quick smoke tests:

```bash
# 1. Check TypeScript types
npm run typecheck

# 2. Run linter
npm run lint

# 3. Quick SQL test (first 5 tests)
docker compose exec db psql -U postgres -d postgres -c "
  SELECT COUNT(*) as active_assays
  FROM assay_definitions
  WHERE deleted_at IS NULL;
"

# 4. Quick UI check
# Open http://localhost:3000/manager/assays and verify it loads
```

### Before Deployment

Run full test suite:

1. Execute all SQL tests (Method 1)
2. Execute all UI tests from test plan (Method 2)
3. Verify audit logs are created
4. Test with both analyst and manager roles
5. Check browser console for errors
6. Verify responsive design on mobile

## Performance Benchmarks

Expected performance benchmarks:

| Operation | Expected Time | Threshold |
|-----------|---------------|-----------|
| getAssayDefinitions() | < 100ms | 500ms |
| getAssayDefinitionById() | < 50ms | 200ms |
| createAssayDefinition() | < 200ms | 1000ms |
| updateAssayDefinition() | < 200ms | 1000ms |
| deleteAssayDefinition() | < 200ms | 1000ms |
| Page Load (/manager/assays) | < 1s | 3s |

### Measure Performance

```sql
-- Enable timing in psql
\timing on

-- Run a query and measure
SELECT COUNT(*) FROM assay_definitions WHERE deleted_at IS NULL;
```

## Next Steps After Testing

1. ✅ All tests passed → Ready to commit and push
2. ⚠️ Some tests failed → Review failures, fix issues, retest
3. 📝 Document any issues in GitHub Issues
4. 🚀 Deploy to staging environment
5. 🔄 Run tests again in staging
6. ✅ Staging tests passed → Deploy to production

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review test logs in `tests/ASSAY_MANAGEMENT_TEST_PLAN.md`
3. Check application logs: `docker compose logs -f`
4. Review database logs: `docker compose logs db`
5. Open DevTools in browser (F12) for UI issues

---

**Last Updated:** 2025-11-27
**Test Suite Version:** 1.0
**Compatible With:** Commit 1f834cf and later

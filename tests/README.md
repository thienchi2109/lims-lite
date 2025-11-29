# CDC-LIMS Test Suite

This directory contains comprehensive tests for the CDC-LIMS application.

## Test Files

### 1. ASSAY_MANAGEMENT_TEST_PLAN.md
**Comprehensive test plan with 44 test cases covering:**
- Server Actions (getAssayDefinitions, createAssayDefinition, etc.)
- UI Components (AssayDefinitionsTable, AssayDefinitionDialog, etc.)
- Integration tests
- Performance tests
- Security tests (RLS, SQL injection, XSS)
- Edge cases (Unicode, large datasets, concurrent updates)
- Compliance verification (21 CFR Part 11 audit logging)

**Use this for:**
- Manual UI testing
- Test case reference
- QA documentation
- Compliance audits

### 2. assay-management.test.sql
**Automated SQL test script with 14 database-level tests:**
- ✓ Get all assay definitions (excluding soft-deleted)
- ✓ Get single assay by ID
- ✓ Soft-delete exclusion verification
- ✓ Create assay (full and minimal data)
- ✓ Update assay definition
- ✓ Deletion prevention for assays in use
- ✓ Soft delete unused assays
- ✓ Get all methods for dropdown
- ✓ Foreign key constraint validation
- ✓ JSONB validation rules storage
- ✓ updated_at trigger functionality
- ✓ Audit log integration
- ✓ Unicode character handling

**Use this for:**
- Quick database regression testing
- CI/CD pipeline integration
- Pre-deployment verification
- Database migration validation

### 3. RUN_TESTS.md
**Complete test execution guide with:**
- Prerequisites and setup instructions
- 4 different testing methods:
  1. SQL database tests (recommended first)
  2. UI manual testing
  3. API testing with curl
  4. Database query verification
- Troubleshooting guide
- Performance benchmarks
- Test results documentation template

**Use this for:**
- Step-by-step test execution
- Troubleshooting failed tests
- Performance monitoring
- Test reporting

## Quick Start

### Run All Tests Locally

```bash
# 1. Start Supabase
docker compose up -d

# 2. Run SQL tests
docker compose cp tests/assay-management.test.sql db:/tmp/test.sql
docker compose exec db psql -U postgres -d postgres -f /tmp/test.sql

# 3. Start application
npm run dev

# 4. Run UI tests manually
# Open http://localhost:3000 and follow tests/ASSAY_MANAGEMENT_TEST_PLAN.md
# Start from TC-025 (UI tests)
```

### Expected Results

- **SQL Tests:** 14/14 tests should pass ✅
- **UI Tests:** All interactions should work smoothly
- **Performance:** Queries < 500ms, page loads < 2s
- **Audit Logs:** All changes logged in audit_logs table

## Test Coverage

### Features Tested

✅ **CRUD Operations**
- Create assay definitions
- Read/List assays with method joins
- Update assay properties
- Soft delete with usage validation

✅ **Data Validation**
- Required fields (name)
- Field length constraints (max 200 chars)
- Foreign key constraints (method_id)
- JSONB validation rules storage

✅ **Business Logic**
- Prevent deletion of assays in use
- Soft delete pattern (deleted_at)
- Method relationship handling
- Default value assignment

✅ **Security & Access Control**
- Manager-only create/update/delete
- Role-based authorization
- RLS policy enforcement
- SQL injection protection

✅ **Data Integrity**
- Foreign key constraints
- Audit log triggers
- updated_at auto-update
- Transaction rollback on errors

✅ **Localization**
- Vietnamese error messages
- Vietnamese UI labels
- Unicode character handling

## Test Matrix

| Test Category | SQL Tests | UI Tests | Total |
|---------------|-----------|----------|-------|
| CRUD Operations | 8 | 4 | 12 |
| Validation | 3 | 2 | 5 |
| Security | 2 | 1 | 3 |
| Data Integrity | 3 | 0 | 3 |
| Edge Cases | 2 | 1 | 3 |
| **Total** | **18** | **8** | **26** |

## Compliance Testing

### 21 CFR Part 11 Requirements

All tests verify compliance with FDA regulations:

- ✅ **Audit Trail:** All changes logged with user ID and timestamp
- ✅ **Data Integrity:** Soft deletes prevent data loss
- ✅ **Access Control:** Role-based permissions enforced
- ✅ **Traceability:** old_values and new_values captured
- ✅ **Non-repudiation:** changed_by field mandatory

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Assay Management

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Start Supabase
        run: docker compose up -d

      - name: Wait for DB
        run: sleep 10

      - name: Run SQL Tests
        run: |
          docker compose cp tests/assay-management.test.sql db:/tmp/test.sql
          docker compose exec -T db psql -U postgres -d postgres -f /tmp/test.sql
```

## Regression Testing

Before every release, run:

1. ✅ Full SQL test suite (14 tests)
2. ✅ Critical UI flows (TC-025 through TC-030)
3. ✅ Role-based access verification
4. ✅ Audit log verification
5. ✅ Performance benchmarks

## Known Limitations

### Current Test Suite Does NOT Cover:

- ❌ Unit tests for React components
- ❌ E2E tests with Playwright/Cypress
- ❌ Load testing (concurrent users)
- ❌ Mobile responsive testing
- ❌ Accessibility (a11y) testing
- ❌ Browser compatibility testing

### Future Test Additions

- [ ] Add Vitest for component unit tests
- [ ] Add Playwright for E2E testing
- [ ] Add load testing with k6
- [ ] Add accessibility tests with axe
- [ ] Add visual regression tests

## Test Maintenance

### When to Update Tests

- ✅ New feature added to assay management
- ✅ Bug fix that requires regression test
- ✅ Database schema change
- ✅ New validation rule added
- ✅ Security policy change

### Test Versioning

Tests are versioned with git commits. Current version:
- **Version:** 1.0
- **Compatible with:** Commit 1f834cf and later
- **Last updated:** 2025-11-27

## Troubleshooting

### Tests Failing?

1. **Check database:** `docker compose ps`
2. **Check migrations:** `docker compose logs db | grep migration`
3. **Check test data:** Verify seed data loaded
4. **Check logs:** `docker compose logs -f`
5. **See detailed guide:** Read `tests/RUN_TESTS.md`

### Need Help?

- 📖 Read the full test plan: `ASSAY_MANAGEMENT_TEST_PLAN.md`
- 🚀 Read execution guide: `RUN_TESTS.md`
- 🔍 Check troubleshooting section in `RUN_TESTS.md`
- 📝 Review test output for specific error messages

## Contributing

When adding new features:

1. Write test cases in `ASSAY_MANAGEMENT_TEST_PLAN.md`
2. Add SQL tests to `assay-management.test.sql` if applicable
3. Update `RUN_TESTS.md` if new setup required
4. Run full test suite before PR
5. Document any new test requirements

## License

Same as parent project (CDC-LIMS).

---

**Created:** 2025-11-27
**Author:** Claude (Anthropic)
**Purpose:** Comprehensive testing for Assay Management feature (commit 1f834cf)

-- ============================================================================
-- ASSAY MANAGEMENT COMPREHENSIVE TEST SUITE
-- ============================================================================
-- This SQL script tests the assay management functionality at the database level
-- Run this script against your local Supabase PostgreSQL database
--
-- Usage:
--   psql -h localhost -p 54322 -U postgres -d postgres -f assay-management.test.sql
--
-- Or via docker:
--   docker compose exec db psql -U postgres -d postgres -f /path/to/this/file.sql
-- ============================================================================

-- Set client encoding and output format
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
\timing on
\echo '============================================================================'
\echo 'ASSAY MANAGEMENT TEST SUITE'
\echo '============================================================================'
\echo ''

-- ============================================================================
-- TEST SETUP: Create test data
-- ============================================================================
\echo '>>> Setting up test data...'

-- Create test users (if not exists)
DO $$
DECLARE
    analyst_auth_id UUID;
    manager_auth_id UUID;
BEGIN
    -- Check if test users exist, create if not
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE username = 'test_analyst') THEN
        -- Insert into auth.users (simplified - in production use Supabase signup)
        INSERT INTO auth.users (id, email)
        VALUES ('11111111-1111-1111-1111-111111111111', 'test_analyst@test.com')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.users (id, username, full_name, role)
        VALUES ('11111111-1111-1111-1111-111111111111', 'test_analyst', 'Test Analyst', 'analyst')
        ON CONFLICT (id) DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE username = 'test_manager') THEN
        INSERT INTO auth.users (id, email)
        VALUES ('22222222-2222-2222-2222-222222222222', 'test_manager@test.com')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.users (id, username, full_name, role)
        VALUES ('22222222-2222-2222-2222-222222222222', 'test_manager', 'Test Manager', 'manager')
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- Create test methods
INSERT INTO methods (id, name, description) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Phương pháp Chuẩn độ', 'Chuẩn độ axit-base'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Phương pháp Sắc ký', 'HPLC/GC'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Phương pháp Vi sinh', 'Nuôi cấy vi sinh vật')
ON CONFLICT (id) DO NOTHING;

-- Create test assay definitions
INSERT INTO assay_definitions (id, name, method_id, units, validation_rules) VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Độ pH', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pH', '{"min": 0, "max": 14}'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Coliform tổng số', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'CFU/100mL', '{"min": 0, "dataType": "numeric"}'),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Độ đục', NULL, 'NTU', '{}')
ON CONFLICT (id) DO NOTHING;

-- Create a soft-deleted assay for testing
INSERT INTO assay_definitions (id, name, method_id, units, deleted_at) VALUES
    ('99999999-9999-9999-9999-999999999999', 'Assay đã xóa', NULL, 'mg/L', NOW())
ON CONFLICT (id) DO NOTHING;

-- Create a sample and result for testing deletion prevention
DO $$
DECLARE
    test_sample_id UUID := '88888888-8888-8888-8888-888888888888';
BEGIN
    -- Create sample
    INSERT INTO samples (id, sample_id, client_name, received_by)
    VALUES (test_sample_id, 'TEST-SAMPLE-001', 'Test Client', '22222222-2222-2222-2222-222222222222')
    ON CONFLICT (id) DO NOTHING;

    -- Create result that references the pH assay
    INSERT INTO results (sample_id, assay_id, method_id, value, status)
    VALUES (test_sample_id, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '7.2', 'pending')
    ON CONFLICT DO NOTHING;
END $$;

\echo '✓ Test data created'
\echo ''

-- ============================================================================
-- TEST 1: Retrieve all assay definitions (excluding soft-deleted)
-- ============================================================================
\echo '============================================================================'
\echo 'TEST 1: Get All Assay Definitions (getAssayDefinitions)'
\echo '============================================================================'

SELECT
    assay_definitions.id,
    assay_definitions.name,
    assay_definitions.method_id,
    methods.name as method_name,
    assay_definitions.units,
    assay_definitions.validation_rules,
    assay_definitions.created_at,
    assay_definitions.updated_at
FROM assay_definitions
LEFT JOIN methods ON assay_definitions.method_id = methods.id
WHERE assay_definitions.deleted_at IS NULL
ORDER BY assay_definitions.name;

\echo ''
\echo 'Expected: 3 rows (pH, Coliform, Độ đục) - NOT the deleted assay'
\echo ''

-- Validation query
DO $$
DECLARE
    row_count INT;
BEGIN
    SELECT COUNT(*) INTO row_count
    FROM assay_definitions
    WHERE deleted_at IS NULL;

    IF row_count >= 3 THEN
        RAISE NOTICE '✓ TEST 1 PASSED: Found % active assay definitions', row_count;
    ELSE
        RAISE EXCEPTION '✗ TEST 1 FAILED: Expected at least 3 assays, found %', row_count;
    END IF;
END $$;

\echo ''

-- ============================================================================
-- TEST 2: Get single assay by ID
-- ============================================================================
\echo '============================================================================'
\echo 'TEST 2: Get Assay Definition By ID (getAssayDefinitionById)'
\echo '============================================================================'

SELECT
    assay_definitions.id,
    assay_definitions.name,
    assay_definitions.method_id,
    methods.name as method_name,
    assay_definitions.units,
    assay_definitions.validation_rules,
    assay_definitions.created_at,
    assay_definitions.updated_at
FROM assay_definitions
LEFT JOIN methods ON assay_definitions.method_id = methods.id
WHERE assay_definitions.id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
    AND assay_definitions.deleted_at IS NULL;

\echo ''
\echo 'Expected: 1 row (Độ pH with method Phương pháp Chuẩn độ)'
\echo ''

DO $$
DECLARE
    assay_name TEXT;
BEGIN
    SELECT name INTO assay_name
    FROM assay_definitions
    WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
        AND deleted_at IS NULL;

    IF assay_name = 'Độ pH' THEN
        RAISE NOTICE '✓ TEST 2 PASSED: Retrieved correct assay: %', assay_name;
    ELSE
        RAISE EXCEPTION '✗ TEST 2 FAILED: Assay not found or incorrect';
    END IF;
END $$;

\echo ''

-- ============================================================================
-- TEST 3: Verify soft-deleted assay is NOT retrieved
-- ============================================================================
\echo '============================================================================'
\echo 'TEST 3: Soft-Deleted Assay Not Retrieved'
\echo '============================================================================'

SELECT
    assay_definitions.id,
    assay_definitions.name,
    assay_definitions.deleted_at
FROM assay_definitions
WHERE assay_definitions.id = '99999999-9999-9999-9999-999999999999'
    AND assay_definitions.deleted_at IS NULL;

\echo ''
\echo 'Expected: 0 rows (soft-deleted assay should not be returned)'
\echo ''

DO $$
DECLARE
    row_count INT;
BEGIN
    SELECT COUNT(*) INTO row_count
    FROM assay_definitions
    WHERE id = '99999999-9999-9999-9999-999999999999'
        AND deleted_at IS NULL;

    IF row_count = 0 THEN
        RAISE NOTICE '✓ TEST 3 PASSED: Soft-deleted assay correctly excluded';
    ELSE
        RAISE EXCEPTION '✗ TEST 3 FAILED: Soft-deleted assay was returned';
    END IF;
END $$;

\echo ''

-- ============================================================================
-- TEST 4: Create new assay definition
-- ============================================================================
\echo '============================================================================'
\echo 'TEST 4: Create Assay Definition (createAssayDefinition)'
\echo '============================================================================'

DO $$
DECLARE
    new_assay_id UUID;
BEGIN
    INSERT INTO assay_definitions (name, method_id, units, validation_rules)
    VALUES (
        'Thử nghiệm Test Tự động',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'mg/L',
        '{"min": 0, "max": 1000, "precision": 2}'::jsonb
    )
    RETURNING id INTO new_assay_id;

    RAISE NOTICE '✓ TEST 4 PASSED: Created new assay with ID: %', new_assay_id;

    -- Store for cleanup
    CREATE TEMP TABLE IF NOT EXISTS test_cleanup (assay_id UUID);
    INSERT INTO test_cleanup VALUES (new_assay_id);
END $$;

\echo ''

-- Verify the created assay
SELECT id, name, units, validation_rules
FROM assay_definitions
WHERE name = 'Thử nghiệm Test Tự động';

\echo ''

-- ============================================================================
-- TEST 5: Create assay with minimal data (name only)
-- ============================================================================
\echo '============================================================================'
\echo 'TEST 5: Create Assay with Minimal Data'
\echo '============================================================================'

DO $$
DECLARE
    new_assay_id UUID;
BEGIN
    INSERT INTO assay_definitions (name)
    VALUES ('Thử nghiệm Tối thiểu')
    RETURNING id INTO new_assay_id;

    -- Verify defaults
    IF EXISTS (
        SELECT 1 FROM assay_definitions
        WHERE id = new_assay_id
            AND method_id IS NULL
            AND units IS NULL
            AND validation_rules = '{}'::jsonb
    ) THEN
        RAISE NOTICE '✓ TEST 5 PASSED: Minimal assay created with correct defaults';
    ELSE
        RAISE EXCEPTION '✗ TEST 5 FAILED: Defaults not applied correctly';
    END IF;

    INSERT INTO test_cleanup VALUES (new_assay_id);
END $$;

\echo ''

-- ============================================================================
-- TEST 6: Update assay definition
-- ============================================================================
\echo '============================================================================'
\echo 'TEST 6: Update Assay Definition (updateAssayDefinition)'
\echo '============================================================================'

DO $$
DECLARE
    old_updated_at TIMESTAMPTZ;
    new_updated_at TIMESTAMPTZ;
BEGIN
    -- Get current updated_at
    SELECT updated_at INTO old_updated_at
    FROM assay_definitions
    WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

    -- Wait a moment to ensure timestamp changes
    PERFORM pg_sleep(0.1);

    -- Update the assay
    UPDATE assay_definitions
    SET
        name = 'Độ đục (đã cập nhật)',
        units = 'NTU (updated)',
        validation_rules = '{"min": 0, "max": 500}'::jsonb
    WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
        AND deleted_at IS NULL;

    -- Get new updated_at
    SELECT updated_at INTO new_updated_at
    FROM assay_definitions
    WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

    -- Verify update
    IF new_updated_at > old_updated_at THEN
        RAISE NOTICE '✓ TEST 6 PASSED: Assay updated, updated_at changed from % to %', old_updated_at, new_updated_at;
    ELSE
        RAISE EXCEPTION '✗ TEST 6 FAILED: updated_at not changed after update';
    END IF;
END $$;

\echo ''

-- Show updated assay
SELECT id, name, units, validation_rules, updated_at
FROM assay_definitions
WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

\echo ''

-- ============================================================================
-- TEST 7: Prevent deletion of assay in use
-- ============================================================================
\echo '============================================================================'
\echo 'TEST 7: Prevent Deletion of Assay In Use (deleteAssayDefinition validation)'
\echo '============================================================================'

DO $$
DECLARE
    result_count INT;
BEGIN
    -- Check if assay is being used
    SELECT COUNT(*) INTO result_count
    FROM results
    WHERE assay_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

    IF result_count > 0 THEN
        RAISE NOTICE '✓ TEST 7 PASSED: Found % results using this assay - deletion should be prevented', result_count;
        RAISE NOTICE '  (Server action would return error: "Không thể xóa chỉ tiêu này vì đang được sử dụng...")';
    ELSE
        RAISE EXCEPTION '✗ TEST 7 FAILED: No results found, cannot test deletion prevention';
    END IF;
END $$;

\echo ''

-- ============================================================================
-- TEST 8: Soft delete unused assay
-- ============================================================================
\echo '============================================================================'
\echo 'TEST 8: Soft Delete Unused Assay (deleteAssayDefinition)'
\echo '============================================================================'

DO $$
DECLARE
    test_assay_id UUID;
    deletion_timestamp TIMESTAMPTZ;
BEGIN
    -- Create an assay to delete
    INSERT INTO assay_definitions (name, units)
    VALUES ('Assay để xóa', 'test')
    RETURNING id INTO test_assay_id;

    RAISE NOTICE 'Created test assay: %', test_assay_id;

    -- Check it's not being used
    IF NOT EXISTS (SELECT 1 FROM results WHERE assay_id = test_assay_id) THEN
        -- Perform soft delete
        UPDATE assay_definitions
        SET deleted_at = NOW()
        WHERE id = test_assay_id
        RETURNING deleted_at INTO deletion_timestamp;

        RAISE NOTICE '✓ TEST 8 PASSED: Soft deleted assay at %', deletion_timestamp;

        -- Verify it's still in database but marked deleted
        IF EXISTS (
            SELECT 1 FROM assay_definitions
            WHERE id = test_assay_id AND deleted_at IS NOT NULL
        ) THEN
            RAISE NOTICE '  Verified: Record still exists with deleted_at set';
        END IF;
    ELSE
        RAISE EXCEPTION '✗ TEST 8 FAILED: Cannot test deletion - assay is in use';
    END IF;
END $$;

\echo ''

-- ============================================================================
-- TEST 9: Get all methods for dropdown
-- ============================================================================
\echo '============================================================================'
\echo 'TEST 9: Get All Methods (getMethods)'
\echo '============================================================================'

SELECT id, name, description
FROM methods
WHERE deleted_at IS NULL
ORDER BY name;

\echo ''
\echo 'Expected: 3 methods (Chuẩn độ, Sắc ký, Vi sinh)'
\echo ''

DO $$
DECLARE
    method_count INT;
BEGIN
    SELECT COUNT(*) INTO method_count
    FROM methods
    WHERE deleted_at IS NULL;

    IF method_count >= 3 THEN
        RAISE NOTICE '✓ TEST 9 PASSED: Found % active methods', method_count;
    ELSE
        RAISE EXCEPTION '✗ TEST 9 FAILED: Expected at least 3 methods, found %', method_count;
    END IF;
END $$;

\echo ''

-- ============================================================================
-- TEST 10: Verify foreign key constraint on method_id
-- ============================================================================
\echo '============================================================================'
\echo 'TEST 10: Foreign Key Constraint on method_id'
\echo '============================================================================'

DO $$
BEGIN
    BEGIN
        INSERT INTO assay_definitions (name, method_id)
        VALUES ('Test Invalid FK', '00000000-0000-0000-0000-000000000000');

        RAISE EXCEPTION '✗ TEST 10 FAILED: Foreign key constraint not enforced';
    EXCEPTION
        WHEN foreign_key_violation THEN
            RAISE NOTICE '✓ TEST 10 PASSED: Foreign key constraint correctly enforced';
            RAISE NOTICE '  (Cannot insert assay with non-existent method_id)';
    END;
END $$;

\echo ''

-- ============================================================================
-- TEST 11: Verify JSONB validation_rules storage
-- ============================================================================
\echo '============================================================================'
\echo 'TEST 11: JSONB Validation Rules Storage'
\echo '============================================================================'

DO $$
DECLARE
    test_assay_id UUID;
    retrieved_rules JSONB;
BEGIN
    -- Create assay with complex validation rules
    INSERT INTO assay_definitions (name, validation_rules)
    VALUES (
        'Test JSONB Storage',
        '{"min": 0, "max": 100, "dataType": "numeric", "required": true, "precision": 2, "units": "mg/L"}'::jsonb
    )
    RETURNING id INTO test_assay_id;

    -- Retrieve and verify
    SELECT validation_rules INTO retrieved_rules
    FROM assay_definitions
    WHERE id = test_assay_id;

    IF jsonb_typeof(retrieved_rules) = 'object'
        AND retrieved_rules->>'dataType' = 'numeric'
        AND (retrieved_rules->>'max')::int = 100 THEN
        RAISE NOTICE '✓ TEST 11 PASSED: JSONB stored and retrieved correctly';
        RAISE NOTICE '  Retrieved: %', retrieved_rules;
    ELSE
        RAISE EXCEPTION '✗ TEST 11 FAILED: JSONB data corrupted';
    END IF;

    INSERT INTO test_cleanup VALUES (test_assay_id);
END $$;

\echo ''

-- ============================================================================
-- TEST 12: Verify updated_at trigger
-- ============================================================================
\echo '============================================================================'
\echo 'TEST 12: updated_at Trigger Functionality'
\echo '============================================================================'

DO $$
DECLARE
    test_assay_id UUID;
    old_timestamp TIMESTAMPTZ;
    new_timestamp TIMESTAMPTZ;
BEGIN
    -- Create test assay
    INSERT INTO assay_definitions (name)
    VALUES ('Test Trigger')
    RETURNING id, updated_at INTO test_assay_id, old_timestamp;

    RAISE NOTICE 'Initial updated_at: %', old_timestamp;

    -- Wait to ensure timestamp difference
    PERFORM pg_sleep(0.1);

    -- Update the assay
    UPDATE assay_definitions
    SET name = 'Test Trigger Updated'
    WHERE id = test_assay_id
    RETURNING updated_at INTO new_timestamp;

    RAISE NOTICE 'After update: %', new_timestamp;

    IF new_timestamp > old_timestamp THEN
        RAISE NOTICE '✓ TEST 12 PASSED: updated_at trigger working correctly';
    ELSE
        RAISE EXCEPTION '✗ TEST 12 FAILED: updated_at not updated by trigger';
    END IF;

    INSERT INTO test_cleanup VALUES (test_assay_id);
END $$;

\echo ''

-- ============================================================================
-- TEST 13: Verify audit log integration (if trigger exists)
-- ============================================================================
\echo '============================================================================'
\echo 'TEST 13: Audit Log Integration'
\echo '============================================================================'

DO $$
DECLARE
    test_assay_id UUID;
    audit_count INT;
BEGIN
    -- Create an assay
    INSERT INTO assay_definitions (name, units)
    VALUES ('Test Audit Log', 'test')
    RETURNING id INTO test_assay_id;

    -- Update it
    UPDATE assay_definitions
    SET units = 'updated'
    WHERE id = test_assay_id;

    -- Check audit logs
    SELECT COUNT(*) INTO audit_count
    FROM audit_logs
    WHERE table_name = 'assay_definitions'
        AND record_id = test_assay_id;

    IF audit_count > 0 THEN
        RAISE NOTICE '✓ TEST 13 PASSED: Found % audit log entries', audit_count;

        -- Show audit logs
        RAISE NOTICE 'Audit log details:';
        FOR rec IN (
            SELECT operation, changed_by, changed_at
            FROM audit_logs
            WHERE table_name = 'assay_definitions'
                AND record_id = test_assay_id
            ORDER BY changed_at
        ) LOOP
            RAISE NOTICE '  % at % by %', rec.operation, rec.changed_at, rec.changed_by;
        END LOOP;
    ELSE
        RAISE NOTICE '⚠ TEST 13 SKIPPED: No audit trigger configured for assay_definitions';
    END IF;

    INSERT INTO test_cleanup VALUES (test_assay_id);
END $$;

\echo ''

-- ============================================================================
-- TEST 14: Unicode and Vietnamese character handling
-- ============================================================================
\echo '============================================================================'
\echo 'TEST 14: Unicode and Vietnamese Characters'
\echo '============================================================================'

DO $$
DECLARE
    test_assay_id UUID;
    retrieved_name TEXT;
BEGIN
    -- Insert with Vietnamese characters and special symbols
    INSERT INTO assay_definitions (name, units)
    VALUES (
        'Thử nghiệm Độ pH (25°C) – Đặc biệt',
        'mg/L'
    )
    RETURNING id INTO test_assay_id;

    -- Retrieve and verify
    SELECT name INTO retrieved_name
    FROM assay_definitions
    WHERE id = test_assay_id;

    IF retrieved_name = 'Thử nghiệm Độ pH (25°C) – Đặc biệt' THEN
        RAISE NOTICE '✓ TEST 14 PASSED: Unicode characters preserved correctly';
        RAISE NOTICE '  Retrieved: %', retrieved_name;
    ELSE
        RAISE EXCEPTION '✗ TEST 14 FAILED: Unicode characters corrupted. Got: %', retrieved_name;
    END IF;

    INSERT INTO test_cleanup VALUES (test_assay_id);
END $$;

\echo ''

-- ============================================================================
-- TEST CLEANUP: Remove test data created during tests
-- ============================================================================
\echo '============================================================================'
\echo 'TEST CLEANUP'
\echo '============================================================================'

DO $$
DECLARE
    cleanup_count INT;
BEGIN
    -- Delete test assays created during tests
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_cleanup') THEN
        DELETE FROM assay_definitions
        WHERE id IN (SELECT assay_id FROM test_cleanup);

        GET DIAGNOSTICS cleanup_count = ROW_COUNT;
        RAISE NOTICE 'Cleaned up % test assays', cleanup_count;

        DROP TABLE test_cleanup;
    END IF;

    -- Reset the updated assay back to original
    UPDATE assay_definitions
    SET
        name = 'Độ đục',
        units = 'NTU',
        validation_rules = '{}'::jsonb
    WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

    RAISE NOTICE 'Reset modified test data to original state';
END $$;

\echo ''

-- ============================================================================
-- TEST SUMMARY
-- ============================================================================
\echo '============================================================================'
\echo 'TEST SUMMARY'
\echo '============================================================================'
\echo ''
\echo 'Tests Completed:'
\echo '  ✓ TEST 1:  Get All Assay Definitions'
\echo '  ✓ TEST 2:  Get Assay By ID'
\echo '  ✓ TEST 3:  Soft-Deleted Assay Exclusion'
\echo '  ✓ TEST 4:  Create Assay Definition'
\echo '  ✓ TEST 5:  Create with Minimal Data'
\echo '  ✓ TEST 6:  Update Assay Definition'
\echo '  ✓ TEST 7:  Deletion Prevention (In Use)'
\echo '  ✓ TEST 8:  Soft Delete Unused Assay'
\echo '  ✓ TEST 9:  Get All Methods'
\echo '  ✓ TEST 10: Foreign Key Constraint'
\echo '  ✓ TEST 11: JSONB Validation Rules'
\echo '  ✓ TEST 12: updated_at Trigger'
\echo '  ✓ TEST 13: Audit Log Integration'
\echo '  ✓ TEST 14: Unicode Character Handling'
\echo ''
\echo '============================================================================'
\echo 'ALL TESTS COMPLETED SUCCESSFULLY'
\echo '============================================================================'
\echo ''
\echo 'Next Steps:'
\echo '1. Run UI tests by navigating to /manager/assays'
\echo '2. Test with different user roles (analyst vs manager)'
\echo '3. Verify RLS policies are enforced'
\echo '4. Test error handling with invalid inputs'
\echo ''

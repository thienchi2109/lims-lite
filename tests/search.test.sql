-- =====================================================
-- PostgreSQL Full-Text Search Tests
-- =====================================================
-- Test suite for search functionality in CDC-LIMS
--
-- Tests:
-- 1. ts_rank ranking (relevant results ranked higher)
-- 2. Empty query handling
-- 3. RLS enforcement (analyst vs manager)
-- 4. Manager-only audit search
-- 5. Vietnamese diacritic handling (unaccent)
--
-- Run with:
-- docker exec -i lims-postgres psql -U postgres -d postgres -f /path/to/search.test.sql
-- =====================================================

\echo '========================================='
\echo 'PostgreSQL Full-Text Search Test Suite'
\echo '========================================='

-- Set search_path
SET search_path TO public;

-- =====================================================
-- Test 1: ts_rank Ranking (relevant results first)
-- =====================================================
\echo ''
\echo '=== Test 1: ts_rank Ranking ==='
\echo 'Testing that more relevant results rank higher'

-- Insert test samples with different relevance levels
INSERT INTO samples (sample_id, description, type, status)
VALUES
    ('RANK-001', 'Máu toàn phần', 'blood', 'received'),
    ('RANK-002', 'Máu', 'blood', 'received'),
    ('RANK-003', 'Huyết thanh máu người', 'serum', 'received'),
    ('RANK-004', 'Nước tiểu người bệnh', 'urine', 'received')
ON CONFLICT (sample_id) DO NOTHING;

-- Test: Search for "máu" should rank exact matches higher
\echo 'Query: "máu"'
SELECT
    sample_id,
    description,
    ROUND(rank::numeric, 4) as rank_score
FROM search_samples('máu', 10)
ORDER BY rank DESC;

\echo 'Expected: RANK-002 (exact match "Máu") should rank highest'

-- Cleanup
DELETE FROM samples WHERE sample_id LIKE 'RANK-%';

-- =====================================================
-- Test 2: Empty Query Handling
-- =====================================================
\echo ''
\echo '=== Test 2: Empty Query Handling ==='
\echo 'Testing that empty queries return no results'

-- Test: Empty string
\echo 'Query: "" (empty string)'
SELECT COUNT(*) as result_count FROM search_samples('', 10);
\echo 'Expected: 0 results'

-- Test: Single space
\echo 'Query: " " (single space)'
SELECT COUNT(*) as result_count FROM search_samples(' ', 10);
\echo 'Expected: 0 results'

-- Test: Whitespace only
\echo 'Query: "   " (multiple spaces)'
SELECT COUNT(*) as result_count FROM search_samples('   ', 10);
\echo 'Expected: 0 results'

-- =====================================================
-- Test 3: RLS Enforcement
-- =====================================================
\echo ''
\echo '=== Test 3: RLS Enforcement ==='
\echo 'Testing that RLS policies are enforced in search'

-- Create test users (if they don't exist)
DO $$
BEGIN
    -- Create analyst user
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'test-analyst@lims.local') THEN
        INSERT INTO users (id, email, full_name, role, password_hash)
        VALUES (
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'test-analyst@lims.local',
            'Test Analyst',
            'analyst',
            'dummy-hash'
        );
    END IF;

    -- Create manager user
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'test-manager@lims.local') THEN
        INSERT INTO users (id, email, full_name, role, password_hash)
        VALUES (
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            'test-manager@lims.local',
            'Test Manager',
            'manager',
            'dummy-hash'
        );
    END IF;
END $$;

-- Insert test sample
INSERT INTO samples (sample_id, description, type, status)
VALUES ('RLS-001', 'Test sample for RLS', 'blood', 'received')
ON CONFLICT (sample_id) DO NOTHING;

-- Test as analyst: Should see sample
\echo 'Testing as analyst (should see sample):'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "analyst"}';
SELECT COUNT(*) as result_count FROM search_samples('RLS', 10);
\echo 'Expected: 1 result'

-- Reset role
RESET ROLE;
RESET request.jwt.claims;

-- Cleanup
DELETE FROM samples WHERE sample_id = 'RLS-001';

-- =====================================================
-- Test 4: Manager-Only Audit Search
-- =====================================================
\echo ''
\echo '=== Test 4: Manager-Only Audit Search ==='
\echo 'Testing that only managers can search audit logs'

-- Test as analyst: Should fail or return empty
\echo 'Testing as analyst (should fail or return empty):'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "analyst"}';

DO $$
DECLARE
    result_count INTEGER;
BEGIN
    BEGIN
        SELECT COUNT(*) INTO result_count FROM search_audit_logs('update', 10);
        RAISE NOTICE 'Analyst audit search returned % results (should be 0)', result_count;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Analyst audit search failed as expected: %', SQLERRM;
    END;
END $$;

RESET ROLE;
RESET request.jwt.claims;

-- Test as manager: Should succeed
\echo 'Testing as manager (should succeed):'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "manager"}';

DO $$
DECLARE
    result_count INTEGER;
BEGIN
    BEGIN
        SELECT COUNT(*) INTO result_count FROM search_audit_logs('update', 10);
        RAISE NOTICE 'Manager audit search returned % results', result_count;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Manager audit search failed (unexpected): %', SQLERRM;
    END;
END $$;

RESET ROLE;
RESET request.jwt.claims;

-- =====================================================
-- Test 5: Vietnamese Diacritic Handling
-- =====================================================
\echo ''
\echo '=== Test 5: Vietnamese Diacritic Handling ==='
\echo 'Testing that diacritics and non-diacritics return same results'

-- Insert Vietnamese test samples
INSERT INTO samples (sample_id, description, type, status)
VALUES
    ('VN-001', 'Máu toàn phần người bệnh', 'blood', 'received'),
    ('VN-002', 'Huyết thanh máu', 'serum', 'received'),
    ('VN-003', 'Nước tiểu sáng', 'urine', 'received')
ON CONFLICT (sample_id) DO NOTHING;

-- Test: Search with diacritics
\echo 'Query with diacritics: "Máu"'
SELECT
    sample_id,
    description,
    ROUND(rank::numeric, 4) as rank_score
FROM search_samples('Máu', 10)
ORDER BY rank DESC;

-- Test: Search without diacritics (should return SAME results)
\echo 'Query without diacritics: "Mau"'
SELECT
    sample_id,
    description,
    ROUND(rank::numeric, 4) as rank_score
FROM search_samples('Mau', 10)
ORDER BY rank DESC;

\echo 'Expected: Both queries return identical results with identical rank scores'

-- Test: Complex Vietnamese query with diacritics
\echo 'Query: "Huyết thanh"'
SELECT
    sample_id,
    description,
    ROUND(rank::numeric, 4) as rank_score
FROM search_samples('Huyết thanh', 10)
ORDER BY rank DESC;

-- Test: Same query without diacritics
\echo 'Query: "Huyet thanh"'
SELECT
    sample_id,
    description,
    ROUND(rank::numeric, 4) as rank_score
FROM search_samples('Huyet thanh', 10)
ORDER BY rank DESC;

\echo 'Expected: Both queries return identical results'

-- Cleanup
DELETE FROM samples WHERE sample_id LIKE 'VN-%';

-- =====================================================
-- Test 6: Global Search Across Entities
-- =====================================================
\echo ''
\echo '=== Test 6: Global Search Across Entities ==='
\echo 'Testing that global_search returns results from multiple entities'

-- Insert test data across entities
INSERT INTO samples (sample_id, description, type, status)
VALUES ('GLOBAL-S1', 'Test global search sample', 'blood', 'received')
ON CONFLICT (sample_id) DO NOTHING;

INSERT INTO clients (name, phone, address)
VALUES ('Global Search Client', '0123456789', 'Test Address')
ON CONFLICT (phone) DO NOTHING;

INSERT INTO assays (name, units, is_active)
VALUES ('Global Search Assay', 'mg/dL', true)
ON CONFLICT (name) DO NOTHING;

-- Test: Global search
\echo 'Query: "global"'
SELECT
    entity_type,
    description,
    ROUND(rank::numeric, 4) as rank_score
FROM global_search('global', 20)
ORDER BY rank DESC;

\echo 'Expected: Results from samples, clients, and assays'

-- Cleanup
DELETE FROM samples WHERE sample_id = 'GLOBAL-S1';
DELETE FROM clients WHERE name = 'Global Search Client';
DELETE FROM assays WHERE name = 'Global Search Assay';

-- =====================================================
-- Test 7: Search Performance
-- =====================================================
\echo ''
\echo '=== Test 7: Search Performance ==='
\echo 'Testing query execution time'

-- Enable timing
\timing on

-- Run search query
SELECT COUNT(*) FROM search_samples('máu', 100);

-- Disable timing
\timing off

\echo 'Expected: Query should complete in < 50ms for typical LIMS workloads'

-- =====================================================
-- Cleanup Test Users
-- =====================================================
\echo ''
\echo '=== Cleanup Test Users ==='
DELETE FROM users WHERE email IN ('test-analyst@lims.local', 'test-manager@lims.local');

-- =====================================================
-- Test Summary
-- =====================================================
\echo ''
\echo '========================================='
\echo 'Test Suite Completed'
\echo '========================================='
\echo 'Review results above to verify:'
\echo '1. Ranking works correctly (more relevant = higher rank)'
\echo '2. Empty queries return 0 results'
\echo '3. RLS policies are enforced'
\echo '4. Only managers can search audit logs'
\echo '5. Vietnamese diacritics handled correctly (same results with/without)'
\echo '6. Global search returns results from multiple entities'
\echo '7. Performance is acceptable (< 50ms)'
\echo '========================================='

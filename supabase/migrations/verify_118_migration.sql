-- Verification Script for Migration 118
-- Run this after applying migration to verify all components created correctly
-- Usage: psql -U postgres -d postgres -f verify_118_migration.sql

\echo '========================================='
\echo 'Migration 118 Verification Script'
\echo '========================================='
\echo ''

-- Test 1: Table Structure
\echo '1. Verifying sample_submissions table structure...'
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sample_submissions'
ORDER BY ordinal_position;

\echo ''

-- Test 2: Indexes
\echo '2. Verifying indexes...'
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'sample_submissions'
ORDER BY indexname;

\echo ''

-- Test 3: Foreign Keys
\echo '3. Verifying foreign key constraints...'
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'sample_submissions';

\echo ''

-- Test 4: RLS Policies
\echo '4. Verifying RLS policies...'
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'sample_submissions';

\echo ''

-- Test 5: Audit Trigger
\echo '5. Verifying audit trigger...'
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'sample_submissions';

\echo ''

-- Test 6: RPC Function
\echo '6. Verifying submit_sample_for_review function...'
SELECT
    p.proname AS function_name,
    pg_catalog.pg_get_function_arguments(p.oid) AS arguments,
    pg_catalog.pg_get_function_result(p.oid) AS return_type,
    p.prosecdef AS is_security_definer,
    p.provolatile AS volatility
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'submit_sample_for_review';

\echo ''

-- Test 7: Table Comment
\echo '7. Verifying table and column comments...'
SELECT
    'TABLE' AS object_type,
    '' AS column_name,
    obj_description('public.sample_submissions'::regclass) AS comment
UNION ALL
SELECT
    'COLUMN' AS object_type,
    column_name,
    col_description('public.sample_submissions'::regclass, ordinal_position) AS comment
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sample_submissions'
  AND col_description('public.sample_submissions'::regclass, ordinal_position) IS NOT NULL
ORDER BY object_type DESC, column_name;

\echo ''

-- Test 8: RLS Enabled
\echo '8. Verifying RLS is enabled...'
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'sample_submissions';

\echo ''

-- Test 9: Unique Constraint
\echo '9. Verifying unique constraint on (sample_id, submission_number)...'
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_catalog.pg_get_constraintdef(oid, true) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.sample_submissions'::regclass
  AND contype = 'u';

\echo ''
\echo '========================================='
\echo 'Verification Complete!'
\echo '========================================='
\echo ''
\echo 'Expected Results:'
\echo '  - 9 columns in sample_submissions table'
\echo '  - 4 indexes (including primary key)'
\echo '  - 3 foreign keys (sample_id, user_id, signature_id) with RESTRICT'
\echo '  - 2 RLS policies (SELECT, INSERT)'
\echo '  - 1 audit trigger (AFTER INSERT OR UPDATE OR DELETE)'
\echo '  - 1 RPC function (submit_sample_for_review)'
\echo '  - RLS enabled = true'
\echo '  - 1 unique constraint on (sample_id, submission_number)'
\echo ''

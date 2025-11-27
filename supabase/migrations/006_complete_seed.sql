-- Complete Database Setup Script
-- Run this after migrations 001-003 are applied
-- Creates test users, sample data, and initial configuration

-- Set search path
SET search_path TO public, auth;

-- ============================================================================
-- STEP 1: CREATE AUTH USERS
-- ============================================================================
-- Insert test users directly into auth.users table
-- Password hash for 'password123' (you should change this in production)

-- Create Analyst User
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'analyst@cdc-lims.local',
    '$2a$10$lJEe7ViDUvCTyL3B5FJLF.O6n8Y8P4WjxGCGZE.uwzZQD7bDXhNYO', -- password123
    NOW(),
    NULL,
    '',
    NULL,
    '',
    NULL,
    '',
    '',
    NULL,
    NULL,
    '{"provider":"email","providers":["email"]}',
    '{}',
    FALSE,
    NOW(),
    NOW(),
    NULL,
    NULL,
    '',
    '',
    NULL,
    '',
    0,
    NULL,
    '',
    NULL
) ON CONFLICT (id) DO NOTHING;

-- Create Manager User
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'b0000000-0000-0000-0000-000000000001', -- Fixed UUID (was m...)
    'authenticated',
    'authenticated',
    'manager@cdc-lims.local',
    '$2a$10$lJEe7ViDUvCTyL3B5FJLF.O6n8Y8P4WjxGCGZE.uwzZQD7bDXhNYO', -- password123
    NOW(),
    NULL,
    '',
    NULL,
    '',
    NULL,
    '',
    '',
    NULL,
    NULL,
    '{"provider":"email","providers":["email"]}',
    '{}',
    FALSE,
    NOW(),
    NOW(),
    NULL,
    NULL,
    '',
    '',
    NULL,
    '',
    0,
    NULL,
    '',
    NULL
) ON CONFLICT (id) DO NOTHING;

-- Create System User (for audit logs when no user is logged in)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'service_role',
    'system@cdc-lims.local',
    '$2a$10$lJEe7ViDUvCTyL3B5FJLF.O6n8Y8P4WjxGCGZE.uwzZQD7bDXhNYO', -- password123
    NOW(),
    NULL,
    '',
    NULL,
    '',
    NULL,
    '',
    '',
    NULL,
    NULL,
    '{"provider":"email","providers":["email"]}',
    '{}',
    FALSE,
    NOW(),
    NOW(),
    NULL,
    NULL,
    '',
    '',
    NULL,
    '',
    0,
    NULL,
    '',
    NULL
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2: CREATE PUBLIC.USERS RECORDS
-- ============================================================================
INSERT INTO public.users (id, username, full_name, role) VALUES
('00000000-0000-0000-0000-000000000000', 'system', 'System', 'manager'),
('a0000000-0000-0000-0000-000000000001', 'analyst', 'Test Analyst', 'analyst'),
('b0000000-0000-0000-0000-000000000001', 'manager', 'Test Manager', 'manager')
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

-- ============================================================================
-- STEP 3: CREATE METHODS
-- ============================================================================
INSERT INTO public.methods (id, name, description, procedure_reference) VALUES
('00000000-0000-0000-0000-000000000001', 'EPA Method 150.1', 'Standard pH Measurement', 'EPA-150.1-1982'),
('00000000-0000-0000-0000-000000000002', 'EPA Method 300.0', 'Determination of Inorganic Anions by Ion Chromatography', 'EPA-300.0-1993')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 4: CREATE ASSAY DEFINITIONS
-- ============================================================================
INSERT INTO public.assay_definitions (id, name, method_id, units, validation_rules) VALUES
('10000000-0000-0000-0000-000000000001', 'pH', '00000000-0000-0000-0000-000000000001', 'S.U.', 
'{"type": "numeric", "min": 0, "max": 14, "required": true}'::jsonb),
('10000000-0000-0000-0000-000000000002', 'Temperature', '00000000-0000-0000-0000-000000000001', '°C', 
'{"type": "numeric", "min": -50, "max": 100, "required": true}'::jsonb),
('10000000-0000-0000-0000-000000000003', 'Turbidity', '00000000-0000-0000-0000-000000000001', 'NTU', 
'{"type": "numeric", "min": 0, "max": 1000, "required": true}'::jsonb),
('10000000-0000-0000-0000-000000000004', 'Free Chlorine', '00000000-0000-0000-0000-000000000002', 'mg/L', 
'{"type": "numeric", "min": 0, "max": 10, "required": true}'::jsonb),
('10000000-0000-0000-0000-000000000005', 'Conductivity', '00000000-0000-0000-0000-000000000001', 'µS/cm', 
'{"type": "numeric", "min": 0, "max": 50000, "required": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 5: CREATE SAMPLE DATA
-- ============================================================================
DO $$
DECLARE
    v_analyst_id UUID := 'a0000000-0000-0000-0000-000000000001';
    v_sample_id UUID;
    i INTEGER;
    created_samples INTEGER := 0;
BEGIN
    -- Create 20 samples
    FOR i IN 1..20 LOOP
        INSERT INTO public.samples (sample_id, client_name, status, received_by, received_at)
        VALUES (
            'CDC-XN-' || TO_CHAR(CURRENT_DATE, 'DDMMYYYY') || '-' || LPAD(i::TEXT, 4, '0'),
            'Test Client ' || i,
            'received',
            v_analyst_id,
            CURRENT_TIMESTAMP - (i || ' hours')::INTERVAL
        )
        ON CONFLICT (sample_id) DO NOTHING
        RETURNING id INTO v_sample_id;
        
        IF v_sample_id IS NOT NULL THEN
            created_samples := created_samples + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'Created % samples', created_samples;
END $$;

-- ============================================================================
-- STEP 6: ASSIGN TESTS TO FIRST 5 SAMPLES
-- ============================================================================
DO $$
DECLARE
    sample_record RECORD;
    assay_record RECORD;
    result_count INTEGER := 0;
BEGIN
    -- Get first 5 received samples
    FOR sample_record IN 
        SELECT id FROM public.samples 
        WHERE status = 'received'
        AND sample_id LIKE 'CDC-XN-%'
        ORDER BY created_at DESC
        LIMIT 5
    LOOP
        -- Assign all 5 assays to each sample
        FOR assay_record IN 
            SELECT id FROM public.assay_definitions 
            WHERE deleted_at IS NULL
        LOOP
            INSERT INTO public.results (sample_id, assay_id, status)
            VALUES (sample_record.id, assay_record.id, 'pending')
            ON CONFLICT DO NOTHING;
            
            result_count := result_count + 1;
        END LOOP;

        -- Update sample status to 'assigned'
        UPDATE public.samples 
        SET status = 'assigned'
        WHERE id = sample_record.id;
    END LOOP;

    RAISE NOTICE 'Created % test assignments (results)', result_count;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
SELECT 'Users Created:' as info, COUNT(*) as count FROM auth.users WHERE email LIKE '%@cdc-lims.local';
SELECT 'Public Users:' as info, COUNT(*) as count FROM public.users;
SELECT 'Methods:' as info, COUNT(*) as count FROM public.methods;
SELECT 'Assays:' as info, COUNT(*) as count FROM public.assay_definitions;
SELECT 'Samples:' as info, COUNT(*) as count FROM public.samples WHERE sample_id LIKE 'CDC-XN-%';
SELECT 'Results (Pending):' as info, COUNT(*) as count FROM public.results WHERE status = 'pending';

-- Show login credentials
SELECT '
====================================
TEST USER CREDENTIALS
====================================
Analyst Account:
  Email: analyst@cdc-lims.local
  Password: password123
  
Manager Account:
  Email: manager@cdc-lims.local
  Password: password123
====================================' as credentials;

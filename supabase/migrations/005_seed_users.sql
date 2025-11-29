-- CDC-LIMS User Seed Data
-- Migration 005: Create Test Users (Analyst and Manager accounts)
-- These users are for development and testing purposes

-- Set search path
SET search_path TO public;

-- ============================================================================
-- CREATE TEST USERS IN AUTH.USERS TABLE
-- ============================================================================
-- Note: Supabase auth.users must be created via API or Supabase Dashboard
-- This migration creates the corresponding public.users records

-- IMPORTANT: You need to create these users in Supabase Auth first:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add user" and create:
--    - Email: analyst@cdc-lims.local, Password: analyst123
--    - Email: manager@cdc-lims.local, Password: manager123
-- 3. Note the UUID generated for each user
-- 4. Update the UUIDs below with the actual auth.users IDs

-- ============================================================================
-- INSERT PUBLIC.USERS RECORDS
-- ============================================================================
-- Replace these UUIDs with actual auth.users IDs from Supabase Dashboard

-- Analyst User
INSERT INTO public.users (id, username, full_name, role) 
VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID, -- Replace with actual auth.users ID
    'analyst',
    'Test Analyst',
    'analyst'
) ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

-- Manager User
INSERT INTO public.users (id, username, full_name, role) 
VALUES (
    '00000000-0000-0000-0000-000000000002'::UUID, -- Replace with actual auth.users ID
    'manager',
    'Test Manager',
    'manager'
) ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT * FROM public.users;

COMMENT ON TABLE public.users IS 'Extended user profiles - ensure auth.users exist first';

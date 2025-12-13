-- Migration 031: Fix seed user password hashes
-- Security Impact: Low
-- Changes: Ensures seeded users have a valid bcrypt hash for password123; requires pgcrypto

SET search_path TO auth, public;

-- Ensure pgcrypto is available for bcrypt hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Reset known seed passwords for local/dev users
UPDATE auth.users
SET encrypted_password = crypt('password123', gen_salt('bf'))
WHERE email IN (
    'analyst@cdc-lims.local',
    'manager@cdc-lims.local',
    'system@cdc-lims.local'
);

-- Verify security posture
SELECT * FROM public.run_security_tests();

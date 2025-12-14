-- Migration 022: Add User Management Fields
-- Adds email, lab, and deleted_at columns to public.users table and backfills data

SET search_path TO public;

-- Add columns using standard IF NOT EXISTS (Postgres 9.6+)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS lab TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add index on deleted_at for performance
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users(deleted_at);

-- Update comments
COMMENT ON COLUMN public.users.email IS 'Contact email for the user';
COMMENT ON COLUMN public.users.lab IS 'Laboratory or department name';
COMMENT ON COLUMN public.users.deleted_at IS 'Timestamp for soft deletion';

-- Backfill Data
-- 1. Sync email from auth.users (requires permissions on auth schema)
-- Using a DO block to handle potential permission or data issues gracefully
DO $$
BEGIN
    UPDATE public.users u
    SET email = a.email
    FROM auth.users a
    WHERE u.id = a.id
    AND u.email IS NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not backfill emails from auth.users: %', SQLERRM;
END$$;

-- 2. Set default Lab for existing users
UPDATE public.users
SET lab = 'Central Lab'
WHERE lab IS NULL;
